/*
 * JS mirror of the canvas-relevant design tokens.
 *
 * Canvas 2D cannot read CSS custom properties, and calling getComputedStyle()
 * inside a 60 fps rAF loop (x5 canvases) would force a style recalc every
 * frame. So these few values are duplicated here deliberately.
 *
 * KEEP IN SYNC with src/styles/tokens.css. The band accent colours are NOT
 * here — they come from src/constants/bands.js.
 */
export const canvasPalette = {
  background: '#0a1222',   // --waveform-bg
  axis: '#5a6478',         // --waveform-axis — 3.14:1 on the background
  playhead: '#ffffff',
  deltaOverlay: '#d4a847', // --delta-overlay
};
