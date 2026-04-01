import React from 'react';
import { colors, sizes } from '../styles/theme';

// Phase 3 — Single band row: controls panel + waveform display
export default function BandStrip({ band, bandState, isDimmed, dispatch }) {
  // TODO: Implement band controls (knobs, slider, solo/bypass) and waveform area
  return (
    <div
      style={{
        height: sizes.bandStripHeight,
        display: 'flex',
        border: `1px solid ${band.colorDim}`,
        opacity: bandState.bypass ? 0.4 : isDimmed ? 0.6 : 1,
        position: 'relative',
      }}
    >
      {/* Band label badge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: band.color,
          color: '#000',
          fontSize: 10,
          fontWeight: 'bold',
          textTransform: 'uppercase',
          padding: '2px 8px',
        }}
      >
        {band.label}
      </div>

      {/* Controls panel */}
      <div style={{ width: sizes.controlsPanelWidth, flexShrink: 0 }}>
        {/* Placeholder — implement in Phase 3 */}
      </div>

      {/* Waveform area */}
      <div style={{ flex: 1, backgroundColor: colors.waveformBg }}>
        {/* Placeholder — implement in Phase 4 */}
      </div>
    </div>
  );
}
