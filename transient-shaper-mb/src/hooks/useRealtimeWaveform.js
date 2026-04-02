import { useRef, useCallback } from 'react';

const VIZ_SAMPLES_PER_BAND = 1024; // Downsampled peaks, not raw samples

/**
 * Returns a function that reads the latest waveform data for a given band.
 * Called on every animation frame by WaveformCanvas.
 */
export default function useRealtimeWaveform(getVizData, vizWritePositionsRef, bandIndex) {
  const samplesRef = useRef(new Float32Array(VIZ_SAMPLES_PER_BAND));

  const readSamples = useCallback(() => {
    if (!getVizData) return null;

    const raw = getVizData(bandIndex);
    if (!raw) return null;

    // Reorder samples so the oldest is at index 0 and newest at end
    const wp = vizWritePositionsRef.current[bandIndex] || 0;
    const out = samplesRef.current;
    for (let i = 0; i < VIZ_SAMPLES_PER_BAND; i++) {
      out[i] = raw[(wp + i) % VIZ_SAMPLES_PER_BAND];
    }
    return out;
  }, [getVizData, vizWritePositionsRef, bandIndex]);

  return readSamples;
}
