import React from 'react';

// Phase 5.4 — Three-state segmented control for detection speed with wave icons
export default function SpeedSelector({ value, onChange }) {
  const options = [
    { id: 'slow', label: 'Slow', icon: '∿' },
    { id: 'medium', label: 'Medium', icon: '∿∿' },
    { id: 'fast', label: 'Fast', icon: '∿∿∿' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#666', letterSpacing: '1px' }}>
        Transient Detection Speed
      </span>
      <div style={{ display: 'flex', gap: 2 }}>
        {options.map((opt) => {
          const isActive = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: isActive ? '#fff' : '#555',
                fontSize: 9,
                textTransform: 'capitalize',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
                padding: '4px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                transition: 'color 0.15s ease',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1 }}>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
