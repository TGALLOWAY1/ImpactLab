# Ranked TODO (Max 10 Active)

Legend: P0 critical, P1 high, P2 medium, P3 low.

## Active TODOs
1. **[P0] Add baseline automated tests for reducer and audio-state serialization.**
2. **[P0] Create diagnostics harness for DSP parameter roundtrip and regression checks.**
3. **[P1] Verify detection speed/method, delta, lookahead, soft-clip produce expected audible + visual effects; document results.**
4. **[P1] Restore the processed-vs-original waveform overlay from the mockup.** `v1.png` draws the processed signal in amber over the original in band colour — the clearest thing a transient shaper can show. The build draws one waveform; the rectified Delta lane is opt-in and shows magnitude, not shape. `drawFileWave(color, alpha, yScale)` still takes the parameters a two-call design needs and is called once.
5. **[P1] Consolidate the six independent `useMeters` rAF loops.** `RightPanel` plus five `BandStrip`s each run their own loop, each `setState`-ing at ~30 Hz. One shared subscription would cut that to one.
6. **[P2] Replace `window.confirm` (reset-all) and `window.alert` (demo-load failure) with in-plugin dialogs.** Native modals are unstyleable and break the plugin frame.
7. **[P2] Relocate the prototype transport bar below the product header, or behind a dev toggle.** It currently renders above the plugin's own header — dev chrome in front of product chrome.
8. **[P2] Add linting/formatting gate (ESLint/Prettier) and scripts.**
9. **[P2] Investigate export compatibility/error handling across target browsers.**
10. **[P2] Migrate `pages/Explainer.jsx` onto the token system.** It is the one route still carrying its own font stack and button styles, unconnected to `tokens.css`.

## Completed since last revision
- ~~Audit and explicitly label every display-only control in UI text/tooltips/docs.~~ Done: known gaps are now listed explicitly in the feature registry, and the unused `PlaceholderBadge` (which was the intended mechanism, wired to nothing) has been removed.
- ~~Document all routes/screens with screenshot evidence in `/product/snapshots`.~~ Done: the required baseline set plus scaled-viewport and keyboard-focus captures, reproducible via `transient-shaper-mb/capture-snapshots.mjs`.
- ~~Investigate duplicate output gain controls (knob + slider) and decide keep/remove.~~ **Was already stale** — the duplicate global Output knob was removed in `4266e36`; each band has exactly one gain slider. A *different* duplication was found and fixed instead: `global.mix` was exposed as both "MIX" and "Soften", and `global.softClip` as both "Soft Clip" and "Clip Guard".
- ~~Evaluate responsive/scaled layout strategy for non-1160x800 contexts.~~ Done: `PluginShell` scales the surface uniformly. See the decision log for why scaling beat reflow.
- ~~Remove or quarantine stale duplicate docs to reduce truth fragmentation.~~ Partially done: three stale feature-registry rows corrected and the stale README claims fixed. Remaining drift in `docs/codebase-audit.md` is historical by design.

## Parking lot (inactive)
- None currently; move lower-value items to `/product/backlog/backlog.md`.
