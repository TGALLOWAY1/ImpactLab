# Current State (Baseline)

_Last updated: 2026-09-21_

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
- Realtime meters and per-band waveform visualization (requires SharedArrayBuffer; no fallback path exists).
- Allpass-compensated crossover: the band sum is flat to 0.00 dB at any crossover setting, so the plugin is transparent at neutral settings.
- Delta monitoring nulls to -155 dBFS at zero shaping, and Mix blends against a phase-aligned dry.
- Automated DSP regression suite (`npm test`, 13 checks) running the shipping worklet under a Node AudioWorklet shim.
- Preset load and A/B slot switching/copy.
- Explainer page with pre-rendered scene variants and playback/recording flow.

## Known partial/fake/dead areas
- Header preset arrows/menu affordances are largely UI-only (limited behavior).
- Duplicate historic docs exist; they are not synchronized automatically.
- No linting configured. DSP now has automated tests; the reducer and React components do not.
- The crossover bank is minimum-phase, so it has frequency-dependent group delay (~219 samples at 220 Hz on defaults). Inherent to an IIR crossover, not a defect.
- `CrossoverEditor` is mouse-only: no touch or keyboard interaction.
- Layout is a fixed 1400x860 shell with `overflow: hidden`; smaller viewports crop rather than scale.

## Risk posture snapshot
- Highest risk: correctness drift between UI state model and worklet parameter handling. Partly mitigated: `npm test` now pins the DSP invariants (flat band sum, delta null, solo precedence, silence gating) against the real worklet.
- Note: `LOOKAHEAD_MS` is duplicated between `src/constants/dspMapping.js` and the worklet because the worklet is served verbatim and cannot import from `src/`. Both carry a comment pointing at the other.
- Medium risk: visualization paths depend on browser capabilities and timing assumptions.
- Medium risk: explainer rendering pipeline complexity and long async setup path.
