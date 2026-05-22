# System Interactions

## Internal interactions
- `App` reducer state is shared downward via props; no external store.
- Hooks coordinate side effects:
  - `useAudioEngine`: engine lifecycle + DSP sync
  - `useAudioSource`: file/playback/export
  - `useRealtimeWaveform` / `useMeters`: render telemetry

## Browser API dependencies
- `AudioContext` / `AudioWorklet`
- Media stream destination + recorder (explainer/export paths)
- Canvas 2D APIs
- URL hash routing

## External system interactions
- No backend APIs/endpoints identified.
- No remote persistence identified.
