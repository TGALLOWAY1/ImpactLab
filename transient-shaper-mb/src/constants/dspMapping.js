// Phase 8 — DSP-to-UI parameter mapping reference

export const PARAMETER_RANGES = {
  bandAttack:     { min: -100, max: 100, unit: '%',    defaultValue: 0 },
  bandSustain:    { min: -100, max: 100, unit: '%',    defaultValue: 0 },
  bandOutputGain: { min: -30,  max: 6,   unit: 'dB',   defaultValue: 0 },
  inputGain:      { min: -30,  max: 12,  unit: 'dB',   defaultValue: 0 },
  outputGain:     { min: -30,  max: 12,  unit: 'dB',   defaultValue: 0 },
  mix:            { min: 0,    max: 100, unit: '%',    defaultValue: 100 },
  crossoverFreq:  { min: 20,   max: 20000, unit: 'Hz', defaultValue: null },
};

// Per-band default envelope follower time constants
export const BAND_TIME_DEFAULTS = {
  sub:      { attackMs: 5,   releaseMs: 200, sidechainHpf: 80 },
  low:      { attackMs: 2,   releaseMs: 150, sidechainHpf: 40 },
  "low-mid":  { attackMs: 1,   releaseMs: 100, sidechainHpf: null },
  "high-mid": { attackMs: 0.5, releaseMs: 50,  sidechainHpf: null },
  high:     { attackMs: 0.2, releaseMs: 30,  sidechainHpf: null },
};

// Detection speed presets — multipliers on default time constants
export const DETECTION_SPEED_PRESETS = {
  slow:   { attackMultiplier: 2.0, releaseMultiplier: 2.0 },
  medium: { attackMultiplier: 1.0, releaseMultiplier: 1.0 },
  fast:   { attackMultiplier: 0.5, releaseMultiplier: 0.5 },
};
