// Phase 0.1 — Band configuration (5 bands following the mockup).
// Range labels are derived live from the global `crossoverFreqs` in
// `formatBandRange` below — do not hard-code them here.
export const BANDS = [
  { id: 'sub', label: 'Sub', color: '#7B8CDE', colorDim: '#3D4570' },
  { id: 'low', label: 'Low', color: '#5BC0EB', colorDim: '#2D6075' },
  { id: 'low-mid', label: 'Low-Mid', color: '#5ECA89', colorDim: '#2F6544' },
  { id: 'high-mid', label: 'High-Mid', color: '#F5A623', colorDim: '#7A5311' },
  { id: 'high', label: 'High', color: '#E85D5D', colorDim: '#742E2E' },
];

const AUDIBLE_LO = 20;
const AUDIBLE_HI = 20000;

function formatHz(hz) {
  if (hz >= 1000) {
    const kHz = hz / 1000;
    return `${kHz % 1 === 0 ? kHz.toFixed(0) : kHz.toFixed(1)} kHz`;
  }
  return `${Math.round(hz)} Hz`;
}

// Render the band's range label from the current 4 crossover frequencies.
// crossoverFreqs is the 4-entry array stored on global state.
export function formatBandRange(bandIndex, crossoverFreqs) {
  const lo = bandIndex === 0 ? AUDIBLE_LO : crossoverFreqs[bandIndex - 1];
  const hi = bandIndex === crossoverFreqs.length ? AUDIBLE_HI : crossoverFreqs[bandIndex];
  return `${formatHz(lo)} – ${formatHz(hi)}`;
}
