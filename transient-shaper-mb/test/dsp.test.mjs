// DSP regression tests for the shipping AudioWorklet.
//
// These exist to hold the properties a multiband shaper has to have and that
// are easy to break silently: the band bank must sum flat, the dry path must
// null against it, solo and bypass must mean what they say, and silence must
// not be shaped. Run with `npm test`.

import {
  render,
  impulse,
  sine,
  noise,
  clickTrain,
  captureDetector,
  magnitudeAt,
  peak,
  rms,
  toDb,
  allFinite,
} from './worklet-host.mjs';

const SR = 44100;
const BAND_IDS = ['sub', 'low', 'low-mid', 'high-mid', 'high'];

const DEFAULT_BAND = {
  attack: 0,
  attackTime: 50,
  sustain: 0,
  sustainTime: 50,
  mix: 100,
  outputGain: 0,
  solo: false,
  bypass: false,
};

/** Build a params object matching serializeState(), with overrides applied. */
function params({ bands = {}, ...global } = {}) {
  const bandState = {};
  for (const id of BAND_IDS) {
    bandState[id] = { ...DEFAULT_BAND, ...(bands[id] || {}) };
  }
  return {
    inputGain: 0,
    outputGain: 0,
    mix: 100,
    detectionSpeed: 'medium',
    softClip: false,
    lookahead: false,
    delta: false,
    globalBypass: false,
    crossoverFreqs: [80, 500, 2500, 8000],
    detectionMethod: 'dual-envelope',
    ...global,
    bands: bandState,
  };
}

const PROBE_FREQS = [
  20, 30, 40, 60, 80, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500,
  2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 16000, 20000,
];

/** Worst deviation from 0 dB of the impulse response, across PROBE_FREQS. */
function worstRippleDb(outL) {
  let worst = 0;
  let worstFreq = 0;
  for (const f of PROBE_FREQS) {
    const db = toDb(magnitudeAt(outL, f, SR));
    if (Math.abs(db) > Math.abs(worst)) {
      worst = db;
      worstFreq = f;
    }
  }
  return { worst, worstFreq };
}

function measureFlatness(p) {
  const n = 1 << 15;
  const { outL } = render({ inputL: impulse(n), params: p, sampleRate: SR });
  return worstRippleDb(outL);
}

