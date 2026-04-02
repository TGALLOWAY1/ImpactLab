import React from 'react';
import { colors, sizes, typography } from '../styles/theme';

// Phase 1 — Top bar: plugin title and sub-title
export default function Header() {
  return (
    <div
      style={{
        height: sizes.headerHeight,
        backgroundColor: colors.headerBg,
        borderBottom: `1px solid ${colors.headerBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
      }}
    >
      {/* Left: Plugin title with bars icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Bars icon (4 vertical bars) */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 18 }}>
          {[10, 14, 18, 12].map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                backgroundColor: '#888',
                borderRadius: 1,
              }}
            />
          ))}
        </div>
        <span style={{
          fontSize: sizes.fontTitle,
          letterSpacing: typography.titleLetterSpacing,
          color: colors.textPrimary,
        }}>
          <span style={{ fontWeight: 'bold' }}>TRANSIENT</span>
          <span style={{ fontWeight: 300, marginLeft: 6 }}>SHAPER MB</span>
        </span>
      </div>

      {/* Right: Sub-title */}
      <span style={{
        fontSize: 14,
        letterSpacing: typography.titleLetterSpacing,
        color: colors.textPrimary,
        fontWeight: 300,
      }}>
        TRANSIENT DESIGNER
      </span>
    </div>
  );
}
