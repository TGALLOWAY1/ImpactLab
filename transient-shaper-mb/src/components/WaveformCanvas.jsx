import React, { useRef, useEffect } from 'react';
import { colors } from '../styles/theme';
import useWaveformGenerator from '../hooks/useWaveformGenerator';

// Phase 4 + D6 — Canvas-based waveform visualization per band
// Shows full file waveform when loaded, with playhead at current position
export default function WaveformCanvas({ band, bandIndex, bandState, getVizData, vizWritePositionsRef, waveformData, getPlaybackPosition, isPlaying }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const offsetRef = useRef(0);

  // Synthetic fallback data (when no file loaded)
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
    
    const draw = (currentTime) => {
      if (lastTime === 0) lastTime = currentTime;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const midY = h / 2;
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      ctx.clearRect(0, 0, w, h);

      // "NOW" playhead position (center of canvas)
      const playheadX = Math.floor(w / 2);
      
      // Check if we have file waveform data
      const hasFileWaveform = waveformData && waveformData.peaks;
      
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

      // "NOW" playhead cursor (center of canvas)
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();
      
      // "NOW" label
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;
      ctx.fillText('NOW', playheadX + 4, 12);
      ctx.globalAlpha = 1;

      // Center line (amplitude zero)
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
  }, [syntheticSamples, band.color, waveformData, getPlaybackPosition, isPlaying]);

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
