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
export default function useWaveformGenerator(bandId, attackAmount, sustainAmount, sampleCount = 512) {
  return useMemo(() => {
    const density = BAND_DENSITY[bandId] || 1.0;
    const samples = new Float32Array(sampleCount);

    // Normalized attack/sustain from -100..100 to multipliers
    const attackMul = 1 + attackAmount / 100; // 0 to 2
    const sustainMul = 1 + sustainAmount / 100;

    // Generate a repeating transient pattern
    const patternLength = Math.floor(60 / density);

    for (let i = 0; i < sampleCount; i++) {
      const pos = i % patternLength;
      const phase = pos / patternLength;

      // Transient spike (first 15% of pattern)
      let value;
      if (phase < 0.15) {
        const t = phase / 0.15;
        // Sharp attack peak that decays quickly
        value = Math.exp(-t * 3) * attackMul;
      }
      // Sustain tail (15% to 70%)
      else if (phase < 0.7) {
        const t = (phase - 0.15) / 0.55;
        value = 0.4 * sustainMul * Math.exp(-t * 2);
      }
      // Quiet gap (70% to 100%)
      else {
        value = 0.05;
      }

      // Add some noise/variation for realism
      const noise = (Math.sin(i * density * 17.3) * 0.5 + Math.sin(i * density * 7.1) * 0.3) * 0.15;

      // Add band-appropriate frequency content
      const freq = density * 5;
      const oscillation = Math.sin(i * freq * 0.1) * 0.3;

      samples[i] = Math.max(0, Math.min(1, value * 0.7 + noise * value + oscillation * value * 0.3));
    }

    return samples;
  }, [bandId, attackAmount, sustainAmount, sampleCount]);
}
