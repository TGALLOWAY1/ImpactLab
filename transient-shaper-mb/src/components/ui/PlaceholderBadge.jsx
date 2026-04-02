import React from 'react';

// Reusable red placeholder indicator for non-functional UI elements
export const placeholderOutline = {
  outline: '1px dashed #E8443A',
  outlineOffset: -1,
  position: 'relative',
};

export default function PlaceholderBadge({ reason = 'PLACEHOLDER' }) {
  return (
    <span style={{
      position: 'absolute',
      top: -1,
      right: -1,
      backgroundColor: '#E8443A',
      color: '#fff',
      fontSize: 6,
      fontWeight: 'bold',
      padding: '1px 3px',
      borderRadius: '0 0 0 3px',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      zIndex: 10,
      pointerEvents: 'none',
      lineHeight: 1,
    }}>
      {reason}
    </span>
  );
}

// Wrapper component that adds placeholder outline + badge around children
export function PlaceholderWrap({ reason, style, children }) {
  return (
    <div style={{ ...placeholderOutline, ...style }}>
      <PlaceholderBadge reason={reason} />
      {children}
    </div>
  );
}