export const tests = [
  {
    name: 'band bank sums flat at default crossover points',
    run: (t) => {
      const { worst, worstFreq } = measureFlatness(params());
      t.detail(`worst ${worst.toFixed(4)} dB at ${worstFreq} Hz`);
      t.assert(
        Math.abs(worst) < 0.05,
        `expected < 0.05 dB ripple, got ${worst.toFixed(4)} dB at ${worstFreq} Hz`,
      );
    },
  },
  {
    name: 'band bank sums flat at user-dragged crossover points',
    run: (t) => {
      const { worst, worstFreq } = measureFlatness(
        params({ crossoverFreqs: [45, 320, 1400, 6500] }),
      );
      t.detail(`worst ${worst.toFixed(4)} dB at ${worstFreq} Hz`);
      t.assert(
        Math.abs(worst) < 0.05,
        `expected < 0.05 dB ripple, got ${worst.toFixed(4)} dB at ${worstFreq} Hz`,
      );
    },
  },
  {
    name: 'band bank sums flat with a band bypassed',
    run: (t) => {
      const { worst, worstFreq } = measureFlatness(
        params({ bands: { low: { bypass: true } } }),
      );
      t.detail(`worst ${worst.toFixed(4)} dB at ${worstFreq} Hz`);
      t.assert(
        Math.abs(worst) < 0.05,
        `expected < 0.05 dB ripple, got ${worst.toFixed(4)} dB at ${worstFreq} Hz`,
      );
    },
  },
  {
    name: 'Delta nulls to silence when no band is shaping',
    run: (t) => {
      const n = 1 << 14;
      const { outL } = render({
        inputL: noise(n, 0.5),
        params: params({ delta: true }),
        sampleRate: SR,
      });
      const db = toDb(peak(outL));
      t.detail(`residual peak ${db.toFixed(1)} dBFS`);
      t.assert(db < -70, `expected residual below -70 dBFS, got ${db.toFixed(1)}`);
    },
  },
  {
    name: 'Delta still nulls with Lookahead engaged',
    run: (t) => {
      const n = 1 << 14;
      const { outL } = render({
        inputL: noise(n, 0.5),
        params: params({ delta: true, lookahead: true }),
        sampleRate: SR,
      });
      const db = toDb(peak(outL));
      t.detail(`residual peak ${db.toFixed(1)} dBFS`);
      t.assert(db < -70, `expected residual below -70 dBFS, got ${db.toFixed(1)}`);
    },
  },
  {
    name: 'Mix at 50% stays flat (wet and dry are phase-aligned)',
    run: (t) => {
      const { worst, worstFreq } = measureFlatness(params({ mix: 50 }));
      t.detail(`worst ${worst.toFixed(4)} dB at ${worstFreq} Hz`);
      t.assert(
        Math.abs(worst) < 0.05,
        `expected < 0.05 dB ripple, got ${worst.toFixed(4)} dB at ${worstFreq} Hz`,
      );
    },
  },
  {
    name: 'solo silences a bypassed band',
    run: (t) => {
      const n = 1 << 14;
      const input = sine(n, 40, SR, 0.5);
      const { outL } = render({
        inputL: input,
        params: params({
          bands: { sub: { bypass: true }, high: { solo: true } },
        }),
        sampleRate: SR,
      });
      // Ignore the filter settling transient at the start of the render.
      const tail = outL.slice(n >> 1);
      const leak = toDb(rms(tail)) - toDb(rms(input));
      t.detail(`sub-band leakage ${leak.toFixed(1)} dB below input`);
      t.assert(leak < -40, `expected leakage below -40 dB, got ${leak.toFixed(1)} dB`);
    },
  },
  {
    // Crest- and flux-based detection divides one envelope by another. Fed
    // digital silence, both collapse to their denormal floors and the quotient
    // stops meaning anything — the detectors settle on a large sustain reading
    // with no signal present at all, which is backwards: a sustain control
    // should read highest in the body of a note, not in the gaps between them.
    name: 'detectors report nothing on digital silence',
    run: (t) => {
      const quiet = new Float64Array(Math.round(0.25 * SR)); // all zeros
      for (const method of ['dual-envelope', 'peak-rms', 'derivative', 'energy-flux']) {
        const { attack, sustain } = captureDetector({
          inputL: quiet,
          params: params({ detectionMethod: method }),
          sampleRate: SR,
        });
        const maxAttack = peak(attack);
        const maxSustain = peak(sustain);
        t.detail(`${method}: attack ${maxAttack.toFixed(3)}, sustain ${maxSustain.toFixed(3)}`);
        t.assert(
          maxAttack < 0.01 && maxSustain < 0.01,
          `${method} reported attack ${maxAttack.toFixed(3)} / sustain ${maxSustain.toFixed(3)} on silence`,
        );
      }
    },
  },
  {
    name: 'presence gate keys on level, not on content',
    run: (t) => {
      // Same material at two levels. The gate must let the program-level
      // version through to the detectors and mute the near-silent one, so a
      // regression that over-reaches (gating real audio) fails here while a
      // regression that under-reaches fails the test above.
      const n = 1 << 14;
      const shaped = Object.fromEntries(BAND_IDS.map((id) => [id, { sustain: 100 }]));
      const reportedGain = (amplitude) => {
        const { messages } = render({
          inputL: clickTrain(n, 4410, SR, amplitude),
          params: params({ bands: shaped }),
          sampleRate: SR,
        });
        const meters = messages.filter((m) => m.type === 'meters');
        return Math.max(...meters.map((m) => Math.abs(m.gainDb)), 0);
      };
      const loud = reportedGain(0.5); // -6 dBFS
      const quiet = reportedGain(5e-6); // -106 dBFS
      t.detail(`program level ${loud.toFixed(2)} dB, near-silence ${quiet.toFixed(2)} dB`);
      t.assert(loud > 1.0, `expected detection at program level, got ${loud.toFixed(2)} dB`);
      t.assert(quiet < 0.1, `expected no detection near silence, got ${quiet.toFixed(2)} dB`);
    },
  },
  {
    name: 'meters report transient boost, not only reduction',
    run: (t) => {
      const n = 1 << 14;
      const { messages } = render({
        inputL: clickTrain(n, 4410, SR),
        params: params({
          bands: Object.fromEntries(BAND_IDS.map((id) => [id, { attack: 100 }])),
        }),
        sampleRate: SR,
      });
      const meters = messages.filter((m) => m.type === 'meters');
      const maxGain = Math.max(...meters.map((m) => m.gainDb), -Infinity);
      t.detail(`peak reported gain ${maxGain.toFixed(2)} dB over ${meters.length} posts`);
      t.assert(meters.length > 0, 'expected at least one meter post');
      t.assert(maxGain > 1.0, `expected a positive gain reading, got ${maxGain.toFixed(2)} dB`);
    },
  },
  {
    name: 'Soft Clip guards the real output, after output gain',
    run: (t) => {
      const n = 1 << 13;
      const { outL } = render({
        inputL: sine(n, 220, SR, 0.9),
        params: params({ softClip: true, outputGain: 12 }),
        sampleRate: SR,
      });
      const p = peak(outL.slice(n >> 1));
      t.detail(`output peak ${p.toFixed(3)} (${toDb(p).toFixed(2)} dBFS)`);
      t.assert(p <= 1.0001, `expected output at or below full scale, got ${p.toFixed(3)}`);
    },
  },
  {
    name: 'out-of-range crossover frequencies are clamped, not fatal',
    run: (t) => {
      const n = 1 << 12;
      const { outL } = render({
        inputL: noise(n, 0.5),
        params: params({ crossoverFreqs: [80000, -12, NaN, 8000] }),
        sampleRate: SR,
      });
      t.detail(`output peak ${toDb(peak(outL)).toFixed(1)} dBFS`);
      t.assert(allFinite(outL), 'output contained NaN or Infinity');
      t.assert(peak(outL) < 10, 'output blew up past a sane level');
    },
  },
  {
    name: 'global bypass passes the input through unchanged',
    run: (t) => {
      const n = 1 << 13;
      const input = noise(n, 0.5);
      const { outL } = render({
        inputL: input,
        params: params({
          globalBypass: true,
          bands: Object.fromEntries(BAND_IDS.map((id) => [id, { attack: 100, sustain: -100 }])),
        }),
        sampleRate: SR,
      });
      let worst = 0;
      for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(outL[i] - input[i]));
      t.detail(`max sample error ${toDb(worst).toFixed(1)} dB`);
      t.assert(toDb(worst) < -80, `expected a true bypass, max error ${toDb(worst).toFixed(1)} dB`);
    },
  },
];
