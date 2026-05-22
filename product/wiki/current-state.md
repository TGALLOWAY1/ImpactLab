# Current State (Baseline)

_Last updated: 2026-05-22_

## Product status
- Project is a React + Vite interactive prototype for a 5-band transient shaper UI with a real Web Audio `AudioWorklet` DSP path.
- Primary app lives in `transient-shaper-mb/`; repo root contains supporting docs and artifacts.
- Routing is hash-based and currently supports:
  - `#/explainer` → cinematic explainer page
  - default route → main plugin UI

## What is working now (active)
- 5-band control surface (attack/sustain/time/output/solo/bypass per band).
- Global controls (input/output/mix/method/speed/multiband link/delta/soft clip/lookahead/global bypass).
- Audio engine init, worklet load, source connect/disconnect, play/stop, and export path.
- Realtime meters/waveform visualization path with SharedArrayBuffer fallback.
- Preset load and A/B slot switching/copy.
- Explainer page with pre-rendered scene variants and playback/recording flow.

## Known partial/fake/dead areas
- Header preset arrows/menu affordances are largely UI-only (limited behavior).
- Some global toggles are mostly pass-through to state/worklet with unclear audible validation coverage.
- Duplicate historic docs exist; they are not synchronized automatically.
- No automated tests and no linting configured.

## Risk posture snapshot
- Highest risk: correctness drift between UI state model and worklet parameter handling.
- Medium risk: visualization paths depend on browser capabilities and timing assumptions.
- Medium risk: explainer rendering pipeline complexity and long async setup path.
