// Phase 8 — DSP-to-UI parameter mapping reference

export const PARAMETER_RANGES = {
  bandAttack:     { min: -100, max: 100, unit: '%',    defaultValue: 0 },
  bandSustain:    { min: -100, max: 100, unit: '%',    defaultValue: 0 },
  // 0-100 scalars on the band's own base time constants (see effectiveTimeMs).
  bandAttackTime:  { min: 0,   max: 100, unit: '',     defaultValue: 50 },
  bandSustainTime: { min: 0,   max: 100, unit: '',     defaultValue: 50 },
  bandMix:        { min: 0,    max: 100, unit: '%',    defaultValue: 100 },
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

// Lookahead time the worklet applies when the toggle is on, in milliseconds.
// MUST match LOOKAHEAD_MS in public/dsp/transient-shaper-worklet.js — the
// worklet is served verbatim and cannot import from src/. Used to compensate
// the added latency when rendering an offline export.
export const LOOKAHEAD_MS = 3;

// Detection speed presets — multipliers on default time constants
export const DETECTION_SPEED_PRESETS = {
  slow:   { attackMultiplier: 2.0, releaseMultiplier: 2.0 },
  medium: { attackMultiplier: 1.0, releaseMultiplier: 1.0 },
  fast:   { attackMultiplier: 0.5, releaseMultiplier: 0.5 },
};

// Phase D7 — Detection method identifiers and display labels
export const DETECTION_METHODS = [
  'dual-envelope',
  'peak-rms',
  'derivative',
  'energy-flux',
];

export const DETECTION_METHOD_LABELS = {
  'dual-envelope': 'Dual Envelope',
  'peak-rms':      'Peak vs RMS',
  'derivative':    'Derivative',
  'energy-flux':   'Energy Flux',
};

/**
 * Effective envelope-follower time for a band, in milliseconds.
 *
 * Mirrors the worklet exactly (transient-shaper-worklet.js:513-519 and :769-771):
 *
 *   effectiveMs = baseMs * 2^((timeValue - 50) / 25) * speedMultiplier
 *
 * The 0-100 `attackTime` / `sustainTime` scalars are meaningless on their own —
 * a bare "50" tells the user nothing. Rendering the resulting milliseconds is
 * what makes the control legible, and it surfaces the per-band base times
 * (sub 5 ms through high 0.2 ms) for the first time.
 *
 * KEEP IN SYNC with the worklet.
 */
export function effectiveTimeMs(bandId, kind, timeValue, detectionSpeed = 'medium') {
  const base = BAND_TIME_DEFAULTS[bandId];
  if (!base) return null;
  const baseMs = kind === 'attack' ? base.attackMs : base.releaseMs;
  const scale = Math.pow(2, (timeValue - 50) / 25);   // 0.25x .. 4x
  // The worklet applies ONE multiplier to both attack and release. The two
  // entries in DETECTION_SPEED_PRESETS are equal, so this matches; if they ever
  // diverge, the worklet is the source of truth.
  const speed = DETECTION_SPEED_PRESETS[detectionSpeed]?.attackMultiplier ?? 1;
  return baseMs * scale * speed;
}

/** Format a millisecond value at a sensible precision for its magnitude. */
export function formatMs(ms) {
  if (ms == null) return '--';
  if (ms >= 100) return `${Math.round(ms)} ms`;
  if (ms >= 10) return `${ms.toFixed(1)} ms`;
  return `${ms.toFixed(2)} ms`;
}
