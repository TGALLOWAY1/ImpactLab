# Snapshots

This folder stores visual evidence of current UI states and routes.

## Snapshot policy
- Capture/update screenshots whenever a meaningful UI change is introduced.
- Name files with `YYYY-MM-DD_<route-or-screen>_<state>.png`.
- Add a short note in commit/PR and update `/product/flows/user-flows.md` if flow visuals changed.

## Reproducing
Run `npm run snapshots` from `transient-shaper-mb/`. It starts Vite, drives the
UI through each state with Playwright and writes into this directory. It uses
`transient-shaper-mb/fixtures/impulse-loop.wav` (a generated signal, for
repeatability); override with `SNAPSHOT_AUDIO=/path/to.wav`.

The viewport no longer has to match the plugin's authoring size: `PluginShell`
scales the surface to fit, so a smaller viewport shrinks the UI rather than
cropping it. The primary capture still uses 1440x900 so the scale lands at 1.0
and successive captures stay pixel-comparable.

## Required baseline captures (current)
- [x] Main plugin default state — `2026-09-21_main_default.png`
- [x] Main plugin during playback — `2026-09-21_main_playback.png`
- [x] Main plugin with solo/bypass edge case state — `2026-09-21_main_solo-bypass.png`
- [x] Explainer route start screen — `2026-09-21_explainer_start.png`
- [x] Explainer route mid-scene playback — `2026-09-21_explainer_mid-scene.png`

Added beyond the baseline, because both are now first-class UI states:
- [x] Scaled viewport (1100x720, scale ~0.79) — `2026-09-21_main_scaled-viewport.png`
- [x] Keyboard focus on a band control — `2026-09-21_main_keyboard-focus.png`

## Capture log

### 2026-09-21
- `2026-09-21_main-plugin_default.png` — main plugin, engine powered on, default
  preset. Captured for the DSP-correctness pass: shows the right panel after the
  duplicated "Clip Guard" / "Soften" controls were removed, and the `GR` meter
  relabelled `GAIN` with a signed dB readout.
- `2026-09-21_main_*.png`, `2026-09-21_explainer_*.png` — the full baseline set,
  captured for the UI/accessibility pass. These supersede the single capture
  above: same right panel, plus the paired attack/sustain time knobs, the
  millisecond readouts, the token palette and the fit-to-viewport shell.
