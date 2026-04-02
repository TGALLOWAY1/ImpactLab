import React from 'react';
import { colors, sizes, typography } from '../styles/theme';
import { PlaceholderWrap } from './ui/PlaceholderBadge';

// Phase 1 — Top bar: plugin title, preset browser, sub-title
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

      {/* Center: Preset browser */}
      <PlaceholderWrap reason="NO HANDLER" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Left arrow */}
        <button style={arrowStyle}>◀</button>

        {/* Preset pill */}
        <div style={{
          backgroundColor: '#2A2A30',
          borderRadius: 4,
          padding: '5px 24px',
          fontSize: 13,
          color: '#aaa',
          minWidth: 140,
          textAlign: 'center',
          border: '1px solid #333',
        }}>
          Preset
        </div>

        {/* Edit icon */}
        <button style={{ ...arrowStyle, fontSize: 12 }}>✎</button>

        {/* Right arrow */}
        <button style={arrowStyle}>▶</button>
      </PlaceholderWrap>

      {/* Right: Sub-title + menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontSize: 14,
          letterSpacing: typography.titleLetterSpacing,
          color: colors.textPrimary,
          fontWeight: 300,
        }}>
          TRANSIENT DESIGNER
        </span>

        {/* Star icon */}
        <PlaceholderWrap reason="NO HANDLER" style={{ display: 'inline-flex' }}>
          <span style={{ fontSize: 16, color: '#666', cursor: 'pointer' }}>✦</span>
        </PlaceholderWrap>

        {/* Hamburger menu */}
        <PlaceholderWrap reason="NO HANDLER" style={{ display: 'inline-flex' }}>
          <button style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 16, height: 1.5, backgroundColor: '#888', borderRadius: 1 }} />
            ))}
          </button>
        </PlaceholderWrap>
      </div>
    </div>
  );
}

const arrowStyle = {
  background: 'none',
  border: 'none',
  color: '#888',
  fontSize: 10,
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 3,
  outline: 'none',
};
