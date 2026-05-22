# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ImpactLab is a **Transient Shaper MB** (multiband transient shaper) audio plugin. The React app is an interactive prototype of the plugin UI that also runs a working Web Audio DSP engine via `AudioWorklet`. Long-term goal: port the UI to a JUCE/framework-native plugin.

All app code lives under `transient-shaper-mb/`. The repo root holds docs, product governance artifacts, and assets.

## Commands

Run from `transient-shaper-mb/`:

```bash
npm install
npm run dev        # Vite dev server (required headers for SharedArrayBuffer)
npm run build      # Production build to dist/
npm run preview    # Serve built output
node screenshot.mjs  # Launch Vite + Playwright, save screenshot.png (uses Playwright from /opt/node22)
```

There are **no tests and no linter** configured yet.

## Architecture

### 5-band multiband design

Bands (fixed order, defined in `src/constants/bands.js`): `sub`, `low`, `low-mid`, `high-mid`, `high`. Each band has a distinct color used consistently across all components. DSP uses LR4 IIR crossovers at 4 user-draggable frequency points, dual-envelope detection, per-band time constants, asymmetric gain smoothing, and a sidechain HPF on the low-band detector.

### State: single reducer, prop-drilled dispatch

`App.jsx` owns a `useReducer` over `{ bands: { [bandId]: BandState }, global: GlobalState }`. Action types are **exported from `App.jsx`** and must be imported from there by any component dispatching (`SET_BAND_PARAM`, `SET_GLOBAL_PARAM`, `TOGGLE_SOLO`, `TOGGLE_BYPASS`, `RESET_BAND`).

**Multiband Link** is implemented inside the `SET_BAND_PARAM` reducer case: when `state.global.multibandLink` is true and the param is `attack` or `sustain`, the delta is applied to every non-bypassed band (clamped to ±100). Do not duplicate this logic in components.

State shapes live in `src/constants/defaults.js` (`DEFAULT_BAND_STATE`, `DEFAULT_GLOBAL_STATE`, `createInitialState`). Parameter ranges and DSP mappings are in `src/constants/dspMapping.js` (`PARAMETER_RANGES`, `BAND_TIME_DEFAULTS`, `DETECTION_SPEED_PRESETS`, `DETECTION_METHODS`).

### Audio engine (real, not synthetic)

The prototype runs actual DSP via an `AudioWorklet`:

- `src/hooks/useAudioEngine.js` — creates the `AudioContext` (44.1 kHz), loads `/dsp/transient-shaper-worklet.js`, manages the `AudioWorkletNode`, and posts parameter updates on every state change via `serializeState(state)`.
- `public/dsp/transient-shaper-worklet.js` — **the DSP implementation**. Served as a static asset so the browser can load it as a worklet module.
- `src/hooks/useAudioSource.js` — handles file loading, playback, and offline export; wired through `connectSource` / `disconnectSource` from the engine.
- `src/hooks/useRealtimeWaveform.js` — reads downsampled per-band viz from a `SharedArrayBuffer` (512 peaks × 5 bands). Falls back silently if SAB is unavailable.
- `src/hooks/useWaveformGenerator.js` — synthetic waveform data, used only when no real audio source is connected.

**COOP/COEP headers are set in `vite.config.js`** to enable `SharedArrayBuffer`. Do not remove them without also removing the SAB viz path.

## Product Documentation Operating Rules (Persistent)

`/product` is a first-class, durable system and must be updated on every meaningful change.

1. The repo must explain itself.
2. Documentation is a first-class artifact, not optional cleanup.
3. Every meaningful change leaves a trace in `/product` (or explicitly states why not).
4. Keep current truth separate from history and future ideas:
   - current truth: `/product/wiki`, `/product/features`, `/product/flows`
   - historical decisions: `/product/decisions`
   - near-term execution: `/product/todos`
   - long-term ideas: `/product/backlog`
5. Classify features as **active**, **partial**, **fake**, or **deprecated** in `/product/features/feature-registry.md`.
6. Stubbed/display-only behavior must be explicitly labeled.
7. `/product/todos/ranked-todo.md` must be ranked and contain at most 10 active items.
8. `/product/backlog/backlog.md` stores long-term ideas without contaminating ranked TODO execution.
9. Any non-trivial architecture, UX, data, or performance tradeoff must be logged in `/product/decisions/decision-log.md`.
10. UI changes must update snapshots in `/product/snapshots/` or explicitly document what captures are pending.
11. Prefer removing dead, duplicate, or unclear functionality over extending it.
12. If any area is unclear, record it as **unknown** and create an investigation item in ranked TODO.

## Key References

- `/product/wiki/*` — current source-of-truth snapshots.
- `/product/features/feature-registry.md` — feature status registry.
- `/product/decisions/decision-log.md` — architecture/UX/data/performance decision history.
- `docs/transient-shaper-mb-dev-plan.md` — implementation plan reference (may lag current truth).
- `docs/codebase-audit.md` — historical audit snapshot (may lag current truth).

## Implementation Notes

- Follow the **mockup (5 bands)**, not outdated 4-band references.
- When adding a new global or per-band parameter: update `defaults.js`, add range entry to `dspMapping.js` if user-visible, extend `serializeState` in `useAudioEngine.js`, and handle in `public/dsp/transient-shaper-worklet.js`.
- Worklet under `public/` is intentional. It is served verbatim and cannot import from `src/`.
