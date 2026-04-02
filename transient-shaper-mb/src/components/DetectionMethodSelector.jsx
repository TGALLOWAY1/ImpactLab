import React from 'react';
import { DETECTION_METHODS, DETECTION_METHOD_LABELS } from '../constants/dspMapping';

// Phase D7 — Detection method selector for comparing algorithms
export default function DetectionMethodSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 8, textTransform: 'uppercase', color: '#666', letterSpacing: '1px' }}>
        Detection
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {DETECTION_METHODS.map((method) => (
          <button
            key={method}
            onClick={() => onChange(method)}
            style={{
              background: 'none',
              border: 'none',
              color: value === method ? '#fff' : '#555',
              fontSize: 9,
              cursor: 'pointer',
              padding: '1px 6px',
              textAlign: 'left',
              fontWeight: value === method ? 'bold' : 'normal',
              fontFamily: 'inherit',
              outline: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {value === method ? '\u25B8 ' : '  '}{DETECTION_METHOD_LABELS[method]}
          </button>
        ))}
      </div>
    </div>
  );
}
