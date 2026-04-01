import React from 'react';

// Phase 5.2 — Vertical slider with dB markings and colored fill
export default function VerticalSlider({ value, min, max, label, color, onChange }) {
  // TODO: Implement track, thumb, dB labels, colored fill (Phase 5.2)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 4, height: 80, backgroundColor: '#2A2A30', borderRadius: 2 }} />
      {label && (
        <span style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', letterSpacing: '1px' }}>
          {label}
        </span>
      )}
    </div>
  );
}
