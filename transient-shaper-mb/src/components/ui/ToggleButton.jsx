import React from 'react';

// Phase 5.3 — Toggle button with active/inactive states
export default function ToggleButton({ active, label, color, onClick }) {
  // TODO: Implement styled toggle with active glow (Phase 5.3)
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
        textTransform: 'uppercase',
        letterSpacing: '1px',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
