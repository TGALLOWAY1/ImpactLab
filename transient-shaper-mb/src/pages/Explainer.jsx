import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SCENES, TOTAL_DURATION } from '../explainer/scenes';
import { prerenderVariant, variantKeysForScene, sampleKeyframes } from '../explainer/precompute';
import { loadOrSynthDrumLoop } from '../explainer/drumLoop';
import {
  CANVAS_W, CANVAS_H, LAYOUT,
  clearBackground, drawHeader, drawInputRow, drawDetectorRow, drawOutputRow,
  drawKnobHUD, drawSparkle,
} from '../explainer/draw';

// Blend two peak arrays by factor f (0 = a, 1 = b). Both inputs should have
// the same bucket count.
function blendPeaks(a, b, f) {
  const n = a.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i] * (1 - f) + b[i] * f;
  return out;
}

// Find the two variants in a scene whose (t) bracket localTime, plus the
// interpolation factor. Variants are sorted by t.
function pickBlend(variants, localTime) {
  if (variants.length === 1) return { a: variants[0], b: variants[0], f: 0 };
  if (localTime <= variants[0].t) return { a: variants[0], b: variants[0], f: 0 };
  const last = variants[variants.length - 1];
  if (localTime >= last.t) return { a: last, b: last, f: 0 };
  for (let i = 0; i < variants.length - 1; i++) {
    const v1 = variants[i], v2 = variants[i + 1];
    if (localTime >= v1.t && localTime <= v2.t) {
      const f = (localTime - v1.t) / Math.max(1e-6, v2.t - v1.t);
      return { a: v1, b: v2, f };
    }
  }
  return { a: last, b: last, f: 0 };
}

function currentSceneAt(globalTime) {
  let acc = 0;
  for (let i = 0; i < SCENES.length; i++) {
    const d = SCENES[i].duration;
    if (globalTime < acc + d) return { sceneIndex: i, localTime: globalTime - acc };
    acc += d;
  }
  const last = SCENES.length - 1;
  return { sceneIndex: last, localTime: SCENES[last].duration };
}

function currentParams(scene, localTime) {
  if (scene.paramKeyframes) return sampleKeyframes(scene.paramKeyframes, localTime);
  return { attack: scene.params?.attack || 0, sustain: scene.params?.sustain || 0 };
}

function rowRevealAlpha(scene, rowN, localTime) {
  if (!scene.showRows?.includes(rowN)) return 0;
  const r = scene.rowReveal?.[rowN];
  if (!r) return 1;
  if (localTime <= r.from) return 0;
  if (localTime >= r.to) return 1;
  return (localTime - r.from) / (r.to - r.from);
}

// Equal-power crossfade gain for dry/wet A/B toggle.
function abGains(mode, globalTime) {
  if (mode === 'dry') return { dry: 1, wet: 0 };
  if (mode === 'wet') return { dry: 0, wet: 1 };
  if (mode === 'ab-toggle') {
    const period = 4.0; // 2s wet, 2s dry
    const phase = ((globalTime % period) / period) * Math.PI * 2;
    const f = 0.5 + 0.5 * Math.sin(phase);
    return { dry: Math.cos(f * Math.PI / 2), wet: Math.sin(f * Math.PI / 2) };
  }
  return { dry: 1, wet: 0 };
}

