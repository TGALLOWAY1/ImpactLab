/**
 * Transient Shaper MB — AudioWorklet Processor
 * Self-contained: all DSP classes inlined (AudioWorklet cannot use ES imports).
 *
 * Architecture B from the DSP report: 5-band LR4 IIR crossover,
 * per-band dual-envelope transient detection (swappable), asymmetric
 * gain smoothing, lookahead, soft limiter, stereo processing.
 */

// ═══════════════════════════════════════════════════════════════════
// DSP Math Utilities
// ═══════════════════════════════════════════════════════════════════

function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function linearToDb(lin) {
  return 20 * Math.log10(Math.max(lin, 1e-20));
}

function msToCoeff(ms, sampleRate) {
  if (ms <= 0) return 0;
  return Math.exp(-1.0 / (ms * 0.001 * sampleRate));
}

// ═══════════════════════════════════════════════════════════════════
// BiquadFilter — Direct Form II Transposed
// ═══════════════════════════════════════════════════════════════════

class BiquadFilter {
  constructor() {
    this.b0 = 1; this.b1 = 0; this.b2 = 0;
    this.a1 = 0; this.a2 = 0;
    this.z1 = 0; this.z2 = 0;
  }

  processSample(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  reset() {
    this.z1 = 0; this.z2 = 0;
  }

  setLowpass(freq, sampleRate, Q) {
    const w0 = 2 * Math.PI * freq / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * Q);

    const a0 = 1 + alpha;
    this.b0 = ((1 - cosW0) / 2) / a0;
    this.b1 = (1 - cosW0) / a0;
    this.b2 = ((1 - cosW0) / 2) / a0;
    this.a1 = (-2 * cosW0) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  setHighpass(freq, sampleRate, Q) {
    const w0 = 2 * Math.PI * freq / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * Q);

    const a0 = 1 + alpha;
    this.b0 = ((1 + cosW0) / 2) / a0;
    this.b1 = (-(1 + cosW0)) / a0;
    this.b2 = ((1 + cosW0) / 2) / a0;
    this.a1 = (-2 * cosW0) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  // 2nd-order allpass: unity magnitude, and at Q = 1/sqrt(2) its phase response
  // is exactly that of an LR4 split at the same frequency (LP + HP = this).
  // Used to phase-align bands against crossovers further down the chain.
  setAllpass(freq, sampleRate, Q) {
    const w0 = 2 * Math.PI * freq / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * Q);

    const a0 = 1 + alpha;
    this.b0 = (1 - alpha) / a0;
    this.b1 = (-2 * cosW0) / a0;
    this.b2 = 1;
    this.a1 = (-2 * cosW0) / a0;
    this.a2 = (1 - alpha) / a0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// AllpassChain — cascade of 2nd-order allpasses used for band alignment
//
// A serial LR4 crossover tree is NOT sum-flat on its own: the low output of
// split i skips every later split, so it arrives with a different phase than
// the bands that passed through them. Summing those bands produces magnitude
// ripple (measured up to ~1 dB around 3 kHz on the default 80/500/2500/8000
// layout) even with every control at its neutral position.
//
// The standard fix is to feed each band through the allpass equivalent of the
// splits it skipped. The whole bank then collapses to AP(f0)·AP(f1)·AP(f2)·AP(f3)
// — flat magnitude everywhere. The global dry path runs through the same
// cascade so Mix and Delta stay phase-coherent with the wet sum.
// ═══════════════════════════════════════════════════════════════════

const LR_Q = 0.7071067811865476; // 1/sqrt(2) — Butterworth

class AllpassChain {
  constructor(freqs, sampleRate) {
    this.filters = freqs.map(() => new BiquadFilter());
    this.setFrequencies(freqs, sampleRate);
  }

  setFrequencies(freqs, sampleRate) {
    for (let i = 0; i < this.filters.length; i++) {
      this.filters[i].setAllpass(freqs[i], sampleRate, LR_Q);
    }
  }

  process(x) {
    let y = x;
    for (let i = 0; i < this.filters.length; i++) {
      y = this.filters[i].processSample(y);
    }
    return y;
  }

  reset() {
    for (let i = 0; i < this.filters.length; i++) this.filters[i].reset();
  }
}

// ═══════════════════════════════════════════════════════════════════
// LR4Crossover — Linkwitz-Riley 4th-order (2× cascaded Butterworth)
// ═══════════════════════════════════════════════════════════════════

class LR4Crossover {
  constructor(freq, sampleRate) {
    this.lp1 = new BiquadFilter();
    this.lp2 = new BiquadFilter();
    this.hp1 = new BiquadFilter();
    this.hp2 = new BiquadFilter();
    this.updateFrequency(freq, sampleRate);
  }

  updateFrequency(freq, sampleRate) {
    this.lp1.setLowpass(freq, sampleRate, LR_Q);
    this.lp2.setLowpass(freq, sampleRate, LR_Q);
    this.hp1.setHighpass(freq, sampleRate, LR_Q);
    this.hp2.setHighpass(freq, sampleRate, LR_Q);
  }

  process(x) {
    const lp = this.lp2.processSample(this.lp1.processSample(x));
    const hp = this.hp2.processSample(this.hp1.processSample(x));
    return { lp, hp };
  }

  reset() {
    this.lp1.reset(); this.lp2.reset();
    this.hp1.reset(); this.hp2.reset();
  }
}

// ═══════════════════════════════════════════════════════════════════
// CircularBuffer — Delay line for lookahead
// ═══════════════════════════════════════════════════════════════════

class CircularBuffer {
  constructor(size) {
    this.buffer = new Float32Array(Math.max(size, 1));
    this.writePos = 0;
    this.size = Math.max(size, 1);
  }

  readAndWrite(sample) {
    const out = this.buffer[this.writePos];
    this.buffer[this.writePos] = sample;
    this.writePos = (this.writePos + 1) % this.size;
    return out;
  }

  reset() {
    this.buffer.fill(0);
    this.writePos = 0;
  }

  resize(newSize) {
    newSize = Math.max(newSize, 1);
    this.buffer = new Float32Array(newSize);
    this.writePos = 0;
    this.size = newSize;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ParameterSmoother — Exponential interpolation
// ═══════════════════════════════════════════════════════════════════

class ParameterSmoother {
  constructor(sampleRate, smoothingMs = 20) {
    this.coeff = msToCoeff(smoothingMs, sampleRate);
    this.current = 0;
    this.target = 0;
  }

  setTarget(value) {
    this.target = value;
  }

  next() {
    this.current = this.coeff * this.current + (1 - this.coeff) * this.target;
    return this.current;
  }

  snap() {
    this.current = this.target;
    return this.current;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SoftLimiter — tanh soft clip
// ═══════════════════════════════════════════════════════════════════

class SoftLimiter {
  process(sample, ceiling = 0.98) {
    if (Math.abs(sample) <= ceiling) return sample;
    // tanh soft clip above ceiling
    const excess = (Math.abs(sample) - ceiling) / (1 - ceiling + 0.001);
    const limited = ceiling + (1 - ceiling) * Math.tanh(excess);
    return sample >= 0 ? limited : -limited;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DETECTION METHODS
// All share: reset(), processSample(x_rect) → {attackSignal, sustainSignal},
//            updateTimeConstants(fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs, sampleRate)
// ═══════════════════════════════════════════════════════════════════

// --- Method 1: Dual Envelope Difference (SPL Transient Designer approach) ---

class DualEnvelopeDetector {
  constructor(sampleRate, fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs) {
    this.envFast = 0;
    this.envSlow = 0;
    this.updateTimeConstants(fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs, sampleRate);
  }

  updateTimeConstants(fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs, sampleRate) {
    this.fastAtt = msToCoeff(fastAttackMs, sampleRate);
    this.fastRel = msToCoeff(fastReleaseMs, sampleRate);
    this.slowAtt = msToCoeff(slowAttackMs, sampleRate);
    this.slowRel = msToCoeff(slowReleaseMs, sampleRate);
  }

  processSample(xRect) {
    // Fast envelope (asymmetric)
    if (xRect > this.envFast) {
      this.envFast = this.fastAtt * this.envFast + (1 - this.fastAtt) * xRect;
    } else {
      this.envFast = this.fastRel * this.envFast + (1 - this.fastRel) * xRect;
    }

    // Slow envelope (asymmetric)
    if (xRect > this.envSlow) {
      this.envSlow = this.slowAtt * this.envSlow + (1 - this.slowAtt) * xRect;
    } else {
      this.envSlow = this.slowRel * this.envSlow + (1 - this.slowRel) * xRect;
    }

    // Denormal protection
    this.envFast += 1e-15;
    this.envSlow += 1e-15;

    // Normalized transient signal
    const transient = (this.envFast - this.envSlow) / Math.max(this.envSlow, 1e-8);

    return {
      attackSignal: clamp(transient, 0, 1),
      sustainSignal: clamp(-transient, 0, 1),
    };
  }

  reset() {
    this.envFast = 0;
    this.envSlow = 0;
  }
}

// --- Method 2: Peak vs RMS Comparator ---

class PeakRmsDetector {
  constructor(sampleRate, fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs) {
    this.envPeak = 0;
    this.rmsAccum = 0;
    this.updateTimeConstants(fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs, sampleRate);
  }

  updateTimeConstants(fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs, sampleRate) {
    // Peak uses fast times
    this.peakAtt = msToCoeff(fastAttackMs * 0.5, sampleRate); // even faster for peak
    this.peakRel = msToCoeff(fastReleaseMs, sampleRate);
    // RMS uses slow times
    this.rmsCoeff = msToCoeff(slowReleaseMs * 0.5, sampleRate);
  }

  processSample(xRect) {
    // Peak envelope (very fast attack, moderate release)
    if (xRect > this.envPeak) {
      this.envPeak = this.peakAtt * this.envPeak + (1 - this.peakAtt) * xRect;
    } else {
      this.envPeak = this.peakRel * this.envPeak + (1 - this.peakRel) * xRect;
    }

    // Leaky RMS (running mean of x^2, then sqrt)
    this.rmsAccum = this.rmsCoeff * this.rmsAccum + (1 - this.rmsCoeff) * (xRect * xRect);
    const envRms = Math.sqrt(this.rmsAccum + 1e-15);

    // Denormal protection
    this.envPeak += 1e-15;

    // Crest factor as transient indicator. A real signal always has
    // peak >= RMS, so ratio < 1 only ever comes from the denormal floor
    // during silence — clamping it keeps the sustain curve monotonic
    // instead of peaking when there is no signal at all.
    const ratio = Math.max(this.envPeak / Math.max(envRms, 1e-8), 1.0);

    // Normalize: ratio ~1.0 = no transient, >1 = transient
    const transient = clamp((ratio - 1.0) / 3.0, 0, 1);
    const sustain = clamp((1.0 - ratio + 0.5) * 0.5, 0, 1);

    return {
      attackSignal: transient,
      sustainSignal: sustain,
    };
  }

  reset() {
    this.envPeak = 0;
    this.rmsAccum = 0;
  }
}

// --- Method 3: Derivative / Slope ---

class DerivativeDetector {
  constructor(sampleRate, fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs) {
    this.env = 0;
    this.envPrev = 0;
    this.derivSmooth = 0;
    this.sensitivity = 8.0; // derivative sensitivity scaling
    this.updateTimeConstants(fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs, sampleRate);
  }

  updateTimeConstants(fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs, sampleRate) {
    // Envelope smoothing — use a middle ground between fast and slow
    this.envCoeff = msToCoeff((fastAttackMs + slowAttackMs) * 0.5, sampleRate);
    // Derivative smoothing — shorter to preserve responsiveness
    this.derivSmoothCoeff = msToCoeff(fastReleaseMs * 0.3, sampleRate);
  }

  processSample(xRect) {
    // Smooth the rectified input
    this.env = this.envCoeff * this.env + (1 - this.envCoeff) * xRect;
    this.env += 1e-15;

    // First difference (derivative)
    const derivative = this.env - this.envPrev;
    this.envPrev = this.env;

    // Normalize by envelope level
    const normDeriv = derivative / Math.max(this.env, 1e-8);

    // Smooth the derivative
    this.derivSmooth = this.derivSmoothCoeff * this.derivSmooth +
                       (1 - this.derivSmoothCoeff) * normDeriv;

    return {
      attackSignal: clamp(this.derivSmooth * this.sensitivity, 0, 1),
      sustainSignal: clamp(-this.derivSmooth * this.sensitivity, 0, 1),
    };
  }

  reset() {
    this.env = 0;
    this.envPrev = 0;
    this.derivSmooth = 0;
  }
}

// --- Method 4: Energy Flux ---

class EnergyFluxDetector {
  constructor(sampleRate, fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs) {
    this.sampleRate = sampleRate;
    this.prevEnergy = 0;
    this.sampleCounter = 0;
    this.currentFlux = 0;
    this.fluxSmooth = 0;
    this.sensitivity = 4.0;

    // Window size ~2ms (from report recommendation)
    this.windowSize = Math.max(Math.round(0.002 * sampleRate), 8);
    this.energyBuffer = new Float32Array(this.windowSize);
    this.writePos = 0;

    this.updateTimeConstants(fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs, sampleRate);
  }

  updateTimeConstants(fastAttackMs, fastReleaseMs, slowAttackMs, slowReleaseMs, sampleRate) {
    this.fluxSmoothCoeff = msToCoeff(fastReleaseMs * 0.5, sampleRate);
  }

  processSample(xRect) {
    // Write squared energy into window buffer
    this.energyBuffer[this.writePos] = xRect * xRect;
    this.writePos = (this.writePos + 1) % this.windowSize;
    this.sampleCounter++;

    if (this.sampleCounter >= this.windowSize) {
      this.sampleCounter = 0;

      // Sum energy in window
      let energy = 0;
      for (let i = 0; i < this.windowSize; i++) {
        energy += this.energyBuffer[i];
      }
      energy /= this.windowSize;

      // Energy flux = positive change in energy
      const flux = Math.max(energy - this.prevEnergy, 0);

      // Normalize by previous energy (level-independent)
      if (this.prevEnergy > 1e-10) {
        this.currentFlux = flux / this.prevEnergy;
      } else {
        this.currentFlux = 0;
      }
      this.prevEnergy = energy;
    }

    // Smooth flux to sample rate
    this.fluxSmooth = this.fluxSmoothCoeff * this.fluxSmooth +
                      (1 - this.fluxSmoothCoeff) * this.currentFlux;

    return {
      attackSignal: clamp(this.fluxSmooth * this.sensitivity, 0, 1),
      sustainSignal: clamp((1.0 - this.fluxSmooth * this.sensitivity) * 0.3, 0, 1),
    };
  }

  reset() {
    this.prevEnergy = 0;
    this.sampleCounter = 0;
    this.currentFlux = 0;
    this.fluxSmooth = 0;
    this.energyBuffer.fill(0);
    this.writePos = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Detector Factory
// ═══════════════════════════════════════════════════════════════════

function createDetector(method, sampleRate, fastAttMs, fastRelMs, slowAttMs, slowRelMs) {
  switch (method) {
    case 'peak-rms':
      return new PeakRmsDetector(sampleRate, fastAttMs, fastRelMs, slowAttMs, slowRelMs);
    case 'derivative':
      return new DerivativeDetector(sampleRate, fastAttMs, fastRelMs, slowAttMs, slowRelMs);
    case 'energy-flux':
      return new EnergyFluxDetector(sampleRate, fastAttMs, fastRelMs, slowAttMs, slowRelMs);
    case 'dual-envelope':
    default:
      return new DualEnvelopeDetector(sampleRate, fastAttMs, fastRelMs, slowAttMs, slowRelMs);
  }
}

// ═══════════════════════════════════════════════════════════════════
// BandProcessor — Per-band transient shaping pipeline
// ═══════════════════════════════════════════════════════════════════

// Per-band default time constants (from dspMapping.js)
const BAND_DEFAULTS = {
  sub:        { attackMs: 5,   releaseMs: 200, sidechainHpf: 80 },
  low:        { attackMs: 2,   releaseMs: 150, sidechainHpf: 40 },
  'low-mid':  { attackMs: 1,   releaseMs: 100, sidechainHpf: 0 },
  'high-mid': { attackMs: 0.5, releaseMs: 50,  sidechainHpf: 0 },
  high:       { attackMs: 0.2, releaseMs: 30,  sidechainHpf: 0 },
};

const BAND_IDS = ['sub', 'low', 'low-mid', 'high-mid', 'high'];

// Signal-presence gate thresholds (linear amplitude). Below PRESENCE_FLOOR
// (~-90 dBFS) detection is fully muted; it fades in over PRESENCE_SPAN so the
// gate never snaps. Real program material sits far above this — the gate only
// exists to stop detectors from shaping digital silence.
const PRESENCE_FLOOR = 3.16e-5;             // -90 dBFS
const PRESENCE_SPAN = 1.78e-4 - PRESENCE_FLOOR; // fully open by -75 dBFS

// Lookahead time when the toggle is on. Adds exactly this much latency.
const LOOKAHEAD_MS = 3;

const DEFAULT_XOVER_FREQS = [80, 500, 2500, 8000];

// Guard the filter design against out-of-range or out-of-order frequencies.
// A biquad asked for a corner at or above Nyquist goes unstable, and a
// descending pair produces a negative-width band, so neither can be allowed
// to reach the filters however the value arrived.
function sanitizeCrossoverFreqs(freqs, sampleRate) {
  const maxFreq = Math.min(20000, sampleRate * 0.45);
  const out = [];
  let floorFreq = 20;
  for (let i = 0; i < 4; i++) {
    const raw = freqs && freqs[i];
    let f = typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_XOVER_FREQS[i];
    // Keep at least a semitone of separation so adjacent splits can't collapse.
    f = clamp(f, floorFreq, maxFreq);
    out.push(f);
    floorFreq = Math.min(f * 1.06, maxFreq);
  }
  return out;
}

class BandProcessor {
  constructor(bandId, sampleRate, detectionMethod) {
    this.bandId = bandId;
    this.sampleRate = sampleRate;
    const defaults = BAND_DEFAULTS[bandId];

    // Time constants
    this.baseAttackMs = defaults.attackMs;
    this.baseReleaseMs = defaults.releaseMs;

    // Derive fast/slow time constants from base attack/release
    const fastAttMs = this.baseAttackMs;
    const fastRelMs = this.baseAttackMs * 20;
    const slowAttMs = this.baseAttackMs * 40;
    const slowRelMs = this.baseReleaseMs;

    // Detector
    this.detector = createDetector(detectionMethod, sampleRate, fastAttMs, fastRelMs, slowAttMs, slowRelMs);
    this.currentMethod = detectionMethod;

    // Sidechain HPF (1st-order, only for sub/low)
    this.hpfEnabled = defaults.sidechainHpf > 0;
    if (this.hpfEnabled) {
      this.hpfCoeff = Math.exp(-2 * Math.PI * defaults.sidechainHpf / sampleRate);
      this.hpfState = 0;
    }

    // Gain smoothing (asymmetric: fast attack, slower release on gain)
    this.gainSmooth = 1.0;
    this.gainAttCoeff = msToCoeff(0.3, sampleRate);
    this.gainRelCoeff = msToCoeff(2.0, sampleRate);

    // Parameter smoothers
    this.attackAmountSmoother = new ParameterSmoother(sampleRate, 20);
    this.sustainAmountSmoother = new ParameterSmoother(sampleRate, 20);
    this.outputGainSmoother = new ParameterSmoother(sampleRate, 20);
    // Per-band wet/dry blend, 0..1
    this.mixSmoother = new ParameterSmoother(sampleRate, 20);
    this.mixSmoother.setTarget(1.0);
    this.mixSmoother.snap();

    // Crossfade for detector switching (prevents clicks)
    this.oldDetector = null;
    this.crossfadeSamples = 0;
    this.crossfadeLength = Math.round(0.005 * sampleRate); // 5ms

    // Lookahead: the detector reads the live sample while the audio it
    // shapes is held back by this delay, so the gain envelope is already
    // open by the time the transient arrives.
    this.lookaheadBuf = new CircularBuffer(1);
    this.lookaheadSamples = 0;
    this.lastAlignedInput = 0;

    // Signal-presence gate. The crest- and flux-based detectors settle on a
    // non-zero sustain reading when fed digital silence, which would apply
    // sustain gain to the gaps between hits. This tracks a fast-attack /
    // slow-release level and fades detection out below roughly -90 dBFS.
    this.presenceEnv = 0;
    this.presenceRelCoeff = msToCoeff(50, sampleRate);
  }

  setLookahead(samples) {
    const n = Math.max(0, Math.round(samples));
    if (n === this.lookaheadSamples) return;
    this.lookaheadSamples = n;
    this.lookaheadBuf.resize(Math.max(n, 1));
  }

  setDetectionMethod(method, sampleRate) {
    if (method === this.currentMethod) return;

    // Start crossfade from old to new
    this.oldDetector = this.detector;
    this.crossfadeSamples = this.crossfadeLength;

    const fastAttMs = this.baseAttackMs;
    const fastRelMs = this.baseAttackMs * 20;
    const slowAttMs = this.baseAttackMs * 40;
    const slowRelMs = this.baseReleaseMs;
    this.detector = createDetector(method, sampleRate, fastAttMs, fastRelMs, slowAttMs, slowRelMs);
    this.currentMethod = method;
  }

  setParams(attackAmount, sustainAmount, outputGain, attackTime, sustainTime, speedMultiplier, mixAmount) {
    // attackAmount/sustainAmount: -100 to +100 (UI percentage)
    this.attackAmountSmoother.setTarget(attackAmount);
    this.sustainAmountSmoother.setTarget(sustainAmount);
    this.outputGainSmoother.setTarget(outputGain);
    if (mixAmount !== undefined) this.mixSmoother.setTarget(clamp(mixAmount, 0, 1));

    // Map attackTime (0-100) to actual ms range for this band
    // 0 = base * 0.25, 50 = base * 1.0, 100 = base * 4.0
    const attackScale = Math.pow(2, (attackTime - 50) / 25); // 0.25x to 4x
    const sustainScale = Math.pow(2, (sustainTime - 50) / 25);

    const effectiveAttackMs = this.baseAttackMs * attackScale * speedMultiplier;
    const effectiveReleaseMs = this.baseReleaseMs * sustainScale * speedMultiplier;

    const fastAttMs = effectiveAttackMs;
    const fastRelMs = effectiveAttackMs * 20;
    const slowAttMs = effectiveAttackMs * 40;
    const slowRelMs = effectiveReleaseMs;

    this.detector.updateTimeConstants(fastAttMs, fastRelMs, slowAttMs, slowRelMs, this.sampleRate);
    if (this.oldDetector) {
      this.oldDetector.updateTimeConstants(fastAttMs, fastRelMs, slowAttMs, slowRelMs, this.sampleRate);
    }
  }

  processSample(x) {
    // 1. Sidechain HPF (for detector only, not audio path)
    let sc = x;
    if (this.hpfEnabled) {
      const hpfOut = x - this.hpfState;
      this.hpfState = this.hpfCoeff * this.hpfState + (1 - this.hpfCoeff) * x;
      sc = hpfOut;
    }

    // 2. Rectify for detector
    const xRect = Math.abs(sc);

    // 3. Detect transient/sustain signals
    let detection = this.detector.processSample(xRect);

    // Handle crossfade between old and new detector
    if (this.crossfadeSamples > 0 && this.oldDetector) {
      const oldDetection = this.oldDetector.processSample(xRect);
      const fade = this.crossfadeSamples / this.crossfadeLength;
      detection = {
        attackSignal: oldDetection.attackSignal * fade + detection.attackSignal * (1 - fade),
        sustainSignal: oldDetection.sustainSignal * fade + detection.sustainSignal * (1 - fade),
      };
      this.crossfadeSamples--;
      if (this.crossfadeSamples === 0) this.oldDetector = null;
    }

    // 4. Signal-presence gate — see constructor. Fades detection to zero
    //    below ~-90 dBFS so silence is never shaped.
    if (xRect > this.presenceEnv) {
      this.presenceEnv = xRect;
    } else {
      this.presenceEnv = this.presenceRelCoeff * this.presenceEnv;
    }
    const presence = clamp((this.presenceEnv - PRESENCE_FLOOR) / PRESENCE_SPAN, 0, 1);
    const attackSignal = presence * detection.attackSignal;
    const sustainSignal = presence * detection.sustainSignal;

    // 5. Compute gain
    const attackDb = (this.attackAmountSmoother.next() / 100) * 12; // ±12dB
    const sustainDb = (this.sustainAmountSmoother.next() / 100) * 12;

    const totalGainDb = attackDb * attackSignal + sustainDb * sustainSignal;
    const gainLinear = dbToLinear(totalGainDb);

    // 6. Asymmetric gain smoothing
    const coeff = (gainLinear > this.gainSmooth) ? this.gainAttCoeff : this.gainRelCoeff;
    this.gainSmooth = coeff * this.gainSmooth + (1 - coeff) * gainLinear;

    // 7. Apply gain + per-band output gain
    const outGainLin = dbToLinear(this.outputGainSmoother.next());

    // Expose last-detected signals (read by the offline detector capture path
    // and the explainer visualization). These are the gated values, so what is
    // drawn is what actually drives the gain.
    this.lastAttackSignal = attackSignal;
    this.lastSustainSignal = sustainSignal;

    // 8. Delay the audio to match the lookahead the detector was given.
    //    Everything downstream (per-band blend, delta viz, the global dry
    //    path) works from this aligned sample, never the raw input.
    const xd = this.lookaheadSamples > 0 ? this.lookaheadBuf.readAndWrite(x) : x;
    this.lastAlignedInput = xd;

    // 9. Per-band wet/dry blend
    const wet = this.gainSmooth * outGainLin * xd;
    const m = this.mixSmoother.next();
    return m * wet + (1 - m) * xd;
  }

  // Band bypass: no shaping, but the audio still has to leave this band with
  // the same latency as its neighbours or the band sum comb-filters.
  processBypassed(x) {
    const xd = this.lookaheadSamples > 0 ? this.lookaheadBuf.readAndWrite(x) : x;
    this.lastAlignedInput = xd;
    return xd;
  }

  reset() {
    this.detector.reset();
    this.gainSmooth = 1.0;
    if (this.hpfEnabled) this.hpfState = 0;
    this.attackAmountSmoother.snap();
    this.sustainAmountSmoother.snap();
    this.outputGainSmoother.snap();
    this.mixSmoother.snap();
    this.oldDetector = null;
    this.crossfadeSamples = 0;
    this.lookaheadBuf.reset();
    this.lastAlignedInput = 0;
    this.presenceEnv = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// TransientShaperProcessor — Main AudioWorkletProcessor
// ═══════════════════════════════════════════════════════════════════

class TransientShaperProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const opts = options.processorOptions || {};
    this.sr = sampleRate; // global in AudioWorklet scope

    // State
    this.params = opts.initialParams || {};
    this.detectionMethod = this.params.detectionMethod || 'dual-envelope';

    // Speed multiplier from detection speed preset
    this.speedMultiplier = 1.0;

    // 4 LR4 crossovers for 5 bands, per channel (L/R)
    this.xoverFreqs = sanitizeCrossoverFreqs(this.params.crossoverFreqs, this.sr);
    this.crossoversL = this.xoverFreqs.map(f => new LR4Crossover(f, this.sr));
    this.crossoversR = this.xoverFreqs.map(f => new LR4Crossover(f, this.sr));

    // Allpass compensation. Band i (i < 4) skipped every split after i, so it
    // gets the allpass equivalent of splits i+1..3 to land back in phase with
    // the bands that went through them. Band 4 passed through all of them and
    // needs nothing. See the AllpassChain header for why this is required.
    this.bandApL = [];
    this.bandApR = [];
    for (let i = 0; i < 5; i++) {
      const laterFreqs = this.xoverFreqs.slice(i + 1);
      this.bandApL.push(new AllpassChain(laterFreqs, this.sr));
      this.bandApR.push(new AllpassChain(laterFreqs, this.sr));
    }

    // The compensated band sum equals AP(f0)·AP(f1)·AP(f2)·AP(f3) applied to
    // the input — flat magnitude, but phase-rotated. The dry path used by Mix
    // and Delta runs through the same cascade so the two stay coherent;
    // without it, Mix comb-filters and Delta never nulls.
    this.dryApL = new AllpassChain(this.xoverFreqs, this.sr);
    this.dryApR = new AllpassChain(this.xoverFreqs, this.sr);

    // 5 band processors per channel
    this.bandProcessorsL = BAND_IDS.map(id => new BandProcessor(id, this.sr, this.detectionMethod));
    this.bandProcessorsR = BAND_IDS.map(id => new BandProcessor(id, this.sr, this.detectionMethod));

    // Lookahead delay lines for the global dry path, matched to the per-band
    // delay inside each BandProcessor.
    this.lookaheadEnabled = !!this.params.lookahead;
    this.lookaheadSamples = this.lookaheadEnabled ? Math.round(LOOKAHEAD_MS * 0.001 * this.sr) : 0;
    this.lookaheadL = new CircularBuffer(Math.max(this.lookaheadSamples, 1));
    this.lookaheadR = new CircularBuffer(Math.max(this.lookaheadSamples, 1));
    this._applyLookahead();

    // Soft limiter — per channel so L gain reduction does not couple R
    this.limiterL = new SoftLimiter();
    this.limiterR = new SoftLimiter();
    this.softClipEnabled = !!this.params.softClip;

    // Pre-allocated per-sample band scratch buffers (avoids audio-thread allocation)
    this._bandsL = new Float32Array(5);
    this._bandsR = new Float32Array(5);

    // Global bypass (dry pass-through)
    this.globalBypass = !!this.params.globalBypass;

    // Meter accumulators (reset after each post)
    this._meterReset();
    this.meterPostInterval = 11; // ~32ms at 128/44.1k → ~31 Hz

    // Global gain smoothers
    this.inputGainSmoother = new ParameterSmoother(this.sr, 20);
    this.outputGainSmoother = new ParameterSmoother(this.sr, 20);
    this.mixSmoother = new ParameterSmoother(this.sr, 20);
    this.mixSmoother.setTarget(1.0);
    this.mixSmoother.snap();

    // Delta mode
    this.deltaEnabled = false;

    // Solo/bypass state
    this.soloState = [false, false, false, false, false];
    this.bypassState = [false, false, false, false, false];

    // Fullband explainer mode: skip crossover, route input straight to one
    // BandProcessor so the detector + processed output reflect the full signal.
    // Used by the /explainer route's offline pre-render, not realtime playback.
    this.fullbandMode = !!opts.fullbandMode;
    this.fullbandIndex = 2; // 'low-mid' BandProcessor — no sidechain HPF

    // Offline detector capture: accumulate per-sample detector + I/O arrays and
    // post them back on FINISH_CAPTURE. Only meaningful in fullbandMode.
    this.captureDetector = !!opts.captureDetector;
    if (this.captureDetector) {
      this.captureAttackBuf = [];
      this.captureSustainBuf = [];
      this.captureInputBuf = [];
      this.captureOutputBuf = [];
    }

    // Viz data: SharedArrayBuffer or postMessage fallback
    // Downsampled for longer time window (~6 seconds visible).
    // Per-band layout:
    //   [0 .. VIZ_SAMPLES_PER_BAND)               band peak ring buffer
    //   [VIZ_SAMPLES_PER_BAND .. 2*VIZ_SAMPLES)   delta peak ring buffer (|wet-dry|)
    //   [2*VIZ_SAMPLES]                           write position (shared by both rings)
    //   [2*VIZ_SAMPLES + 1]                       reserved
    this.vizSab = opts.vizSharedBuffer || null;
    this.vizView = this.vizSab ? new Float32Array(this.vizSab) : null;
    this.vizWritePos = new Int32Array(5).fill(0); // per-band write position
    this.vizSamplesPerBand = 1024;
    this.vizFloatsPerBand = this.vizSamplesPerBand * 2 + 2;
    this.vizDeltaOffset = this.vizSamplesPerBand;
    this.vizBlockCounter = 0;

    // Downsampling: accumulate peaks over N samples before writing
    this.vizDownsampleFactor = 256; // ~6 seconds visible at 44.1kHz with 1024 samples
    this.vizPeakAccum = new Float32Array(5).fill(0); // peak accumulator per band (input)
    this.vizDeltaPeakAccum = new Float32Array(5).fill(0); // peak |wet-dry| per band
    this.vizSampleCount = new Int32Array(5).fill(0); // samples since last viz write

    // Apply initial params
    this._applyParams(this.params);

    // Message handler
    this.port.onmessage = (e) => this._handleMessage(e.data);
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'SET_PARAMS':
        this._applyParams(msg.params);
        break;
      case 'SET_DETECTION_METHOD':
        this._setDetectionMethod(msg.method);
        break;
      case 'SET_CROSSOVER_FREQS':
        this._setCrossoverFreqs(msg.freqs);
        break;
      case 'SET_VIZ_BUFFER':
        this.vizSab = msg.buffer;
        this.vizView = new Float32Array(this.vizSab);
        break;
      case 'RESET':
        this._reset();
        break;
      case 'FINISH_CAPTURE': {
        if (!this.captureDetector) {
          this.port.postMessage({ type: 'captureResult', attack: null, sustain: null, input: null, output: null });
          break;
        }
        const attack = new Float32Array(this.captureAttackBuf);
        const sustain = new Float32Array(this.captureSustainBuf);
        const inputArr = new Float32Array(this.captureInputBuf);
        const outputArr = new Float32Array(this.captureOutputBuf);
        this.port.postMessage(
          { type: 'captureResult', attack, sustain, input: inputArr, output: outputArr },
          [attack.buffer, sustain.buffer, inputArr.buffer, outputArr.buffer]
        );
        this.captureAttackBuf = [];
        this.captureSustainBuf = [];
        this.captureInputBuf = [];
        this.captureOutputBuf = [];
        break;
      }
    }
  }

  _applyParams(params) {
    if (!params) return;

    // Global gains
    if (params.inputGain !== undefined) this.inputGainSmoother.setTarget(params.inputGain);
    if (params.outputGain !== undefined) this.outputGainSmoother.setTarget(params.outputGain);
    if (params.mix !== undefined) this.mixSmoother.setTarget(params.mix / 100);

    // Toggles
    if (params.softClip !== undefined) this.softClipEnabled = params.softClip;
    if (params.delta !== undefined) this.deltaEnabled = params.delta;
    if (params.globalBypass !== undefined) {
      const wasBypassed = this.globalBypass;
      this.globalBypass = !!params.globalBypass;
      // Detectors and gain smoothers stand still while bypassed, so coming
      // back out of bypass with stale envelopes would apply whatever gain was
      // frozen in. Start the bands from unity instead.
      if (wasBypassed && !this.globalBypass && this.bandProcessorsL) {
        this.bandProcessorsL.forEach(p => p.reset());
        this.bandProcessorsR.forEach(p => p.reset());
        this.crossoversL.forEach(c => c.reset());
        this.crossoversR.forEach(c => c.reset());
        this.bandApL.forEach(a => a.reset());
        this.bandApR.forEach(a => a.reset());
      }
    }

    // Lookahead
    if (params.lookahead !== undefined) {
      const wasEnabled = this.lookaheadEnabled;
      this.lookaheadEnabled = !!params.lookahead;
      if (this.lookaheadEnabled !== wasEnabled) this._applyLookahead();
    }

    // Detection speed
    if (params.detectionSpeed) {
      const presets = { slow: 2.0, medium: 1.0, fast: 0.5 };
      this.speedMultiplier = presets[params.detectionSpeed] || 1.0;
    }

    // Detection method
    if (params.detectionMethod && params.detectionMethod !== this.detectionMethod) {
      this._setDetectionMethod(params.detectionMethod);
    }

    // Crossover freqs
    if (params.crossoverFreqs) {
      this._setCrossoverFreqs(params.crossoverFreqs);
    }

    // Per-band params
    if (params.bands) {
      for (let i = 0; i < BAND_IDS.length; i++) {
        const bandId = BAND_IDS[i];
        const bp = params.bands[bandId];
        if (!bp) continue;

        const mixUnit = bp.mix !== undefined ? bp.mix / 100 : 1.0;
        this.bandProcessorsL[i].setParams(
          bp.attack || 0, bp.sustain || 0, bp.outputGain || 0,
          bp.attackTime !== undefined ? bp.attackTime : 50,
          bp.sustainTime !== undefined ? bp.sustainTime : 50,
          this.speedMultiplier,
          mixUnit
        );
        this.bandProcessorsR[i].setParams(
          bp.attack || 0, bp.sustain || 0, bp.outputGain || 0,
          bp.attackTime !== undefined ? bp.attackTime : 50,
          bp.sustainTime !== undefined ? bp.sustainTime : 50,
          this.speedMultiplier,
          mixUnit
        );

        this.soloState[i] = !!bp.solo;
        this.bypassState[i] = !!bp.bypass;
      }
    }
  }

  _setDetectionMethod(method) {
    this.detectionMethod = method;
    for (let i = 0; i < 5; i++) {
      this.bandProcessorsL[i].setDetectionMethod(method, this.sr);
      this.bandProcessorsR[i].setDetectionMethod(method, this.sr);
    }
  }

  // Keep the per-band lookahead delay in step with the global dry delay.
  // Both must be the same length or the bands and the dry signal drift apart.
  _applyLookahead() {
    const samples = this.lookaheadEnabled ? Math.round(LOOKAHEAD_MS * 0.001 * this.sr) : 0;
    this.lookaheadSamples = samples;
    this.lookaheadL.resize(Math.max(samples, 1));
    this.lookaheadR.resize(Math.max(samples, 1));
    if (!this.bandProcessorsL) return;
    for (let i = 0; i < 5; i++) {
      this.bandProcessorsL[i].setLookahead(samples);
      this.bandProcessorsR[i].setLookahead(samples);
    }
  }

  _setCrossoverFreqs(freqs) {
    const safe = sanitizeCrossoverFreqs(freqs, this.sr);
    this.xoverFreqs = safe;
    for (let i = 0; i < 4; i++) {
      this.crossoversL[i].updateFrequency(safe[i], this.sr);
      this.crossoversR[i].updateFrequency(safe[i], this.sr);
    }
    // Compensation allpasses must track the same frequencies, or the band
    // sum stops being flat the moment the user drags a crossover point.
    for (let i = 0; i < 5; i++) {
      const laterFreqs = safe.slice(i + 1);
      this.bandApL[i].setFrequencies(laterFreqs, this.sr);
      this.bandApR[i].setFrequencies(laterFreqs, this.sr);
    }
    this.dryApL.setFrequencies(safe, this.sr);
    this.dryApR.setFrequencies(safe, this.sr);
  }

  _meterReset() {
    // Block-accumulated peak/RMS values (linear, not dB)
    this.meterInPeakL = 0; this.meterInPeakR = 0;
    this.meterOutPeakL = 0; this.meterOutPeakR = 0;
    this.meterInSqAccL = 0; this.meterInSqAccR = 0;
    this.meterOutSqAccL = 0; this.meterOutSqAccR = 0;
    this.meterSampleCount = 0;
    // Largest gain *deviation* from unity across the post window, kept signed.
    // A transient shaper set to boost attack spends its time above 1.0, so a
    // reduction-only meter would sit dark through the plugin's main use case.
    this.meterGainPeak = 1.0;
    this.meterBandGainPeak = this.meterBandGainPeak || new Float32Array(5);
    for (let i = 0; i < 5; i++) this.meterBandGainPeak[i] = 1.0;
    this.meterBlockCounter = 0;
  }

  // Keep whichever of the two is further from unity gain, in either direction.
  static _furtherFromUnity(a, b) {
    return Math.abs(Math.log(a)) >= Math.abs(Math.log(b)) ? a : b;
  }

  _reset() {
    this.crossoversL.forEach(c => c.reset());
    this.crossoversR.forEach(c => c.reset());
    this.bandProcessorsL.forEach(p => p.reset());
    this.bandProcessorsR.forEach(p => p.reset());
    this.bandApL.forEach(a => a.reset());
    this.bandApR.forEach(a => a.reset());
    this.dryApL.reset();
    this.dryApR.reset();
    this.limiterL = new SoftLimiter();
    this.limiterR = new SoftLimiter();
    this._meterReset();
    this.lookaheadL.reset();
    this.lookaheadR.reset();
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    // No input connected
    if (!input || !input[0] || input[0].length === 0) {
      // Output silence
      if (output[0]) output[0].fill(0);
      if (output[1]) output[1].fill(0);
      return true;
    }

    const inL = input[0];
    const inR = input[1] || input[0]; // mono → duplicate to stereo
    const outL = output[0];
    const outR = output[1] || output[0];
    const blockSize = inL.length;

    // Check if any band is soloed
    const anySoloed = this.soloState.some(s => s);

    const bandsL = this._bandsL;
    const bandsR = this._bandsR;

    for (let n = 0; n < blockSize; n++) {
      // 1. Input gain
      const inGainLin = dbToLinear(this.inputGainSmoother.next());
      const sampleL = inL[n] * inGainLin;
      const sampleR = inR[n] * inGainLin;

      // IN meter accumulation (post input-gain stage)
      const inAbsL = sampleL >= 0 ? sampleL : -sampleL;
      const inAbsR = sampleR >= 0 ? sampleR : -sampleR;
      if (inAbsL > this.meterInPeakL) this.meterInPeakL = inAbsL;
      if (inAbsR > this.meterInPeakR) this.meterInPeakR = inAbsR;
      this.meterInSqAccL += sampleL * sampleL;
      this.meterInSqAccR += sampleR * sampleR;

      // Dry signal, delayed to match the lookahead the bands are running.
      // Global bypass uses this untouched copy so A/B compares against the
      // genuine input; Mix and Delta use the allpassed copy below, which is
      // what the compensated band sum is phase-aligned to.
      let dryL, dryR;
      if (this.lookaheadSamples > 0) {
        dryL = this.lookaheadL.readAndWrite(sampleL);
        dryR = this.lookaheadR.readAndWrite(sampleR);
      } else {
        dryL = sampleL;
        dryR = sampleR;
      }

      // Global bypass: dry through (lookahead-aligned to avoid click on toggle)
      if (this.globalBypass) {
        const outGainLin = dbToLinear(this.outputGainSmoother.next());
        // Still advance smoothers and the dry allpass so leaving bypass
        // resumes from warm state rather than snapping.
        this.mixSmoother.next();
        this.dryApL.process(dryL);
        this.dryApR.process(dryR);
        const o0 = dryL * outGainLin;
        const o1 = dryR * outGainLin;
        outL[n] = o0;
        if (outR !== outL) outR[n] = o1;
        const oAbsL = o0 >= 0 ? o0 : -o0;
        const oAbsR = o1 >= 0 ? o1 : -o1;
        if (oAbsL > this.meterOutPeakL) this.meterOutPeakL = oAbsL;
        if (oAbsR > this.meterOutPeakR) this.meterOutPeakR = oAbsR;
        this.meterOutSqAccL += o0 * o0;
        this.meterOutSqAccR += o1 * o1;
        this.meterSampleCount++;
        continue;
      }

      // Fullband explainer path: bypass the crossover chain entirely, run
      // the full-bandwidth signal through a single BandProcessor. This keeps
      // detector + output clean for the 3-row visualization.
      if (this.fullbandMode) {
        const idx = this.fullbandIndex;
        const bp = this.bandProcessorsL[idx];
        const bpR = this.bandProcessorsR[idx];
        const wetL = bp.processSample(sampleL);
        const wetR = bpR.processSample(sampleR);

        if (this.captureDetector) {
          this.captureInputBuf.push(sampleL);
          this.captureOutputBuf.push(wetL);
          this.captureAttackBuf.push(bp.lastAttackSignal || 0);
          this.captureSustainBuf.push(bp.lastSustainSignal || 0);
        }

        // No crossover in this path, so no allpass compensation is involved —
        // the raw dry is already phase-aligned with the wet.
        let finalL = wetL;
        let finalR = wetR;
        if (this.deltaEnabled) { finalL -= dryL; finalR -= dryR; }
        const mix = this.mixSmoother.next();
        finalL = mix * finalL + (1 - mix) * dryL;
        finalR = mix * finalR + (1 - mix) * dryR;
        const outGainLin = dbToLinear(this.outputGainSmoother.next());
        let o0 = finalL * outGainLin;
        let o1 = finalR * outGainLin;
        if (this.softClipEnabled) {
          o0 = this.limiterL.process(o0);
          o1 = this.limiterR.process(o1);
        }
        outL[n] = o0;
        if (outR !== outL) outR[n] = o1;
        const oAbsL = o0 >= 0 ? o0 : -o0;
        const oAbsR = o1 >= 0 ? o1 : -o1;
        if (oAbsL > this.meterOutPeakL) this.meterOutPeakL = oAbsL;
        if (oAbsR > this.meterOutPeakR) this.meterOutPeakR = oAbsR;
        this.meterOutSqAccL += o0 * o0;
        this.meterOutSqAccR += o1 * o1;
        this.meterSampleCount++;
        continue;
      }

      // 2. Split into 5 bands through crossover chain
      // Topology: input → xover[0] → (LP=sub, HP → xover[1] → (LP=low, HP → xover[2] → (LP=lowMid, HP → xover[3] → (LP=highMid, HP=high))))
      let remainL = sampleL;
      let remainR = sampleR;
      for (let i = 0; i < 4; i++) {
        const splitL = this.crossoversL[i].process(remainL);
        const splitR = this.crossoversR[i].process(remainR);
        bandsL[i] = splitL.lp;
        bandsR[i] = splitR.lp;
        remainL = splitL.hp;
        remainR = splitR.hp;
      }
      bandsL[4] = remainL;
      bandsR[4] = remainR;

      // 3. Process each band
      // NOTE on multiband sum-flat: the raw cascade above is NOT sum-flat.
      // A single LR4 split has |LP| + |HP| = 1 in phase, but in a serial tree
      // the low output of split i never sees splits i+1..3, so it arrives
      // phase-shifted relative to the bands that did. Summing those bands
      // as-is dips the response by up to ~1 dB near the crossover points even
      // with every control neutral. The per-band AllpassChain applied below
      // puts the skipped phase back; only then does the bank sum flat, at any
      // crossover setting and with any combination of solo/bypass.
      let wetL = 0;
      let wetR = 0;
      for (let i = 0; i < 5; i++) {
        const bL = bandsL[i];
        const bR = bandsR[i];
        let procL = 0;
        let procR = 0;
        let bandActive = false;

        // Solo/bypass logic. Solo is checked FIRST: soloing one band has to
        // silence every other band, including bypassed ones — otherwise
        // bypassing a band makes it inaudible to solo but still audible in
        // the mix, which is the opposite of what both controls promise.
        if (anySoloed && !this.soloState[i]) {
          // Muted by another band's solo. Still run the processor so its
          // detector state and delay line stay aligned with the other bands.
          this.bandProcessorsL[i].processSample(bL);
          this.bandProcessorsR[i].processSample(bR);
          procL = 0;
          procR = 0;
        } else if (this.bypassState[i]) {
          // Bypass: unprocessed, but latency-matched to its neighbours.
          procL = this.bandProcessorsL[i].processBypassed(bL);
          procR = this.bandProcessorsR[i].processBypassed(bR);
        } else {
          procL = this.bandProcessorsL[i].processSample(bL);
          procR = this.bandProcessorsR[i].processSample(bR);
          bandActive = true;
        }

        // Allpass-compensate this band's contribution, then sum. Bypassed and
        // muted bands go through the same chain so the bank stays flat
        // whatever combination of solo/bypass the user has set.
        wetL += this.bandApL[i].process(procL);
        wetR += this.bandApR[i].process(procR);

        // Per-band gain tracking. gainSmooth is the shaper's instantaneous
        // linear gain: >1 is a transient boost, <1 a reduction. Track whichever
        // is further from unity so the meter responds to both.
        const bandIdle = !bandActive;
        const gL = bandIdle ? 1.0 : this.bandProcessorsL[i].gainSmooth;
        const gR = bandIdle ? 1.0 : this.bandProcessorsR[i].gainSmooth;
        const g = TransientShaperProcessor._furtherFromUnity(gL, gR);
        this.meterBandGainPeak[i] =
          TransientShaperProcessor._furtherFromUnity(g, this.meterBandGainPeak[i]);
        this.meterGainPeak =
          TransientShaperProcessor._furtherFromUnity(g, this.meterGainPeak);

        // Accumulate peak for downsampled viz data — stereo max
        if (this.vizView) {
          const aL = bL >= 0 ? bL : -bL;
          const aR = bR >= 0 ? bR : -bR;
          const absSample = aL > aR ? aL : aR;
          if (absSample > this.vizPeakAccum[i]) {
            this.vizPeakAccum[i] = absSample;
          }

          // Per-band delta peak (|processed - input|) — drives the rectified
          // delta strip drawn at the bottom of each waveform when the user
          // toggles the global Delta view. Only meaningful when the band is
          // actively processed; bypass/mute → 0.
          if (bandActive) {
            // Compare against the band's own lookahead-aligned input, not the
            // raw one, or the delay alone would read as a full-scale delta.
            const dL = procL - this.bandProcessorsL[i].lastAlignedInput;
            const dR = procR - this.bandProcessorsR[i].lastAlignedInput;
            const adL = dL >= 0 ? dL : -dL;
            const adR = dR >= 0 ? dR : -dR;
            const absDelta = adL > adR ? adL : adR;
            if (absDelta > this.vizDeltaPeakAccum[i]) {
              this.vizDeltaPeakAccum[i] = absDelta;
            }
          }

          this.vizSampleCount[i]++;

          // Write downsampled peak when we've accumulated enough samples
          if (this.vizSampleCount[i] >= this.vizDownsampleFactor) {
            const bandOffset = i * this.vizFloatsPerBand;
            const wp = this.vizWritePos[i];
            this.vizView[bandOffset + wp] = this.vizPeakAccum[i];
            this.vizView[bandOffset + this.vizDeltaOffset + wp] = this.vizDeltaPeakAccum[i];
            this.vizWritePos[i] = (wp + 1) % this.vizSamplesPerBand;
            this.vizView[bandOffset + this.vizSamplesPerBand * 2] = this.vizWritePos[i];

            // Reset accumulators
            this.vizPeakAccum[i] = 0;
            this.vizDeltaPeakAccum[i] = 0;
            this.vizSampleCount[i] = 0;
          }
        }
      }

      // 4. Phase-matched dry for Mix and Delta. The compensated band sum is
      //    the input through AP(f0..f3), so the dry has to take the same
      //    route: blending against the raw input would comb-filter, and Delta
      //    would show the crossover's phase shift instead of the shaping.
      const dryApValL = this.dryApL.process(dryL);
      const dryApValR = this.dryApR.process(dryR);

      // 5. Delta mode (hear only processed difference)
      if (this.deltaEnabled) {
        wetL = wetL - dryApValL;
        wetR = wetR - dryApValR;
      }

      // 6. Wet/dry mix
      const mix = this.mixSmoother.next();
      const finalL = mix * wetL + (1 - mix) * dryApValL;
      const finalR = mix * wetR + (1 - mix) * dryApValR;

      // 7. Output gain, then the limiter last of all. Clipping is only
      //    meaningful at the point the signal leaves the plugin, so a guard
      //    that runs before mix and output gain cannot actually guard it.
      const outGainLin = dbToLinear(this.outputGainSmoother.next());
      let o0 = finalL * outGainLin;
      let o1 = finalR * outGainLin;
      if (this.softClipEnabled) {
        o0 = this.limiterL.process(o0);
        o1 = this.limiterR.process(o1);
      }
      outL[n] = o0;
      if (outR !== outL) outR[n] = o1;

      // OUT meter accumulation
      const oAbsL = o0 >= 0 ? o0 : -o0;
      const oAbsR = o1 >= 0 ? o1 : -o1;
      if (oAbsL > this.meterOutPeakL) this.meterOutPeakL = oAbsL;
      if (oAbsR > this.meterOutPeakR) this.meterOutPeakR = oAbsR;
      this.meterOutSqAccL += o0 * o0;
      this.meterOutSqAccR += o1 * o1;
      this.meterSampleCount++;
    }

    // Periodically notify main thread about viz write position (low overhead)
    this.vizBlockCounter++;
    if (this.vizBlockCounter >= 4) { // every ~12ms at 128-sample blocks
      this.vizBlockCounter = 0;
      this.port.postMessage({
        type: 'vizUpdate',
        writePositions: Array.from(this.vizWritePos),
      });
    }

    // Periodic meter post (~30 Hz)
    this.meterBlockCounter++;
    if (this.meterBlockCounter >= this.meterPostInterval) {
      const n = this.meterSampleCount > 0 ? this.meterSampleCount : 1;
      const inRmsL = Math.sqrt(this.meterInSqAccL / n);
      const inRmsR = Math.sqrt(this.meterInSqAccR / n);
      const outRmsL = Math.sqrt(this.meterOutSqAccL / n);
      const outRmsR = Math.sqrt(this.meterOutSqAccR / n);
      // Signed peak gain change: negative = reduction, positive = transient boost.
      const gainDb = linearToDb(this.meterGainPeak);
      const bandGainDb = new Array(5);
      for (let i = 0; i < 5; i++) bandGainDb[i] = linearToDb(this.meterBandGainPeak[i]);
      this.port.postMessage({
        type: 'meters',
        inPeakL: this.meterInPeakL, inPeakR: this.meterInPeakR,
        inRmsL, inRmsR,
        outPeakL: this.meterOutPeakL, outPeakR: this.meterOutPeakR,
        outRmsL, outRmsR,
        gainDb,
        bandGainDb,
      });
      this._meterReset();
    }

    return true;
  }
}

registerProcessor('transient-shaper-processor', TransientShaperProcessor);
