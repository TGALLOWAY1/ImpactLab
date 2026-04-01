import React from 'react';
import { colors } from '../styles/theme';

// Phase 4 — Canvas-based waveform visualization per band
export default function WaveformCanvas({ band, bandState }) {
  // TODO: Implement canvas rendering with synthetic waveform data,
  //       delta overlay, and scrolling animation (Phase 4)
  return (
    <canvas
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: colors.waveformBg,
      }}
    />
  );
}
