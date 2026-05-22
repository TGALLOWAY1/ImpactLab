# System Overview

## Purpose
ImpactLab demonstrates and validates a multiband transient shaper concept in-browser before native plugin implementation.

## Top-level modules
1. **UI shell** (`src/App.jsx`, components): reducer-driven interface and routing.
2. **Audio engine** (`src/hooks/useAudioEngine.js` + `public/dsp/transient-shaper-worklet.js`): DSP processing and param sync.
3. **Audio source pipeline** (`src/hooks/useAudioSource.js`): file load, playback, export, waveform extraction.
4. **Visualization** (`useRealtimeWaveform`, `WaveformCanvas`, meters hooks): per-band display data.
5. **Explainer subsystem** (`src/pages/Explainer.jsx` + `src/explainer/*`): narrative rendering and A/B audio demonstration.

## Runtime boundaries
- **Main thread**: React UI, reducer state, file input, canvas/SVG rendering.
- **AudioWorklet thread**: transient processing + meter/viz write buffers.
- **Browser media APIs**: audio context, media recorder, buffer decode/render.

## Build and ops baseline
- Build tool: Vite.
- Scripts: `dev`, `build`, `preview`.
- No CI-style tests/lints configured at this time.
