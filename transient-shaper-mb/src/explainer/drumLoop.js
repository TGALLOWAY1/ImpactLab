// Drum loop source. Prefers a file at /samples/drum-loop.wav if one is
// bundled; otherwise synthesizes a clean 2-bar, 120 BPM kick/snare/hat
// pattern so the explainer works out of the box.

async function tryFetchBundledLoop(audioCtx) {
  try {
    const res = await fetch('/samples/drum-loop.wav');
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    // Dev servers sometimes return index.html for missing files. Guard.
    if (type.startsWith('text/html')) return null;
    const arr = await res.arrayBuffer();
    if (arr.byteLength < 100) return null;
    return await audioCtx.decodeAudioData(arr);
  } catch {
    return null;
  }
}

function synthesizeDrumLoop(audioCtx) {
  const sr = audioCtx.sampleRate;
  const bpm = 120;
  const beatSec = 60 / bpm;
  const stepsPerBar = 8; // 8th-notes
  const bars = 2;
  const totalSteps = stepsPerBar * bars;
  const stepSec = beatSec / 2;
  const totalSec = totalSteps * stepSec;
  const totalSamples = Math.ceil(totalSec * sr);

  const buffer = audioCtx.createBuffer(1, totalSamples, sr);
  const out = buffer.getChannelData(0);

  // Kick on step 0 and 8 (beat 1 and 3 of each bar)
  const kickSteps  = [0, 8];
  // Snare on step 4 and 12 (backbeat)
  const snareSteps = [4, 12];
  // Hi-hat on every even step; slightly quieter on beat 1 to leave room
  const hatSteps   = [0, 2, 4, 6, 8, 10, 12, 14];

  function mixIn(dst, startSample, src, gain) {
    for (let i = 0; i < src.length && startSample + i < dst.length; i++) {
      dst[startSample + i] += src[i] * gain;
    }
  }

  for (const s of kickSteps) mixIn(out, Math.round(s * stepSec * sr), synthKick(sr), 0.95);
  for (const s of snareSteps) mixIn(out, Math.round(s * stepSec * sr), synthSnare(sr), 0.7);
  for (const s of hatSteps) {
    const amp = (s === 0) ? 0.18 : 0.25;
    mixIn(out, Math.round(s * stepSec * sr), synthHat(sr), amp);
  }

  // Normalize to leave a little headroom
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) {
    const g = 0.85 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g;
  }
  return buffer;
}

// 60 Hz sine with exponential pitch sweep and amplitude envelope → punchy kick.
function synthKick(sr) {
  const durSec = 0.35;
  const n = Math.floor(durSec * sr);
  const out = new Float32Array(n);
  const fStart = 120, fEnd = 42;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = fEnd + (fStart - fEnd) * Math.exp(-t / 0.04);
    phase += (2 * Math.PI * f) / sr;
    const env = Math.exp(-t / 0.08);
    const click = Math.exp(-t / 0.002) * 0.4; // initial transient
    out[i] = (Math.sin(phase) * env) + click;
  }
  return out;
}

// Noise burst + tuned sine body, short decay.
function synthSnare(sr) {
  const durSec = 0.22;
  const n = Math.floor(durSec * sr);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noise = (Math.random() * 2 - 1);
    lp = lp * 0.5 + noise * 0.5; // gentle LP to soften
    const env = Math.exp(-t / 0.07);
    const tone = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t / 0.03) * 0.35;
    out[i] = (noise * 0.8 + lp * 0.2) * env + tone;
  }
  return out;
}

// Filtered noise burst for hi-hat, very short decay.
function synthHat(sr) {
  const durSec = 0.06;
  const n = Math.floor(durSec * sr);
  const out = new Float32Array(n);
  let hp = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noise = (Math.random() * 2 - 1);
    hp = 0.92 * (hp + noise - prev); // first-order HP
    prev = noise;
    const env = Math.exp(-t / 0.018);
    out[i] = hp * env;
  }
  return out;
}

export async function loadOrSynthDrumLoop(audioCtx) {
  const bundled = await tryFetchBundledLoop(audioCtx);
  if (bundled) return { buffer: bundled, source: 'bundled' };
  return { buffer: synthesizeDrumLoop(audioCtx), source: 'synth' };
}
