import React from 'react';

// Phase 5.4 — Three-state segmented control for detection speed
export default function SpeedSelector({ value, onChange }) {
  // TODO: Implement wave icons and selection state (Phase 5.4)
  const options = ['slow', 'medium', 'fast'];

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: value === opt ? '#fff' : '#555',
            fontSize: 10,
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderBottom: value === opt ? '2px solid #fff' : '2px solid transparent',
            padding: '4px 8px',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
