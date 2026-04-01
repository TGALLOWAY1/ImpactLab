import React, { useRef, useCallback, useState } from 'react';
import { BANDS } from '../constants/bands';

// Phase 5.5 — Horizontal log-frequency bar with 4 draggable crossover points
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_OCTAVE_SPACING = 0.5; // Minimum spacing between crossover points

function freqToX(freq, width) {
  const logMin = Math.log10(MIN_FREQ);
  const logMax = Math.log10(MAX_FREQ);
  return ((Math.log10(freq) - logMin) / (logMax - logMin)) * width;
}

function xToFreq(x, width) {
  const logMin = Math.log10(MIN_FREQ);
  const logMax = Math.log10(MAX_FREQ);
  const logFreq = logMin + (x / width) * (logMax - logMin);
  return Math.pow(10, logFreq);
}

export default function CrossoverEditor({ freqs, bands, onChange }) {
  const barRef = useRef(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [draggingIdx, setDraggingIdx] = useState(null);

  const handleMouseDown = useCallback((idx, e) => {
    e.preventDefault();
    setDraggingIdx(idx);

    const bar = barRef.current;
    const rect = bar.getBoundingClientRect();

    const onMouseMove = (e) => {
      const x = e.clientX - rect.left;
      let newFreq = xToFreq(Math.max(0, Math.min(rect.width, x)), rect.width);

      // Clamp: can't cross adjacent points (min ~half octave spacing)
      const newFreqs = [...freqs];
      const minRatio = Math.pow(2, MIN_OCTAVE_SPACING);

      if (idx > 0) {
        newFreq = Math.max(newFreq, newFreqs[idx - 1] * minRatio);
      } else {
        newFreq = Math.max(newFreq, MIN_FREQ * minRatio);
      }

      if (idx < freqs.length - 1) {
        newFreq = Math.min(newFreq, newFreqs[idx + 1] / minRatio);
      } else {
        newFreq = Math.min(newFreq, MAX_FREQ / minRatio);
      }

      newFreqs[idx] = Math.round(newFreq);
      onChange(newFreqs);
    };

    const onMouseUp = () => {
      setDraggingIdx(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [freqs, onChange]);

  const barWidth = barRef.current?.getBoundingClientRect().width || 200;

  // Band region colors (5 bands, 4 crossover points)
  const regionColors = BANDS.map(b => b.color);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      <span style={{ fontSize: 7, textTransform: 'uppercase', color: '#666', letterSpacing: '1px', textAlign: 'center' }}>
        Crossover Frequency
      </span>
      <div
        ref={barRef}
        style={{
          position: 'relative',
          height: 20,
          borderRadius: 3,
          overflow: 'visible',
          cursor: 'default',
          backgroundColor: '#1A1A20',
          border: '1px solid #333',
        }}
      >
        {/* Colored band regions */}
        {regionColors.map((color, i) => {
          const leftFreq = i === 0 ? MIN_FREQ : freqs[i - 1];
          const rightFreq = i === freqs.length ? MAX_FREQ : (i < freqs.length ? freqs[i] : MAX_FREQ);
          const left = freqToX(leftFreq, barWidth);
          const right = freqToX(rightFreq, barWidth);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left,
                width: Math.max(0, right - left),
                top: 0,
                height: '100%',
                backgroundColor: color,
                opacity: 0.2,
              }}
            />
          );
        })}

        {/* Draggable crossover dots */}
        {freqs.map((freq, idx) => {
          const x = freqToX(freq, barWidth);
          // Color: use the color between the two bands this point separates
          const dotColor = BANDS[idx + 1]?.color || BANDS[idx]?.color || '#fff';
          const isActive = hoveredIdx === idx || draggingIdx === idx;
          return (
            <div
              key={idx}
              onMouseDown={(e) => handleMouseDown(idx, e)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                position: 'absolute',
                left: x - 5,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: dotColor,
                cursor: 'ew-resize',
                boxShadow: isActive ? `0 0 6px ${dotColor}` : 'none',
                transition: 'box-shadow 0.1s ease',
                zIndex: 2,
              }}
            >
              {/* Frequency label on hover */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: 14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: '#222',
                  color: '#fff',
                  fontSize: 8,
                  padding: '1px 4px',
                  borderRadius: 2,
                  whiteSpace: 'nowrap',
                  border: '1px solid #444',
                }}>
                  {freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : freq} Hz
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
