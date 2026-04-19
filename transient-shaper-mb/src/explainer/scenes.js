// Declarative timeline for the explainer video. Each scene runs the drum
// loop with a given (attack, sustain) setting (or keyframe-interpolated).
// Rows fade in according to showRows / rowReveal.

export const SCENES = [
  {
    id: 'intro',
    duration: 6.0,
    title: 'A drum loop',
    subtitle: 'Listen to the beat',
    params: { attack: 0, sustain: 0 },
    audio: 'dry',
    showRows: [1],
  },
  {
    id: 'reveal-detector',
    duration: 6.0,
    title: 'Detecting the transients',
    subtitle: 'Each marker is the start of a drum hit',
    params: { attack: 0, sustain: 0 },
    audio: 'dry',
    showRows: [1, 2],
    rowReveal: { 2: { from: 0.0, to: 1.5 } },
  },
  {
    id: 'attack-up',
    duration: 9.0,
    title: 'Boosting attack — punchier',
    subtitle: 'The hits get sharper and louder',
    audio: 'ab-toggle',
    showRows: [1, 2, 3],
    paramKeyframes: [
      { t: 0.0, attack:   0, sustain: 0 },
      { t: 2.5, attack:  80, sustain: 0 },
      { t: 9.0, attack:  80, sustain: 0 },
    ],
  },
  {
    id: 'attack-down',
    duration: 9.0,
    title: 'Cutting attack — softer',
    subtitle: 'The hits become gentler',
    audio: 'ab-toggle',
    showRows: [1, 2, 3],
    paramKeyframes: [
      { t: 0.0, attack:   0, sustain: 0 },
      { t: 2.5, attack: -80, sustain: 0 },
      { t: 9.0, attack: -80, sustain: 0 },
    ],
  },
  {
    id: 'sustain-up',
    duration: 9.0,
    title: 'Boosting sustain — more body',
    subtitle: 'Tails ring out longer',
    audio: 'ab-toggle',
    showRows: [1, 2, 3],
    paramKeyframes: [
      { t: 0.0, attack: 0, sustain:   0 },
      { t: 2.5, attack: 0, sustain:  70 },
      { t: 9.0, attack: 0, sustain:  70 },
    ],
  },
  {
    id: 'sustain-down',
    duration: 9.0,
    title: 'Cutting sustain — tighter',
    subtitle: 'Tails are trimmed off',
    audio: 'ab-toggle',
    showRows: [1, 2, 3],
    paramKeyframes: [
      { t: 0.0, attack: 0, sustain:   0 },
      { t: 2.5, attack: 0, sustain: -70 },
      { t: 9.0, attack: 0, sustain: -70 },
    ],
  },
  {
    id: 'finale',
    duration: 8.0,
    title: 'Punch + body together',
    subtitle: 'Attack up, sustain up',
    params: { attack: 50, sustain: 35 },
    audio: 'ab-toggle',
    showRows: [1, 2, 3],
  },
];

export const TOTAL_DURATION = SCENES.reduce((s, sc) => s + sc.duration, 0);
