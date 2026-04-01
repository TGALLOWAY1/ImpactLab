import React from 'react';

// Phase 5.1 — SVG rotary knob with click+drag, bipolar support, value display on hover
export default function RotaryKnob({ value, min, max, label, color, size = 'md', onChange }) {
  // TODO: Implement SVG arc, drag interaction, double-click reset (Phase 5.1)
  const diameters = { sm: 28, md: 36, lg: 40 };
  const d = diameters[size];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={d} height={d}>
        <circle cx={d / 2} cy={d / 2} r={d / 2 - 2} fill="#2A2A30" stroke={color} strokeWidth={2} />
      </svg>
      {label && (
        <span style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', letterSpacing: '1px' }}>
          {label}
        </span>
      )}
    </div>
  );
}
