# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ImpactLab is a **Transient Shaper MB** (multiband transient shaper) audio plugin. The React app is an interactive prototype of the plugin UI that also runs a working Web Audio DSP engine via `AudioWorklet`. Long-term goal: port the UI to a JUCE/framework-native plugin.

All app code lives under `transient-shaper-mb/`. The repo root only holds docs, the app subdirectory, and the `claude-skills` git submodule (external, unrelated).

## Commands

Run from `transient-shaper-mb/`:

```bash
npm install
npm run dev        # Vite dev server (required headers for SharedArrayBuffer)
npm run build      # Production build to dist/
npm run preview    # Serve built output
node screenshot.mjs  # Launch Vite + Playwright, save screenshot.png (uses Playwright from /opt/node22)
```

There are **no tests and no linter** configured.

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

### UI layer

- `src/components/ui/` — reusable primitives (`RotaryKnob`, `VerticalSlider`, `ToggleButton`, `SpeedSelector`). Knobs: click+drag vertically to adjust, double-click to reset. Drag logic is centralized in `src/hooks/useKnobDrag.js`.
- `src/components/` — composed views: `Header`, `GlobalControls`, `CrossoverEditor` (draggable log-scale crossover points), `BandStripList` → `BandStrip` → `WaveformCanvas`, plus `AudioSourceControls` and `DetectionMethodSelector`.
- `src/styles/theme.js` — all colors, sizes, and typography tokens. The plugin chrome is a fixed `1160×800` surface.

Zero external UI libraries — knobs, sliders, waveforms, and the crossover editor are all built with inline styles, SVG, and Canvas.

## Key References

- `docs/transient-shaper-mb-dev-plan.md` — authoritative development plan: data model, DSP-to-UI mapping table, per-band time constants, detection speed presets, 10-phase implementation order.
- `docs/codebase-audit.md` — snapshot audit of state/architecture (may lag behind code; cross-check before relying on it).
- `docs/transient_shaping_report.md` — long-form background on transient shaping DSP.

## Implementation Notes

- Follow the **mockup (5 bands)**, not the original 4-band spec. If you see 4-band references, they are outdated.
- When adding a new global or per-band parameter: update `defaults.js`, add a range entry to `dspMapping.js` if user-visible, extend `serializeState` in `useAudioEngine.js` so the worklet receives it, and handle it in `public/dsp/transient-shaper-worklet.js`.
- The worklet lives under `public/` on purpose — Vite serves it verbatim at `/dsp/...`. It is **not** processed by the bundler, so it cannot `import` from `src/`.
