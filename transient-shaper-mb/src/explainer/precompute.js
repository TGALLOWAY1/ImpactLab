// Offline pre-render of the explainer worklet. For each scene variant we
// produce the raw input samples, the detector attack/sustain envelopes, and
// the processed output samples — by running the existing worklet inside an
// OfflineAudioContext with the fullbandMode + captureDetector flags set.

import { downsamplePeaks, detectHits, computeHitWindows } from './hits';

const PEAK_BUCKETS = 2000;

function makeFullbandParams(attack, sustain) {
  return {
    inputGain: 0,
    outputGain: 0,
    mix: 100,
    detectionSpeed: 'medium',
    detectionMethod: 'dual-envelope',
    lookahead: false,
    softClip: false,
    delta: false,
    crossoverFreqs: [80, 500, 2500, 8000],
    bands: {
      sub:        { attack: 0, sustain: 0, outputGain: 0, attackTime: 50, sustainTime: 50, bypass: false, solo: false },
      low:        { attack: 0, sustain: 0, outputGain: 0, attackTime: 50, sustainTime: 50, bypass: false, solo: false },
      'low-mid':  { attack,     sustain,    outputGain: 0, attackTime: 50, sustainTime: 50, bypass: false, solo: false },
      'high-mid': { attack: 0, sustain: 0, outputGain: 0, attackTime: 50, sustainTime: 50, bypass: false, solo: false },
      high:       { attack: 0, sustain: 0, outputGain: 0, attackTime: 50, sustainTime: 50, bypass: false, solo: false },
    },
  };
}

// Run one offline render and return the raw arrays (input/attack/sustain/output)
// plus the rendered AudioBuffer suitable for playback.
async function renderVariant(inputBuffer, attack, sustain) {
  const numChannels = inputBuffer.numberOfChannels;
  const length = inputBuffer.length;
  const sampleRate = inputBuffer.sampleRate;

  const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
  await offlineCtx.audioWorklet.addModule('/dsp/transient-shaper-worklet.js');

  const workletNode = new AudioWorkletNode(offlineCtx, 'transient-shaper-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [numChannels],
    processorOptions: {
      fullbandMode: true,
      captureDetector: true,
      initialParams: makeFullbandParams(attack, sustain),
    },
  });

  const capturePromise = new Promise((resolve) => {
    workletNode.port.onmessage = (e) => {
      if (e.data && e.data.type === 'captureResult') resolve(e.data);
    };
  });

  const source = offlineCtx.createBufferSource();
  source.buffer = inputBuffer;
  source.connect(workletNode);
  workletNode.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  workletNode.port.postMessage({ type: 'FINISH_CAPTURE' });
  const { attack: attackArr, sustain: sustainArr, input: inputArr, output: outputArr } = await capturePromise;

  return { renderedBuffer, attackArr, sustainArr, inputArr, outputArr, sampleRate };
}

// Public: pre-render a scene variant and return everything the UI needs to
// draw a single frame of that variant at any playhead position.
export async function prerenderVariant({ inputBuffer, attack, sustain }) {
  const { renderedBuffer, attackArr, sustainArr, inputArr, outputArr, sampleRate } =
    await renderVariant(inputBuffer, attack, sustain);

  const inputPeaks = downsamplePeaks(inputArr, PEAK_BUCKETS);
  const detectorPeaks = downsamplePeaks(attackArr, PEAK_BUCKETS);
  const outputPeaks = downsamplePeaks(outputArr, PEAK_BUCKETS);

  // Derive hit markers + per-hit windows from the full-resolution attack array,
  // then translate the sample indices into peak-bucket indices so the UI can
  // draw triangles and color regions without referencing raw samples.
  const hits = detectHits(attackArr, { sampleRate });
  const windows = computeHitWindows(hits, attackArr, sampleRate);
  const toBucket = (i) => Math.round((i / attackArr.length) * PEAK_BUCKETS);
  const hitsBucketed = windows.map((w) => ({
    center: toBucket(w.index),
    attackStart: toBucket(w.attackStart),
    attackEnd: toBucket(w.attackEnd),
    sustainEnd: toBucket(w.sustainEnd),
    strength: w.strength,
  }));

  return {
    attack,
    sustain,
    inputPeaks,
    detectorPeaks,
    outputPeaks,
    hits: hitsBucketed,
    renderedBuffer,
    totalSamples: inputArr.length,
    sampleRate,
    bucketCount: PEAK_BUCKETS,
  };
}

// Given a scene (with paramKeyframes or static params), return the set of
// discrete (attack, sustain) points we need to pre-render and crossfade
// between. For static params: 1 variant. For keyframed: N steps sampled
// uniformly across the scene duration.
export function variantKeysForScene(scene, steps = 5) {
  if (scene.paramKeyframes && scene.paramKeyframes.length > 1) {
    const keys = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / (steps - 1)) * scene.duration;
      keys.push({ t, ...sampleKeyframes(scene.paramKeyframes, t) });
    }
    return dedupeByParams(keys);
  }
  const p = scene.params || { attack: 0, sustain: 0 };
  return [{ t: 0, attack: p.attack || 0, sustain: p.sustain || 0 }];
}

export function sampleKeyframes(keyframes, t) {
  if (t <= keyframes[0].t) return { attack: keyframes[0].attack, sustain: keyframes[0].sustain };
  const last = keyframes[keyframes.length - 1];
  if (t >= last.t) return { attack: last.attack, sustain: last.sustain };
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i], b = keyframes[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return {
        attack: a.attack + (b.attack - a.attack) * f,
        sustain: a.sustain + (b.sustain - a.sustain) * f,
      };
    }
  }
  return { attack: last.attack, sustain: last.sustain };
}

function dedupeByParams(keys) {
  const seen = new Map();
  for (const k of keys) {
    const id = `${Math.round(k.attack)}|${Math.round(k.sustain)}`;
    if (!seen.has(id)) seen.set(id, { ...k, attack: Math.round(k.attack), sustain: Math.round(k.sustain) });
  }
  return Array.from(seen.values()).sort((a, b) => a.t - b.t);
}
