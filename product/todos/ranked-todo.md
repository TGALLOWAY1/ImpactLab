# Ranked TODO (Max 10 Active)

Legend: P0 critical, P1 high, P2 medium, P3 low.

_Last updated: 2026-09-21_

## Active TODOs
1. **[P0] Add reducer/state tests to sit alongside the DSP suite.** `npm test` covers the worklet end-to-end, but `App.jsx`'s reducer (multiband link, preset load, A/B slots) is still untested. The reducer lives in a `.jsx` file, so extracting it to a plain module is a prerequisite.
2. **[P1] Verify what Attack Time / Sustain Time actually do audibly, per band.** The knobs now exist and read out in resolved milliseconds, so the *mapping* is legible and testable — but nothing yet pins the audible result against reference material.
3. **[P1] Re-examine the Peak-vs-RMS and Energy-Flux sustain curves.** Both were written so their sustain signal never reaches zero in steady state (0.25 and 0.3 respectively), which makes "sustain" behave partly as a level offset rather than an envelope. Dual-Envelope and Derivative are correctly zero-centred.
4. **[P1] Restore the processed-vs-original waveform overlay from the mockup.** `v1.png` draws the processed signal in amber over the original in band colour — the clearest thing a transient shaper can show. The build draws one waveform; the rectified Delta lane is opt-in and shows magnitude, not shape. `drawFileWave(color, alpha, yScale)` still takes the parameters a two-call design needs and is called once.
5. **[P1] Consolidate the six independent `useMeters` rAF loops.** `RightPanel` plus five `BandStrip`s each run their own loop, each `setState`-ing at ~30 Hz. One shared subscription would cut that to one.
6. **[P2] Replace `window.confirm` on reset-all with an in-plugin dialog.** The error paths now render in the toolbar; this is the last native modal.
7. **[P2] Relocate the prototype transport bar below the product header, or behind a dev toggle.** It currently renders above the plugin's own header — dev chrome in front of product chrome.
8. **[P2] Add linting/formatting gate (ESLint/Prettier) and scripts.**
9. **[P2] Investigate export compatibility across target browsers.** Error handling now surfaces failures in the toolbar; per-browser codec coverage is still unverified.
10. **[P2] Migrate `pages/Explainer.jsx` onto the token system.** It is the one route still carrying its own font stack and button styles, unconnected to `tokens.css`.

## Recently completed (2026-09-21)

DSP correctness:
- Crossover allpass compensation — band sum went from -0.96 dB ripple to flat.
- Lookahead reimplemented to delay audio rather than the dry path.
- Solo precedence over bypass.
- Soft Clip moved to the true output stage.
- Meters report gain change in both directions.
- Parameters edited before engine init are no longer discarded.
- DSP regression harness (`npm test`).

UI:
- Duplicate right-panel controls removed (found independently by both branches).
- ~~Document all routes/screens with screenshot evidence in `/product/snapshots`.~~ The required baseline plus scaled-viewport and keyboard-focus captures, reproducible via `npm run snapshots`.
- ~~Give `CrossoverEditor` touch and keyboard support.~~ Done as part of a general fix: **all 37** continuous parameters are now `role="slider"` with the WAI-ARIA key contract and pointer events, not just the crossover.
- ~~Evaluate responsive/scaled layout strategy for non-1400x860 contexts.~~ `PluginShell` scales the surface uniformly; see the decision log for why scaling beat reflow.
- ~~Audit and explicitly label every display-only control.~~ Known gaps are now listed explicitly in the feature registry. The `fake` "header preset arrows/menu" row described affordances that no longer exist in the code at all; the unused `PlaceholderBadge` (the intended labelling mechanism, wired to nothing) has been removed.
- ~~Investigate duplicate output gain controls (knob + slider).~~ Was already stale — the duplicate *global* knob went in `4266e36`, and the per-band slider and global knob are genuinely different parameters. The real duplication was `mix`/"Soften" and `softClip`/"Clip Guard".
- Contrast and type-size floor enforced in tokens (text >= 4.5:1, UI graphics >= 3:1, 10px minimum).
- Partially done: removing stale duplicate docs. Three feature-registry rows and the README's per-band time-constant table were corrected; `docs/codebase-audit.md` remains historical by design.

## Parking lot (inactive)
- None currently; move lower-value items to `/product/backlog/backlog.md`.
