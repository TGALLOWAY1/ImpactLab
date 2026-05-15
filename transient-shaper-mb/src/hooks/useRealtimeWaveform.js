import { useRef, useCallback } from 'react';

const VIZ_SAMPLES_PER_BAND = 1024; // Downsampled peaks, not raw samples

/**
 * Returns a function that reads the latest waveform + delta data for a band.
 * Called on every animation frame by WaveformCanvas.
 *
 * Result shape: { samples: Float32Array, delta: Float32Array } with the oldest
 * sample at index 0 and the newest at the end of each ring. Returns null if
 * the SAB view isn't ready yet.
 */
export default function useRealtimeWaveform(getVizData, vizWritePositionsRef, bandIndex) {
  const samplesRef = useRef(new Float32Array(VIZ_SAMPLES_PER_BAND));
  const deltaRef = useRef(new Float32Array(VIZ_SAMPLES_PER_BAND));
  const resultRef = useRef({ samples: samplesRef.current, delta: deltaRef.current });

  const readSamples = useCallback(() => {
    if (!getVizData) return null;

    const raw = getVizData(bandIndex);
    if (!raw) return null;

    // Reorder samples so the oldest is at index 0 and newest at end.
    // Both rings share the same write position.
    const wp = vizWritePositionsRef.current[bandIndex] || 0;
    const out = samplesRef.current;
    const outDelta = deltaRef.current;
    for (let i = 0; i < VIZ_SAMPLES_PER_BAND; i++) {
      const srcIdx = (wp + i) % VIZ_SAMPLES_PER_BAND;
      out[i] = raw.samples[srcIdx];
      outDelta[i] = raw.delta[srcIdx];
    }
    return resultRef.current;
  }, [getVizData, vizWritePositionsRef, bandIndex]);

  return readSamples;
}
