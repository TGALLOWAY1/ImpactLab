import React from 'react';
import BandStrip from './BandStrip';

// Phase 3 — Renders all 5 band strips stacked vertically
export default function BandStripList({ bands, bandStates, anySoloed, dispatch, getVizData, vizWritePositionsRef, waveformData, getPlaybackPosition, isPlaying }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {bands.map((band, bandIndex) => {
        const bandState = bandStates[band.id];
        const isDimmed = anySoloed && !bandState.solo;
        return (
          <BandStrip
            key={band.id}
            band={band}
            bandIndex={bandIndex}
            bandState={bandState}
            isDimmed={isDimmed}
            dispatch={dispatch}
            getVizData={getVizData}
            vizWritePositionsRef={vizWritePositionsRef}
            waveformData={waveformData}
            getPlaybackPosition={getPlaybackPosition}
            isPlaying={isPlaying}
          />
        );
      })}
    </div>
  );
}
