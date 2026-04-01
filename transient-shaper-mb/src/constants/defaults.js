import { BANDS } from './bands';

// Phase 0.2 — Per-band state shape
export const DEFAULT_BAND_STATE = {
  attack: 0,        // -100 to +100 (percentage, bipolar)
  sustain: 0,       // -100 to +100
  outputGain: 0,    // -30 to +6 dB
  solo: false,
  bypass: false,
};

// Phase 0.3 — Global state shape
export const DEFAULT_GLOBAL_STATE = {
  inputGain: 0,             // -30 to +12 dB
  outputGain: 0,            // -30 to +12 dB
  mix: 100,                 // 0-100% (dry/wet)
  detectionSpeed: "medium", // "slow" | "medium" | "fast"
  transientMode: "punch",   // "punch" | "snap" | "smooth"
  multibandLink: true,
  softClip: false,
  lookahead: false,
  delta: false,
  crossoverFreqs: [80, 500, 2500, 8000], // Hz — 4 points for 5 bands
};

// Initial state combining bands + globals
export function createInitialState() {
  const bands = {};
  for (const band of BANDS) {
    bands[band.id] = { ...DEFAULT_BAND_STATE };
  }
  return {
    bands,
    global: { ...DEFAULT_GLOBAL_STATE },
  };
}
