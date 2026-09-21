# Snapshots

This folder stores visual evidence of current UI states and routes.

## Snapshot policy
- Capture/update screenshots whenever a meaningful UI change is introduced.
- Name files with `YYYY-MM-DD_<route-or-screen>_<state>.png`.
- Add a short note in commit/PR and update `/product/flows/user-flows.md` if flow visuals changed.

## Reproducing
Run `node capture-snapshots.mjs` from `transient-shaper-mb/`. It starts Vite,
drives the UI through each state with Playwright and writes into this directory.
It uses `transient-shaper-mb/fixtures/impulse-loop.wav` (a generated signal, for
repeatability); override with `SNAPSHOT_AUDIO=/path/to.wav`.

## Required baseline captures (current)
- [x] Main plugin default state — `2026-09-21_main_default.png`
- [x] Main plugin during playback — `2026-09-21_main_playback.png`
- [x] Main plugin with solo/bypass edge case state — `2026-09-21_main_solo-bypass.png`
- [x] Explainer route start screen — `2026-09-21_explainer_start.png`
- [x] Explainer route mid-scene playback — `2026-09-21_explainer_mid-scene.png`

Added beyond the baseline, because both are now first-class UI states:
- [x] Scaled viewport (1100x720, scale ~0.79) — `2026-09-21_main_scaled-viewport.png`
- [x] Keyboard focus on a band control — `2026-09-21_main_keyboard-focus.png`
