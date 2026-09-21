// Minimal AudioWorklet host so the real worklet can be exercised in Node.
//
// public/dsp/transient-shaper-worklet.js is served verbatim to the browser and
// cannot import from src/, so it is a classic script that calls
// registerProcessor() against globals the browser provides. We recreate just
// those globals in a vm sandbox and hand back the registered class. Nothing in
// the worklet is stubbed or duplicated — the tests run the shipping DSP.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WORKLET_PATH = path.join(HERE, '..', 'public', 'dsp', 'transient-shaper-worklet.js');

export const BLOCK_SIZE = 128;

class AudioWorkletProcessorShim {
  constructor() {
    this.port = {
      onmessage: null,
      postMessage: (data) => {
        this.port._sent.push(data);
      },
      _sent: [],
    };
  }
}

/** Load the shipping worklet and return its registered processor class. */
export function loadProcessorClass(sampleRate = 44100) {
  const source = fs.readFileSync(WORKLET_PATH, 'utf8');
  let Registered = null;

  const sandbox = {
    AudioWorkletProcessor: AudioWorkletProcessorShim,
    sampleRate,
    currentTime: 0,
    currentFrame: 0,
    registerProcessor: (_name, cls) => {
      Registered = cls;
    },
    console,
  };

  vm.runInNewContext(source, vm.createContext(sandbox), { filename: WORKLET_PATH });

  if (!Registered) throw new Error('worklet did not call registerProcessor()');
  return Registered;
}

/**
 * Render a stereo signal through the processor.
 *
 * @param {object}   opts
 * @param {Float64Array|Float32Array} opts.inputL
 * @param {Float64Array|Float32Array} [opts.inputR]  defaults to inputL (mono → dual mono)
 * @param {object}   [opts.params]      serialized state, same shape as serializeState()
 * @param {number}   [opts.sampleRate]
 * @param {object}   [opts.processorOptions]  extra processorOptions (fullbandMode etc.)
 * @returns {{ outL: Float64Array, outR: Float64Array, messages: object[] }}
 */
export function render({ inputL, inputR, params = {}, sampleRate = 44100, processorOptions = {} }) {
  const Processor = loadProcessorClass(sampleRate);
  const proc = new Processor({
    processorOptions: { initialParams: params, ...processorOptions },
  });

  const n = inputL.length;
  const right = inputR || inputL;
  const outL = new Float64Array(n);
  const outR = new Float64Array(n);

  const blkInL = new Float32Array(BLOCK_SIZE);
  const blkInR = new Float32Array(BLOCK_SIZE);
  const blkOutL = new Float32Array(BLOCK_SIZE);
  const blkOutR = new Float32Array(BLOCK_SIZE);
  const inputs = [[blkInL, blkInR]];
  const outputs = [[blkOutL, blkOutR]];

  for (let pos = 0; pos < n; pos += BLOCK_SIZE) {
    const count = Math.min(BLOCK_SIZE, n - pos);
    blkInL.fill(0);
    blkInR.fill(0);
    blkOutL.fill(0);
    blkOutR.fill(0);
    for (let i = 0; i < count; i++) {
      blkInL[i] = inputL[pos + i];
      blkInR[i] = right[pos + i];
    }
    proc.process(inputs, outputs);
    for (let i = 0; i < count; i++) {
      outL[pos + i] = blkOutL[i];
      outR[pos + i] = blkOutR[i];
    }
  }

  return { outL, outR, messages: proc.port._sent, proc };
}

/**
 * Render in the worklet's fullband capture mode and return the per-sample
 * detector signals it reports. Uses the worklet's own FINISH_CAPTURE path, so
 * the numbers are exactly what the shaper acted on.
 */
export function captureDetector({ inputL, params = {}, sampleRate = 44100 }) {
  const { proc, messages } = render({
    inputL,
    params,
    sampleRate,
    processorOptions: { fullbandMode: true, captureDetector: true },
  });
  proc.port.onmessage({ data: { type: 'FINISH_CAPTURE' } });
  const result = messages.find((m) => m.type === 'captureResult');
  if (!result) throw new Error('worklet posted no captureResult');
  return result;
}

// ── signal helpers ──────────────────────────────────────────────────────────

export function impulse(n, amplitude = 1) {
  const x = new Float64Array(n);
  x[0] = amplitude;
  return x;
}

export function sine(n, freq, sampleRate = 44100, amplitude = 1) {
  const x = new Float64Array(n);
  const w = (2 * Math.PI * freq) / sampleRate;
  for (let i = 0; i < n; i++) x[i] = amplitude * Math.sin(w * i);
  return x;
}

/** Deterministic pseudo-random noise so failures reproduce exactly. */
export function noise(n, amplitude = 1, seed = 12345) {
  const x = new Float64Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    x[i] = ((s / 0xffffffff) * 2 - 1) * amplitude;
  }
  return x;
}

/** Repeating click train — a crude stand-in for percussive transients. */
export function clickTrain(n, periodSamples, sampleRate = 44100, amplitude = 0.8) {
  const x = new Float64Array(n);
  const decay = Math.exp(-1 / (0.004 * sampleRate)); // ~4 ms tail
  let env = 0;
  for (let i = 0; i < n; i++) {
    if (i % periodSamples === 0) env = 1;
    x[i] = amplitude * env * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
    env *= decay;
  }
  return x;
}

// ── measurement helpers ─────────────────────────────────────────────────────

/** Magnitude of a signal at one frequency (single-bin DFT). */
export function magnitudeAt(signal, freq, sampleRate = 44100) {
  const w = (2 * Math.PI * freq) / sampleRate;
  let re = 0;
  let im = 0;
  for (let i = 0; i < signal.length; i++) {
    re += signal[i] * Math.cos(w * i);
    im -= signal[i] * Math.sin(w * i);
  }
  return Math.sqrt(re * re + im * im);
}

export function peak(signal) {
  let p = 0;
  for (let i = 0; i < signal.length; i++) {
    const a = Math.abs(signal[i]);
    if (a > p) p = a;
  }
  return p;
}

export function rms(signal) {
  let acc = 0;
  for (let i = 0; i < signal.length; i++) acc += signal[i] * signal[i];
  return Math.sqrt(acc / Math.max(signal.length, 1));
}

export function toDb(linear) {
  return 20 * Math.log10(Math.max(linear, 1e-20));
}

export function allFinite(signal) {
  for (let i = 0; i < signal.length; i++) {
    if (!Number.isFinite(signal[i])) return false;
  }
  return true;
}
