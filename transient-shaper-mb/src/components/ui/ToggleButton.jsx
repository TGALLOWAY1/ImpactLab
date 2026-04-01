import React from 'react';

// Phase 5.3 — Toggle button with active glow and styling
export default function ToggleButton({ active, label, color = '#fff', onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: active ? color : '#2A2A30',
        color: active ? '#000' : '#888',
        border: `1px solid ${active ? color : '#444'}`,
        borderRadius: 3,
        padding: '4px 10px',
        fontSize: 9,
        fontWeight: active ? 'bold' : 'normal',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        cursor: 'pointer',
        boxShadow: active ? `0 0 8px ${color}44` : 'none',
        transition: 'all 0.15s ease',
        outline: 'none',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {label}
    </button>
  );
}
