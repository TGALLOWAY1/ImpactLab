import React, { useRef, useEffect } from 'react';
import { colors } from '../styles/theme';
import useWaveformGenerator from '../hooks/useWaveformGenerator';
import useRealtimeWaveform from '../hooks/useRealtimeWaveform';

// Phase 4 + D6 — Canvas-based waveform visualization per band
// Uses real-time DSP data when available, falls back to synthetic waveform
export default function WaveformCanvas({ band, bandIndex, bandState, getVizData, vizWritePositionsRef }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const offsetRef = useRef(0);

  // Synthetic fallback data
  const syntheticSamples = useWaveformGenerator(
    band.id,
    bandState.attack,
    bandState.sustain,
    bandState.attackTime,
    bandState.sustainTime,
  );

  // Real-time data reader (returns null when engine not running)
  const readSamples = useRealtimeWaveform(getVizData, vizWritePositionsRef, bandIndex);

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

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Try real-time data first, fall back to synthetic
      const realtimeData = readSamples();
      const isRealtime = realtimeData !== null;
      const samples = isRealtime ? realtimeData : syntheticSamples;

      // Scroll offset (only for synthetic — real-time scrolls via ring buffer)
      if (!isRealtime) {
        offsetRef.current += 0.5;
      }
      const offset = isRealtime ? 0 : Math.floor(offsetRef.current) % samples.length;

      // Draw waveform (mirrored around center)
      const drawWave = (color, alpha, yScale, xOffset) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';

        for (let x = 0; x < w; x++) {
          const sampleIdx = (x + offset + (xOffset || 0)) % samples.length;
          const val = samples[sampleIdx] * yScale;
          const y = midY - val * midY * 0.85;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Mirror below
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const sampleIdx = (x + offset + (xOffset || 0)) % samples.length;
          const val = samples[sampleIdx] * yScale;
          const y = midY + val * midY * 0.85;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Fill with gradient
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const sampleIdx = (x + offset + (xOffset || 0)) % samples.length;
          const val = samples[sampleIdx] * yScale;
          const y = midY - val * midY * 0.85;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let x = w - 1; x >= 0; x--) {
          const sampleIdx = (x + offset + (xOffset || 0)) % samples.length;
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

      // Band-colored main waveform
      drawWave(band.color, 0.8, 1.0, 0);

      // Delta overlay (gold) — only shown for synthetic waveform display
      if (!isRealtime) {
        const deltaSection1Start = w * 0.35;
        const deltaSection1End = w * 0.55;
        const deltaSection2Start = w * 0.75;
        const deltaSection2End = w * 0.92;

        ctx.save();

        const drawDeltaSection = (start, end) => {
          ctx.beginPath();
          ctx.rect(start, 0, end - start, h);
          ctx.clip();
          drawWave(colors.deltaOverlay, 0.6, 0.9, 30);
          ctx.restore();
          ctx.save();
        };

        drawDeltaSection(deltaSection1Start, deltaSection1End);
        drawDeltaSection(deltaSection2Start, deltaSection2End);
        ctx.restore();

        // Placeholder labels for hardcoded delta sections (synthetic only)
        ctx.font = '8px sans-serif';
        ctx.fillStyle = '#E8443A';
        ctx.globalAlpha = 0.9;
        ctx.fillText('PLACEHOLDER', deltaSection1Start + 2, 10);
        ctx.fillText('PLACEHOLDER', deltaSection2Start + 2, 10);
        ctx.globalAlpha = 1;
      }

      // Playhead cursor (thin red vertical line at ~75%) — synthetic only
      if (!isRealtime) {
        const playheadX = w * 0.75;
        ctx.beginPath();
        ctx.strokeStyle = '#E85D5D';
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1;
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.stroke();
        // Label for static playhead
        ctx.fillStyle = '#E8443A';
        ctx.font = '7px sans-serif';
        ctx.globalAlpha = 0.9;
        ctx.fillText('STATIC', playheadX + 3, 10);
        ctx.globalAlpha = 1;
      }

      // Center line
      ctx.beginPath();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [syntheticSamples, band.color, readSamples]);

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
