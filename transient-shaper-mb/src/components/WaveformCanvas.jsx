import React, { useRef, useEffect } from 'react';
import { colors } from '../styles/theme';
import useWaveformGenerator from '../hooks/useWaveformGenerator';
import useRealtimeWaveform from '../hooks/useRealtimeWaveform';

// Phase 4 + D6 — Canvas-based waveform visualization per band
// Real-time mode (audio running): per-band filtered peaks from SAB.
//   The newest sample is always at the right edge of the canvas, so the
//   "NOW" cursor lives at the right edge — that pixel is the audio you are
//   hearing right now. The waveform scrolls right→left, oscilloscope-style.
// File mode (file loaded, paused): static file waveform, with NOW at the
//   center showing the current playhead position.
// Synthetic mode (no file): parametric placeholder.
//
// When `showDelta` is true, a rectified |processed - input| strip is drawn
// from the bottom edge upward, illustrating where the band is actively
// reshaping the signal.
export default function WaveformCanvas({ band, bandIndex, bandState, getVizData, vizWritePositionsRef, isRunning, waveformData, getPlaybackPosition, isPlaying, showDelta }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const offsetRef = useRef(0);
  // Latest props are read inside the rAF loop via a ref so we don't tear down
  // and rebuild the animation every time `showDelta` flips.
  const showDeltaRef = useRef(showDelta);
  showDeltaRef.current = showDelta;

  // Real-time SAB reader (returns null when audio is not running)
  const readRealtime = useRealtimeWaveform(getVizData, vizWritePositionsRef, bandIndex);

  // Synthetic fallback data (when no file loaded and no audio running)
  const syntheticSamples = useWaveformGenerator(
    band.id,
    bandState.attack,
    bandState.sustain,
    bandState.attackTime,
    bandState.sustainTime,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    });
    ro.observe(canvas);

    let lastTime = 0;

    // Helper: draw the rectified delta strip from the bottom of the canvas.
    // Bars grow upward from y=h. The strip occupies the bottom ~33% of the
    // canvas with a tinted background so users can read "no delta" vs.
    // "active shaping" at a glance.
    const drawDeltaStrip = (deltaSamples, w, h) => {
      const len = deltaSamples.length;
      if (len === 0) return;
      const samplesPerPixel = len / w;
      const stripMax = h * 0.32;
      const stripTop = h - stripMax;

      // Find peak for normalization so faint deltas stay readable, while a
      // floor keeps near-zero noise from blowing up visually.
      let peakDelta = 0;
      for (let i = 0; i < len; i++) {
        const v = deltaSamples[i];
        if (v > peakDelta) peakDelta = v;
      }
      const denom = Math.max(peakDelta, 0.05);
      const norm = peakDelta > 1e-5 ? 1 / denom : 0;

      ctx.save();
      // Background tint for the strip region — makes the "delta lane" visible
      // even when there's no current shaping happening.
      ctx.fillStyle = '#000000';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, stripTop, w, stripMax);

      // Top boundary — a thin colored line marking the lane.
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = colors.deltaOverlay;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, stripTop);
      ctx.lineTo(w, stripTop);
      ctx.stroke();

      // Filled rectified delta waveform.
      ctx.fillStyle = colors.deltaOverlay;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x < w; x++) {
        const sIdx = Math.floor(len - 1 - (w - 1 - x) * samplesPerPixel);
        const idx = sIdx < 0 ? 0 : sIdx >= len ? len - 1 : sIdx;
        const v = deltaSamples[idx] * norm;
        const barH = Math.min(stripMax, v * stripMax);
        ctx.lineTo(x, h - barH);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Tiny "Δ" badge at the lane's left edge so users know what they're
      // looking at the first time it lights up.
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = colors.deltaOverlay;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Δ', 4, stripTop + 11);
      ctx.restore();
    };

    // Helper: draw the NOW playhead. In real-time mode it sits at the right
    // edge of the canvas (newest SAB sample); otherwise it sits at center.
    const drawPlayhead = (x, h, label, alignLabelLeft) => {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Soft glow on the right side of the line in live mode for "live" feel
      if (alignLabelLeft) {
        const grad = ctx.createLinearGradient(x - 30, 0, x, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(255,255,255,0.18)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - 30, 0, 30, h);
      }

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      if (alignLabelLeft) {
        ctx.textAlign = 'right';
        ctx.fillText(label, x - 4, 12);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 4, 12);
      }
      ctx.restore();
    };

    const drawCenterLine = (w, midY) => {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      ctx.restore();
    };

    const draw = (currentTime) => {
      if (lastTime === 0) lastTime = currentTime;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const midY = h / 2;
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      ctx.clearRect(0, 0, w, h);

      // === REAL-TIME PER-BAND MODE (preferred when audio is running) ===
      const live = isRunning ? readRealtime() : null;
      if (live) {
        const liveSamples = live.samples;
        const liveDelta = live.delta;
        // Newest sample sits at end of `liveSamples`; align it under the
        // right-edge playhead so what you SEE on the right is what you HEAR.
        const len = liveSamples.length;
        const samplesPerPixel = len / w;
        const drawPeakWave = (color, alpha) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          for (let x = 0; x < w; x++) {
            const sIdx = Math.floor(len - 1 - (w - 1 - x) * samplesPerPixel);
            const idx = sIdx < 0 ? 0 : sIdx >= len ? len - 1 : sIdx;
            const val = liveSamples[idx];
            const y = midY - val * midY * 0.85;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          // Mirror below
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const sIdx = Math.floor(len - 1 - (w - 1 - x) * samplesPerPixel);
            const idx = sIdx < 0 ? 0 : sIdx >= len ? len - 1 : sIdx;
            const val = liveSamples[idx];
            const y = midY + val * midY * 0.85;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          // Fill
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const sIdx = Math.floor(len - 1 - (w - 1 - x) * samplesPerPixel);
            const idx = sIdx < 0 ? 0 : sIdx >= len ? len - 1 : sIdx;
            const val = liveSamples[idx];
            const y = midY - val * midY * 0.85;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          for (let x = w - 1; x >= 0; x--) {
            const sIdx = Math.floor(len - 1 - (w - 1 - x) * samplesPerPixel);
            const idx = sIdx < 0 ? 0 : sIdx >= len ? len - 1 : sIdx;
            const val = liveSamples[idx];
            const y = midY + val * midY * 0.85;
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, color);
          grad.addColorStop(0.5, color + '08');
          grad.addColorStop(1, color);
          ctx.fillStyle = grad;
          ctx.globalAlpha = alpha * 0.25;
          ctx.fill();
          ctx.globalAlpha = 1;
        };
        drawPeakWave(band.color, 0.85);

        if (showDeltaRef.current) drawDeltaStrip(liveDelta, w, h);

        drawCenterLine(w, midY);
        // NOW lives at right edge in live mode — that's the audio you hear.
        drawPlayhead(w - 1, h, 'NOW', true);
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Check if we have file waveform data
      const hasFileWaveform = waveformData && waveformData.peaks;

      // Center playhead for non-realtime modes
      const playheadX = Math.floor(w / 2);

      if (hasFileWaveform) {
        // === FILE-BASED WAVEFORM MODE ===
        // Show the full file with playhead scrolling through
        const peaks = waveformData.peaks;
        const playbackPos = isPlaying ? getPlaybackPosition() : 0; // 0 to 1

        // Calculate which sample is at the playhead (center of screen)
        const centerSampleIdx = Math.floor(playbackPos * peaks.length);

        // How many samples fit on screen (approximately)
        // We want to show a good portion of the file - let's show the full file width
        // scaled to fit, with the playhead indicating position
        const samplesPerPixel = peaks.length / w;

        // Draw the full waveform, offset so current position is at playhead
        const drawFileWave = (color, alpha, yScale) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';

          for (let x = 0; x < w; x++) {
            // Map screen x to sample index, with centerSampleIdx at playheadX
            const sampleOffset = x - playheadX;
            let sampleIdx = centerSampleIdx + Math.floor(sampleOffset * samplesPerPixel);

            // Wrap for looping playback
            while (sampleIdx < 0) sampleIdx += peaks.length;
            while (sampleIdx >= peaks.length) sampleIdx -= peaks.length;

            const val = peaks[sampleIdx] * yScale;
            const y = midY - val * midY * 0.85;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Mirror below
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const sampleOffset = x - playheadX;
            let sampleIdx = centerSampleIdx + Math.floor(sampleOffset * samplesPerPixel);
            while (sampleIdx < 0) sampleIdx += peaks.length;
            while (sampleIdx >= peaks.length) sampleIdx -= peaks.length;

            const val = peaks[sampleIdx] * yScale;
            const y = midY + val * midY * 0.85;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Fill with gradient
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const sampleOffset = x - playheadX;
            let sampleIdx = centerSampleIdx + Math.floor(sampleOffset * samplesPerPixel);
            while (sampleIdx < 0) sampleIdx += peaks.length;
            while (sampleIdx >= peaks.length) sampleIdx -= peaks.length;

            const val = peaks[sampleIdx] * yScale;
            const y = midY - val * midY * 0.85;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          for (let x = w - 1; x >= 0; x--) {
            const sampleOffset = x - playheadX;
            let sampleIdx = centerSampleIdx + Math.floor(sampleOffset * samplesPerPixel);
            while (sampleIdx < 0) sampleIdx += peaks.length;
            while (sampleIdx >= peaks.length) sampleIdx -= peaks.length;

            const val = peaks[sampleIdx] * yScale;
            const y = midY + val * midY * 0.85;
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, color);
          grad.addColorStop(0.5, color + '08');
          grad.addColorStop(1, color);
          ctx.fillStyle = grad;
          ctx.globalAlpha = alpha * 0.25;
          ctx.fill();
          ctx.globalAlpha = 1;
        };

        drawFileWave(band.color, 0.8, 1.0);

      } else {
        // === SYNTHETIC WAVEFORM MODE ===
        // Fallback when no file is loaded
        const samples = syntheticSamples;
        const scrollSpeed = 0.015;
        offsetRef.current += deltaTime * scrollSpeed;
        const scrollOffset = Math.floor(offsetRef.current);

        const drawSyntheticWave = (color, alpha, yScale) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';

          for (let x = 0; x < w; x++) {
            const sampleIdx = (x + scrollOffset) % samples.length;
            const val = samples[sampleIdx] * yScale;
            const y = midY - val * midY * 0.85;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Mirror below
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const sampleIdx = (x + scrollOffset) % samples.length;
            const val = samples[sampleIdx] * yScale;
            const y = midY + val * midY * 0.85;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Fill
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const sampleIdx = (x + scrollOffset) % samples.length;
            const val = samples[sampleIdx] * yScale;
            const y = midY - val * midY * 0.85;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          for (let x = w - 1; x >= 0; x--) {
            const sampleIdx = (x + scrollOffset) % samples.length;
            const val = samples[sampleIdx] * yScale;
            const y = midY + val * midY * 0.85;
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, color);
          grad.addColorStop(0.5, color + '08');
          grad.addColorStop(1, color);
          ctx.fillStyle = grad;
          ctx.globalAlpha = alpha * 0.25;
          ctx.fill();
          ctx.globalAlpha = 1;
        };

        drawSyntheticWave(band.color, 0.8, 1.0);
      }

      drawCenterLine(w, midY);
      drawPlayhead(playheadX, h, 'NOW', false);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [syntheticSamples, band.color, waveformData, getPlaybackPosition, isPlaying, isRunning, readRealtime]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: colors.waveformBg,
        display: 'block',
      }}
    />
  );
}