export default function Explainer() {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('Loading drum loop...');
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  // Pre-render state
  const audioCtxRef = useRef(null);
  const inputBufferRef = useRef(null);
  const scenesVariantsRef = useRef(null); // per scene: { variants: [{t, attack, sustain, ...peaks}], audioBuffer }
  const loopSecondsRef = useRef(0);

  // Playback state
  const playStartTimeRef = useRef(0); // audioCtx.currentTime when play began
  const rafRef = useRef(0);
  const drySrcRef = useRef(null);
  const wetSrcRef = useRef(null);
  const dryGainRef = useRef(null);
  const wetGainRef = useRef(null);
  const currentSceneIndexRef = useRef(-1);
  const mediaDestRef = useRef(null); // MediaStreamAudioDestinationNode
  const recorderRef = useRef(null);

  // 1) Bootstrap: load drum loop, pre-render every scene variant.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 44100 });
      audioCtxRef.current = ctx;
      const mediaDest = ctx.createMediaStreamDestination();
      mediaDestRef.current = mediaDest;

      setStatus('Loading drum loop...');
      const { buffer: inputBuffer, source } = await loadOrSynthDrumLoop(ctx);
      if (cancelled) return;
      inputBufferRef.current = inputBuffer;
      loopSecondsRef.current = inputBuffer.duration;
      setStatus(`Drum loop ready (${source}). Pre-rendering scenes...`);

      // Pre-render: collect unique (attack, sustain) keys across all scenes to
      // avoid re-running the same render twice.
      const allKeys = [];
      for (const scene of SCENES) {
        const keys = variantKeysForScene(scene, 5);
        allKeys.push({ scene, keys });
      }

      const uniqueKeys = new Map();
      for (const { keys } of allKeys) {
        for (const k of keys) {
          const id = `${k.attack}|${k.sustain}`;
          uniqueKeys.set(id, { attack: k.attack, sustain: k.sustain });
        }
      }
      // Always include (0,0) for dry audio
      if (!uniqueKeys.has('0|0')) uniqueKeys.set('0|0', { attack: 0, sustain: 0 });

      const renderedByKey = new Map();
      let done = 0;
      for (const [id, { attack, sustain }] of uniqueKeys.entries()) {
        if (cancelled) return;
        const v = await prerenderVariant({ inputBuffer, attack, sustain });
        renderedByKey.set(id, v);
        done++;
        setStatus(`Pre-rendering... ${done}/${uniqueKeys.size}`);
      }

      // Build per-scene variant lists
      const scenesVariants = allKeys.map(({ scene, keys }) => {
        const variants = keys.map((k) => {
          const id = `${k.attack}|${k.sustain}`;
          const r = renderedByKey.get(id);
          return { t: k.t, attack: k.attack, sustain: k.sustain, ...r };
        });
        // Audio variant: the one with max |attack|+|sustain| (most "dramatic")
        let audioVariant = variants[0];
        for (const v of variants) {
          if (Math.abs(v.attack) + Math.abs(v.sustain) > Math.abs(audioVariant.attack) + Math.abs(audioVariant.sustain)) {
            audioVariant = v;
          }
        }
        return { scene, variants, audioVariant };
      });
      scenesVariantsRef.current = scenesVariants;
      // Dry buffer (always (0,0)) for A/B
      scenesVariantsRef.current.dryBuffer = renderedByKey.get('0|0').renderedBuffer;

      if (cancelled) return;
      setStatus('Ready');
      setIsReady(true);
      // Draw an initial frame so the canvas is not blank
      drawFrame(0, /* forcePaused */ true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Drawing a single frame at a given globalTime.
  const drawFrame = useCallback((globalTime, forcePaused = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sv = scenesVariantsRef.current;
    if (!sv) return;

    const { sceneIndex, localTime } = currentSceneAt(globalTime);
    const { scene, variants } = sv[sceneIndex];
    const loopSeconds = loopSecondsRef.current;

    // Parameter animation: sample keyframes at localTime
    const cur = currentParams(scene, localTime);
    // Blend nearest variants' peaks by localTime
    const { a, b, f } = pickBlend(variants, localTime);
    const inputPeaks = blendPeaks(a.inputPeaks, b.inputPeaks, f);
    const detPeaks = blendPeaks(a.detectorPeaks, b.detectorPeaks, f);
    const outPeaks = blendPeaks(a.outputPeaks, b.outputPeaks, f);
    const hits = a.hits; // hit positions are stable across variants (drum loop identical)

    const playheadNorm = loopSeconds > 0 ? (localTime % loopSeconds) / loopSeconds : 0;

    clearBackground(ctx);
    drawHeader(ctx, { title: scene.title, subtitle: scene.subtitle });

    const r1 = rowRevealAlpha(scene, 1, localTime);
    const r2 = rowRevealAlpha(scene, 2, localTime);
    const r3 = rowRevealAlpha(scene, 3, localTime);

    if (r1 > 0) drawInputRow(ctx, { peaks: inputPeaks, loopSeconds, playheadNorm, revealAlpha: r1 });
    if (r2 > 0) drawDetectorRow(ctx, { peaks: detPeaks, hits, playheadNorm, revealAlpha: r2, loopSeconds });
    if (r3 > 0) drawOutputRow(ctx, { peaks: outPeaks, hits, attack: cur.attack, sustain: cur.sustain, playheadNorm, loopSeconds, revealAlpha: r3 });

    drawKnobHUD(ctx, { attack: cur.attack, sustain: cur.sustain });
    drawSparkle(ctx);

    setProgress(Math.min(1, globalTime / TOTAL_DURATION));
  }, []);

  // 3) Per-scene audio swap: when the scene changes, swap wet buffer sources.
  const startSceneAudio = useCallback((sceneIndex, offsetSec) => {
    const ctx = audioCtxRef.current;
    const sv = scenesVariantsRef.current;
    if (!ctx || !sv) return;

    // Stop previous sources
    try { drySrcRef.current && drySrcRef.current.stop(); } catch {}
    try { wetSrcRef.current && wetSrcRef.current.stop(); } catch {}

    const dryBuf = sv.dryBuffer;
    const wetBuf = sv[sceneIndex].audioVariant.renderedBuffer;

    const drySrc = ctx.createBufferSource();
    drySrc.buffer = dryBuf;
    drySrc.loop = true;
    const wetSrc = ctx.createBufferSource();
    wetSrc.buffer = wetBuf;
    wetSrc.loop = true;

    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.value = 0;
    wetGain.gain.value = 0;

    drySrc.connect(dryGain);
    wetSrc.connect(wetGain);
    dryGain.connect(ctx.destination);
    wetGain.connect(ctx.destination);
    if (mediaDestRef.current) {
      dryGain.connect(mediaDestRef.current);
      wetGain.connect(mediaDestRef.current);
    }

    const clampedOffset = Math.max(0, offsetSec % dryBuf.duration);
    drySrc.start(0, clampedOffset);
    wetSrc.start(0, clampedOffset);

    drySrcRef.current = drySrc;
    wetSrcRef.current = wetSrc;
    dryGainRef.current = dryGain;
    wetGainRef.current = wetGain;
  }, []);

  // 4) Main RAF loop during playback.
  const tick = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const globalTime = ctx.currentTime - playStartTimeRef.current;

    if (globalTime >= TOTAL_DURATION) {
      stopPlayback();
      // Draw final frame
      drawFrame(TOTAL_DURATION - 0.001, true);
      return;
    }

    const { sceneIndex } = currentSceneAt(globalTime);
    if (sceneIndex !== currentSceneIndexRef.current) {
      currentSceneIndexRef.current = sceneIndex;
      startSceneAudio(sceneIndex, globalTime % (inputBufferRef.current?.duration || 1));
    }

    // Update A/B gains
    const scene = SCENES[sceneIndex];
    const { dry, wet } = abGains(scene.audio || 'dry', globalTime);
    if (dryGainRef.current) dryGainRef.current.gain.value = dry;
    if (wetGainRef.current) wetGainRef.current.gain.value = wet;

    drawFrame(globalTime);
    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawFrame, startSceneAudio]);

  const startPlayback = useCallback(async () => {
    const ctx = audioCtxRef.current;
    if (!ctx || !isReady || isPlaying) return;
    if (ctx.state === 'suspended') await ctx.resume();
    playStartTimeRef.current = ctx.currentTime;
    currentSceneIndexRef.current = -1;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [isReady, isPlaying, tick]);

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    try { drySrcRef.current && drySrcRef.current.stop(); } catch {}
    try { wetSrcRef.current && wetSrcRef.current.stop(); } catch {}
    drySrcRef.current = null;
    wetSrcRef.current = null;
    currentSceneIndexRef.current = -1;
    setIsPlaying(false);
  }, []);

  // 5) Recording: capture the canvas + audio into a WebM and download.
  const startRecording = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = audioCtxRef.current;
    if (!canvas || !ctx || !isReady || isRecording) return;
    if (ctx.state === 'suspended') await ctx.resume();

    const videoStream = canvas.captureStream(60);
    const audioStream = mediaDestRef.current.stream;
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);

    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

    const chunks = [];
    const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transient-shaper-explainer.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsRecording(false);
    };
    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);

    // Start playback from t=0 after recorder is live
    await new Promise((r) => setTimeout(r, 50));
    playStartTimeRef.current = ctx.currentTime;
    currentSceneIndexRef.current = -1;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(function recordTick() {
      const gt = ctx.currentTime - playStartTimeRef.current;
      if (gt >= TOTAL_DURATION) {
        stopPlayback();
        setTimeout(() => recorder.state === 'recording' && recorder.stop(), 250);
        return;
      }
      const { sceneIndex } = currentSceneAt(gt);
      if (sceneIndex !== currentSceneIndexRef.current) {
        currentSceneIndexRef.current = sceneIndex;
        startSceneAudio(sceneIndex, gt % (inputBufferRef.current?.duration || 1));
      }
      const scene = SCENES[sceneIndex];
      const { dry, wet } = abGains(scene.audio || 'dry', gt);
      if (dryGainRef.current) dryGainRef.current.gain.value = dry;
      if (wetGainRef.current) wetGainRef.current.gain.value = wet;
      drawFrame(gt);
      rafRef.current = requestAnimationFrame(recordTick);
    });
  }, [isReady, isRecording, drawFrame, startSceneAudio, stopPlayback]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    try { drySrcRef.current && drySrcRef.current.stop(); } catch {}
    try { wetSrcRef.current && wetSrcRef.current.stop(); } catch {}
    if (audioCtxRef.current) try { audioCtxRef.current.close(); } catch {}
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#07090E', color: '#E6EAF2',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: CANVAS_W, textAlign: 'center' }}>
        <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 8 }}>{status}</div>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ width: '100%', height: 'auto', background: '#0B0E14', borderRadius: 6 }}
        />
        <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={isPlaying ? stopPlayback : startPlayback} disabled={!isReady || isRecording}
            style={buttonStyle(isPlaying ? '#F5C84B' : '#5ECA89')}>
            {isPlaying ? 'Stop' : 'Play'}
          </button>
          <button onClick={startRecording} disabled={!isReady || isRecording || isPlaying}
            style={buttonStyle('#5BC0EB')}>
            {isRecording ? `Recording...` : 'Record WebM'}
          </button>
          <a href="#/" style={{ ...buttonStyle('#333A48'), textDecoration: 'none' }}>
            Back to plugin
          </a>
        </div>
        <div style={{ marginTop: 10, height: 4, background: '#1a1f29', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: '#5BC0EB', transition: 'width 0.1s linear' }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.5 }}>
          Duration: {TOTAL_DURATION.toFixed(1)}s — drop a 44.1kHz WAV at <code>public/samples/drum-loop.wav</code> to replace the synthesized loop.
        </div>
      </div>
    </div>
  );
}

function buttonStyle(accent) {
  return {
    background: 'transparent',
    color: accent,
    border: `1px solid ${accent}`,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
