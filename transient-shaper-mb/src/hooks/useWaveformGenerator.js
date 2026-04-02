import { useMemo } from 'react';

// Band frequency characteristics for waveform density
const BAND_DENSITY = {
  sub: 0.3,
  low: 0.5,
  'low-mid': 1.0,
  'high-mid': 2.0,
  high: 3.5,
};

// Generates synthetic waveform data for the prototype
// 1024 samples representing ~6 seconds of audio (matching real-time downsampled view)
// Each sample represents a "peak" value for that time slice
export default function useWaveformGenerator(bandId, attackAmount, sustainAmount, attackTime = 50, sustainTime = 50, sampleCount = 1024) {
  return useMemo(() => {
    const density = BAND_DENSITY[bandId] || 1.0;
    const samples = new Float32Array(sampleCount);

    // Normalized attack/sustain from -100..100 to multipliers
    const attackMul = 1 + attackAmount / 100; // 0 to 2
    const sustainMul = 1 + sustainAmount / 100;

    // Time params modulate envelope durations (0-100 → phase thresholds)
    const attackPhase = 0.03 + (attackTime / 100) * 0.12;   // 0.03 to 0.15
    const sustainPhase = 0.15 + (sustainTime / 100) * 0.35;  // 0.15 to 0.50

    // Pattern represents ~1 bar of audio, repeats multiple times in buffer
    // With 1024 samples representing ~6 seconds, pattern of 128 = ~0.75 sec per repeat
    const basePatternLength = Math.floor(128 / density);
    const patternLength = Math.max(basePatternLength, 32);

    for (let i = 0; i < sampleCount; i++) {
      const pos = i % patternLength;
      const phase = pos / patternLength;

      // Transient spike (attack phase of pattern)
      let value;
      if (phase < attackPhase) {
        const t = phase / attackPhase;
        // Sharp attack peak that decays quickly
        value = Math.exp(-t * 3) * attackMul;
      }
      // Sustain tail (attack end to sustain phase)
      else if (phase < sustainPhase) {
        const t = (phase - attackPhase) / (sustainPhase - attackPhase);
        value = 0.6 * sustainMul * Math.exp(-t * 2);
      }
      // Quiet gap (sustain end to 100%)
      else {
        const gapProgress = (phase - sustainPhase) / (1 - sustainPhase);
        value = 0.08 * (1 - gapProgress * 0.7);
      }

      // Add some variation for realism (less noise since these are "peaks")
      const variation = Math.sin(i * 0.7) * 0.08 + Math.sin(i * 1.3) * 0.05;

      samples[i] = Math.max(0, Math.min(1, value * 0.85 + variation * value));
    }

    return samples;
  }, [bandId, attackAmount, sustainAmount, attackTime, sustainTime, sampleCount]);
}
