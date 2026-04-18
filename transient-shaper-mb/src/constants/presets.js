// Curated starting-point presets for common mixing scenarios.
// A preset is a partial state — any field that is omitted keeps its current value
// from DEFAULT_BAND_STATE / DEFAULT_GLOBAL_STATE at load time.
//
// Band order: sub, low, low-mid, high-mid, high.

import { DEFAULT_BAND_STATE, DEFAULT_GLOBAL_STATE } from './defaults';
import { BANDS } from './bands';

function band(overrides = {}) {
  return { ...DEFAULT_BAND_STATE, ...overrides };
}

function makePreset({ name, description, bands, global = {} }) {
  const bandState = {};
  BANDS.forEach((b, i) => {
    bandState[b.id] = band(bands[i] || {});
  });
  return {
    name,
    description,
    state: {
      bands: bandState,
      global: { ...DEFAULT_GLOBAL_STATE, ...global },
    },
  };
}

export const PRESETS = [
  makePreset({
    name: 'Default',
    description: 'Flat — all bands at 0.',
    bands: [{}, {}, {}, {}, {}],
  }),
  makePreset({
    name: 'Drums — Punch',
    description: 'Add attack to kick, snare and top-end snap.',
    bands: [
      { attack: 25, sustain: -5 },
      { attack: 45, sustain: -10, attackTime: 40 },
      { attack: 30, sustain: 0 },
      { attack: 35, sustain: -5, attackTime: 35 },
      { attack: 20 },
    ],
    global: { detectionSpeed: 'fast' },
  }),
  makePreset({
    name: 'Drums — Tighten',
    description: 'Cut sustain to dry up kit and control room tone.',
    bands: [
      { sustain: -30 },
      { sustain: -40, sustainTime: 40 },
      { sustain: -30 },
      { sustain: -20 },
      { sustain: -15 },
    ],
    global: { detectionSpeed: 'medium' },
  }),
  makePreset({
    name: 'Bass — Tighten',
    description: 'Focus on low-mids to remove flabby sustain.',
    bands: [
      { sustain: -20, attack: 10 },
      { sustain: -30, attack: 15, attackTime: 55 },
      { sustain: -15, attack: 10 },
      {},
      {},
    ],
    global: { detectionSpeed: 'medium' },
  }),
  makePreset({
    name: 'Vocals — Presence',
    description: 'Lift consonants without harshness.',
    bands: [
      {},
      {},
      { attack: 15 },
      { attack: 25, attackTime: 40 },
      { attack: 20, sustain: -10 },
    ],
    global: { detectionSpeed: 'fast' },
  }),
  makePreset({
    name: 'Master — Glue',
    description: 'Gentle multiband shaping for a mix bus.',
    bands: [
      { attack: 10, sustain: 5 },
      { attack: 8, sustain: 5 },
      { attack: 6, sustain: 5 },
      { attack: 8, sustain: 5 },
      { attack: 10, sustain: 5 },
    ],
    global: { detectionSpeed: 'medium', softClip: true, mix: 80 },
  }),
  makePreset({
    name: 'Loop — Tame',
    description: 'Smooth aggressive sample loops without dulling them.',
    bands: [
      { sustain: -10 },
      { attack: -15, sustain: -20 },
      { attack: -10, sustain: -15 },
      { attack: -10, sustain: -10 },
      { sustain: -10 },
    ],
    global: { detectionSpeed: 'slow' },
  }),
];

export const DEFAULT_PRESET_NAME = 'Default';
