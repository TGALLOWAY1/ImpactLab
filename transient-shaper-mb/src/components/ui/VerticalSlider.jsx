import React from 'react';
import useKnobDrag from '../../hooks/useKnobDrag';

// Phase 5.2 — Vertical slider with dB markings and colored fill
export default function VerticalSlider({ value, min = -30, max = 6, label, color = '#fff', onChange }) {
  const trackHeight = 80;
  const trackWidth = 6;
  const thumbHeight = 6;

  // Normalize value to 0-1 range (0 = bottom/min, 1 = top/max)
  const normalized = (value - min) / (max - min);
  const fillHeight = normalized * trackHeight;
  const thumbY = trackHeight - normalized * trackHeight - thumbHeight / 2;

  const { onMouseDown } = useKnobDrag({
    value,
    min,
    max,
    onChange,
    sensitivity: 0.3,
  });

  const handleDoubleClick = () => onChange(0);

  // dB tick marks
  const ticks = [0, -5, -10, -15, -20, -25, -30].filter(t => t >= min && t <= max);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        {/* dB labels */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: trackHeight, position: 'relative' }}>
          {ticks.map((tick) => {
            const tickNorm = (tick - min) / (max - min);
            const top = trackHeight - tickNorm * trackHeight;
            return (
              <span
                key={tick}
                style={{
                  position: 'absolute',
                  top: top - 5,
                  right: 0,
                  fontSize: 7,
                  color: '#555',
                  lineHeight: 1,
                  fontFamily: 'sans-serif',
                }}
              >
                {tick}
              </span>
            );
          })}
        </div>

        {/* Track */}
        <div
          style={{
            width: trackWidth,
            height: trackHeight,
            backgroundColor: '#1A1A20',
            borderRadius: 3,
            position: 'relative',
            cursor: 'pointer',
            border: '1px solid #333',
            marginLeft: 18,
          }}
          onMouseDown={onMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          {/* Colored fill from bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: fillHeight,
              backgroundColor: color,
              borderRadius: '0 0 2px 2px',
              opacity: 0.7,
            }}
          />

          {/* Thumb */}
          <div
            style={{
              position: 'absolute',
              top: thumbY,
              left: -3,
              width: trackWidth + 6,
              height: thumbHeight,
              backgroundColor: '#ddd',
              borderRadius: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          />
        </div>

        {/* "dB" unit label */}
        <span style={{ fontSize: 7, color: '#555', marginTop: trackHeight - 8 }}>dB</span>
      </div>

      {label && (
        <span style={{
          fontSize: 8,
          textTransform: 'uppercase',
          color: '#888',
          letterSpacing: '1px',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
