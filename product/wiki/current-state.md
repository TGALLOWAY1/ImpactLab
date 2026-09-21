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
- Realtime meters and per-band waveform visualization (requires SharedArrayBuffer; no fallback path exists).
- Allpass-compensated crossover: the band sum is flat to 0.00 dB at any crossover setting, so the plugin is transparent at neutral settings.
- Delta monitoring nulls to -155 dBFS at zero shaping, and Mix blends against a phase-aligned dry.
- Automated DSP regression suite (`npm test`, 13 checks) running the shipping worklet under a Node AudioWorklet shim.
- Preset load and A/B slot switching/copy; the picker shows "Custom" once any parameter is edited.
- Full keyboard and touch control: all 37 continuous parameters are `role="slider"` with the WAI-ARIA APG key contract, driven by pointer events.
- Fit-to-viewport scaling via `PluginShell`, so nothing is clipped below the 1400x860 authoring size.
- Explainer page with pre-rendered scene variants and playback/recording flow.

## Known partial/fake/dead areas
- The mockup's processed-vs-original waveform overlay is not implemented; only a
  rectified, opt-in Delta lane exists.
- IN/OUT meters carry no numeric tick scale (the GAIN meter does have a dB readout).
- Reset-all still uses `window.confirm`; other error paths now render in the toolbar.
- The prototype transport bar renders above the product header.
- `pages/Explainer.jsx` still carries its own font stack and button styles,
  unconnected to `tokens.css`.
- Duplicate historic docs exist; they are not synchronized automatically.
- No linting configured. DSP has automated tests (`npm test`) and the UI has
  behavioural checks (`npm run verify`); the reducer itself is still untested.
- The crossover bank is minimum-phase, so it has frequency-dependent group delay (~219 samples at 220 Hz on defaults). Inherent to an IIR crossover, not a defect.

## Risk posture snapshot
- Highest risk: correctness drift between UI state model and worklet parameter handling. Partly mitigated: `npm test` now pins the DSP invariants (flat band sum, delta null, solo precedence, silence gating) against the real worklet.
- Note: `LOOKAHEAD_MS` is duplicated between `src/constants/dspMapping.js` and the worklet because the worklet is served verbatim and cannot import from `src/`. Both carry a comment pointing at the other.
- Medium risk: visualization paths depend on browser capabilities and timing assumptions.
- Medium risk: explainer rendering pipeline complexity and long async setup path.
