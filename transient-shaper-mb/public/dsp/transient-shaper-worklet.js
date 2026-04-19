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
    const Q = 0.7071067811865476; // 1/sqrt(2) — Butterworth
    this.lp1.setLowpass(freq, sampleRate, Q);
    this.lp2.setLowpass(freq, sampleRate, Q);
    this.hp1.setHighpass(freq, sampleRate, Q);
    this.hp2.setHighpass(freq, sampleRate, Q);
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

    // Crest factor as transient indicator
    const ratio = this.envPeak / Math.max(envRms, 1e-8);

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

    // Crossfade for detector switching (prevents clicks)
    this.oldDetector = null;
    this.crossfadeSamples = 0;
    this.crossfadeLength = Math.round(0.005 * sampleRate); // 5ms
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

  setParams(attackAmount, sustainAmount, outputGain, attackTime, sustainTime, speedMultiplier) {
    // attackAmount/sustainAmount: -100 to +100 (UI percentage)
    this.attackAmountSmoother.setTarget(attackAmount);
    this.sustainAmountSmoother.setTarget(sustainAmount);
    this.outputGainSmoother.setTarget(outputGain);

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

    // 4. Compute gain
    const attackDb = (this.attackAmountSmoother.next() / 100) * 12; // ±12dB
    const sustainDb = (this.sustainAmountSmoother.next() / 100) * 12;

    const totalGainDb = attackDb * detection.attackSignal + sustainDb * detection.sustainSignal;
    const gainLinear = dbToLinear(totalGainDb);

    // 5. Asymmetric gain smoothing
    const coeff = (gainLinear > this.gainSmooth) ? this.gainAttCoeff : this.gainRelCoeff;
    this.gainSmooth = coeff * this.gainSmooth + (1 - coeff) * gainLinear;

    // 6. Apply gain + per-band output gain
    const outGainLin = dbToLinear(this.outputGainSmoother.next());

    // Expose last-detected signals (read by offline detector capture path)
    this.lastAttackSignal = detection.attackSignal;
    this.lastSustainSignal = detection.sustainSignal;

    return this.gainSmooth * outGainLin * x;
  }

  reset() {
    this.detector.reset();
    this.gainSmooth = 1.0;
    if (this.hpfEnabled) this.hpfState = 0;
    this.attackAmountSmoother.snap();
    this.sustainAmountSmoother.snap();
    this.outputGainSmoother.snap();
    this.oldDetector = null;
    this.crossfadeSamples = 0;
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
    const freqs = this.params.crossoverFreqs || [80, 500, 2500, 8000];
    this.crossoversL = freqs.map(f => new LR4Crossover(f, this.sr));
    this.crossoversR = freqs.map(f => new LR4Crossover(f, this.sr));

    // 5 band processors per channel
    this.bandProcessorsL = BAND_IDS.map(id => new BandProcessor(id, this.sr, this.detectionMethod));
    this.bandProcessorsR = BAND_IDS.map(id => new BandProcessor(id, this.sr, this.detectionMethod));

    // Lookahead delay lines (per channel)
    const lookaheadMs = this.params.lookahead ? 3 : 0;
    const lookaheadSamples = Math.round(lookaheadMs * 0.001 * this.sr) || 1;
    this.lookaheadL = new CircularBuffer(lookaheadSamples);
    this.lookaheadR = new CircularBuffer(lookaheadSamples);
    this.lookaheadEnabled = !!this.params.lookahead;

    // Soft limiter
    this.limiter = new SoftLimiter();
    this.softClipEnabled = !!this.params.softClip;

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
    // Downsampled for longer time window (~6 seconds visible)
    this.vizSab = opts.vizSharedBuffer || null;
    this.vizView = this.vizSab ? new Float32Array(this.vizSab) : null;
    this.vizWritePos = new Int32Array(5).fill(0); // per-band write position
    this.vizSamplesPerBand = 1024;
    this.vizBlockCounter = 0;
    
    // Downsampling: accumulate peaks over N samples before writing
    this.vizDownsampleFactor = 256; // ~6 seconds visible at 44.1kHz with 1024 samples
    this.vizPeakAccum = new Float32Array(5).fill(0); // peak accumulator per band
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

    // Lookahead
    if (params.lookahead !== undefined) {
      const wasEnabled = this.lookaheadEnabled;
      this.lookaheadEnabled = params.lookahead;
      if (params.lookahead && !wasEnabled) {
        const samples = Math.round(0.003 * this.sr);
        this.lookaheadL.resize(samples);
        this.lookaheadR.resize(samples);
      }
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

        this.bandProcessorsL[i].setParams(
          bp.attack || 0, bp.sustain || 0, bp.outputGain || 0,
          bp.attackTime !== undefined ? bp.attackTime : 50,
          bp.sustainTime !== undefined ? bp.sustainTime : 50,
          this.speedMultiplier
        );
        this.bandProcessorsR[i].setParams(
          bp.attack || 0, bp.sustain || 0, bp.outputGain || 0,
          bp.attackTime !== undefined ? bp.attackTime : 50,
          bp.sustainTime !== undefined ? bp.sustainTime : 50,
          this.speedMultiplier
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

  _setCrossoverFreqs(freqs) {
    for (let i = 0; i < 4; i++) {
      this.crossoversL[i].updateFrequency(freqs[i], this.sr);
      this.crossoversR[i].updateFrequency(freqs[i], this.sr);
    }
  }

  _reset() {
    this.crossoversL.forEach(c => c.reset());
    this.crossoversR.forEach(c => c.reset());
    this.bandProcessorsL.forEach(p => p.reset());
    this.bandProcessorsR.forEach(p => p.reset());
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

    for (let n = 0; n < blockSize; n++) {
      // 1. Input gain
      const inGainLin = dbToLinear(this.inputGainSmoother.next());
      let sampleL = inL[n] * inGainLin;
      let sampleR = inR[n] * inGainLin;

      // Dry signal (delayed if lookahead)
      let dryL, dryR;
      if (this.lookaheadEnabled) {
        dryL = this.lookaheadL.readAndWrite(sampleL);
        dryR = this.lookaheadR.readAndWrite(sampleR);
      } else {
        dryL = sampleL;
        dryR = sampleR;
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

        let finalL = wetL;
        let finalR = wetR;
        if (this.deltaEnabled) { finalL -= dryL; finalR -= dryR; }
        if (this.softClipEnabled) {
          finalL = this.limiter.process(finalL);
          finalR = this.limiter.process(finalR);
        }
        const mix = this.mixSmoother.next();
        finalL = mix * finalL + (1 - mix) * dryL;
        finalR = mix * finalR + (1 - mix) * dryR;
        const outGainLin = dbToLinear(this.outputGainSmoother.next());
        outL[n] = finalL * outGainLin;
        outR[n] = finalR * outGainLin;
        continue;
      }

      // 2. Split into 5 bands through crossover chain
      // Topology: input → xover[0] → (LP=sub, HP → xover[1] → (LP=low, HP → xover[2] → (LP=lowMid, HP → xover[3] → (LP=highMid, HP=high))))
      const bandsL = new Float32Array(5);
      const bandsR = new Float32Array(5);

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
      let wetL = 0;
      let wetR = 0;
      for (let i = 0; i < 5; i++) {
        let bL = bandsL[i];
        let bR = bandsR[i];

        // Solo/bypass logic
        if (this.bypassState[i]) {
          // Bypass: pass through unprocessed
          wetL += bL;
          wetR += bR;
        } else if (anySoloed && !this.soloState[i]) {
          // Another band is soloed and this one isn't: mute
          // (still run through processor to keep state valid)
          this.bandProcessorsL[i].processSample(bL);
          this.bandProcessorsR[i].processSample(bR);
        } else {
          wetL += this.bandProcessorsL[i].processSample(bL);
          wetR += this.bandProcessorsR[i].processSample(bR);
        }

        // Accumulate peak for downsampled viz data
        if (this.vizView) {
          const absSample = Math.abs(bL);
          if (absSample > this.vizPeakAccum[i]) {
            this.vizPeakAccum[i] = absSample;
          }
          this.vizSampleCount[i]++;
          
          // Write downsampled peak when we've accumulated enough samples
          if (this.vizSampleCount[i] >= this.vizDownsampleFactor) {
            const bandOffset = i * (this.vizSamplesPerBand + 2);
            const wp = this.vizWritePos[i];
            this.vizView[bandOffset + wp] = this.vizPeakAccum[i];
            this.vizWritePos[i] = (wp + 1) % this.vizSamplesPerBand;
            this.vizView[bandOffset + this.vizSamplesPerBand] = this.vizWritePos[i];
            
            // Reset accumulators
            this.vizPeakAccum[i] = 0;
            this.vizSampleCount[i] = 0;
          }
        }
      }

      // 4. Soft limiter
      if (this.softClipEnabled) {
        wetL = this.limiter.process(wetL);
        wetR = this.limiter.process(wetR);
      }

      // 5. Delta mode (hear only processed difference)
      if (this.deltaEnabled) {
        wetL = wetL - dryL;
        wetR = wetR - dryR;
      }

      // 6. Wet/dry mix
      const mix = this.mixSmoother.next();
      let finalL = mix * wetL + (1 - mix) * dryL;
      let finalR = mix * wetR + (1 - mix) * dryR;

      // 7. Output gain
      const outGainLin = dbToLinear(this.outputGainSmoother.next());
      outL[n] = finalL * outGainLin;
      outR[n] = finalR * outGainLin;
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

    return true;
  }
}

registerProcessor('transient-shaper-processor', TransientShaperProcessor);
