import React from 'react';
import { colors, sizes } from '../styles/theme';

// Phase 2 — Global controls bar: input/output gain, mix, detection speed, transient mode, toggles
export default function GlobalControls({ state, dispatch }) {
  // TODO: Implement all global controls (Steps 2.1–2.11)
  return (
    <div
      style={{
        height: sizes.globalBarHeight,
        backgroundColor: colors.globalBarBg,
        borderTop: '1px solid #333',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
      }}
    >
      {/* Placeholder — implement in Phase 2 */}
    </div>
  );
}
