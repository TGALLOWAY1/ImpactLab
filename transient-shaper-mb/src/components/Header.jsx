import React from 'react';
import { colors, sizes } from '../styles/theme';

// Phase 1 — Top bar: plugin title, preset browser, sub-title
export default function Header() {
  // TODO: Implement plugin title block (left), preset browser (center), sub-title (right)
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
      }}
    >
      {/* Placeholder — implement in Phase 1 */}
    </div>
  );
}
