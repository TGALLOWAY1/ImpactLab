# Architecture

## UI architecture
- `App` selects route by hash and renders either `MainApp` or `Explainer`.
- `MainApp` owns a single reducer state tree:
  - `bands[bandId]` per-band control state
  - `global` global control state
  - `abSlot`, `abOther`, `presetName`
- Dispatch is prop-drilled into composed components.

## State management
- Single reducer with exported action constants in `App.jsx`.
- Core reducer behaviors include:
  - multiband link delta propagation for attack/sustain
  - preset load with selective global preservation
  - A/B snapshot swap and copy

## DSP/control architecture
- UI state is serialized and posted to `AudioWorkletNode`.
- Worklet script is static under `public/dsp` (not bundled imports).
- Crossovers and per-band parameters are controlled in UI state, consumed in DSP layer.

## Visual architecture
- Combination of SVG controls, CSS Modules over a `tokens.css` custom-property layer, and canvas waveform rendering.
- Realtime path reads from SAB-backed buffers when available, otherwise degraded behavior.

## Architectural constraints
- Fixed authoring resolution (1400x860) scaled uniformly to fit the viewport by `PluginShell`, mirroring a JUCE editor's `setScaleFactor`; not a responsive reflow.
- Browser-only prototype assumptions (COOP/COEP headers for SAB).
