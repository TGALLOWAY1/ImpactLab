# Current State (Baseline)

_Last updated: 2026-09-21_

## Product status
- Project is a React + Vite interactive prototype for a 5-band transient shaper UI with a real Web Audio `AudioWorklet` DSP path.
- Primary app lives in `transient-shaper-mb/`; repo root contains supporting docs and artifacts.
- Routing is hash-based and currently supports:
  - `#/explainer` → cinematic explainer page
  - default route → main plugin UI

## What is working now (active)
- 5-band control surface: per band an attack amount + attack time pair, a sustain amount + sustain time pair, mix, output gain, solo and bypass. Time knobs read out in resolved milliseconds.
- Global controls (input/output/mix/method/speed/multiband link/delta/soft clip/lookahead/global bypass).
- Audio engine init, worklet load, source connect/disconnect, play/stop, and export path.
- Realtime meters/waveform visualization path with SharedArrayBuffer fallback.
- Preset load and A/B slot switching/copy; the picker shows "Custom" once any parameter is edited.
- Full keyboard and touch control: all 37 continuous parameters are `role="slider"` with the WAI-ARIA APG key contract, driven by pointer events.
- Fit-to-viewport scaling via `PluginShell`, so nothing is clipped below the 1400x860 authoring size.
- Explainer page with pre-rendered scene variants and playback/recording flow.

## Known partial/fake/dead areas
- The mockup's processed-vs-original waveform overlay is not implemented; only a
  rectified, opt-in Delta lane exists.
- Master meters carry no numeric or tick scale beyond a caption.
- Some global toggles are mostly pass-through to state/worklet with unclear audible validation coverage.
- Reset-all uses `window.confirm` and demo-load failure uses `window.alert`.
- The prototype transport bar renders above the product header.
- `pages/Explainer.jsx` still carries its own font stack and button styles,
  unconnected to `tokens.css`.
- Duplicate historic docs exist; they are not synchronized automatically.
- No automated tests and no linting configured. UI behaviour is currently
  verified by hand plus the Playwright capture script.

## Risk posture snapshot
- Highest risk: correctness drift between UI state model and worklet parameter handling.
- Medium risk: visualization paths depend on browser capabilities and timing assumptions.
- Medium risk: explainer rendering pipeline complexity and long async setup path.
