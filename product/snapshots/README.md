# Snapshots

This folder stores visual evidence of current UI states and routes.

## Snapshot policy
- Capture/update screenshots whenever a meaningful UI change is introduced.
- Name files with `YYYY-MM-DD_<route-or-screen>_<state>.png`.
- Add a short note in commit/PR and update `/product/flows/user-flows.md` if flow visuals changed.

## Required baseline captures (current)
- Main plugin default state.
- Main plugin during playback.
- Main plugin with solo/bypass edge case state.
- Explainer route start screen.
- Explainer route mid-scene playback.

## Capture log

### 2026-09-21
- `2026-09-21_main-plugin_default.png` — main plugin, engine powered on, default preset.
  Shows the right panel after the duplicated "Clip Guard" / "Soften" controls were
  removed, and the `GR` meter relabelled `GAIN` with a signed dB readout.

**Captures still pending** (from the baseline list above):
- Main plugin during playback with audio loaded.
- Main plugin in a solo/bypass edge-case state.
- Explainer route start screen.
- Explainer route mid-scene playback.

Captures are produced by `node screenshot.mjs` from `transient-shaper-mb/`. Its
viewport must stay matched to `sizes.pluginWidth` / `sizes.pluginHeight` in
`src/styles/theme.js` — the plugin shell is fixed-size with `overflow: hidden`,
so a smaller viewport silently crops the band labels and right panel out of the
capture instead of scaling them down.
