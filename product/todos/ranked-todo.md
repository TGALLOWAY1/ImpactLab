# Ranked TODO (Max 10 Active)

Legend: P0 critical, P1 high, P2 medium, P3 low.

_Last updated: 2026-09-21_

## Active TODOs
1. **[P0] Add reducer/state tests to sit alongside the DSP suite.** `npm test` now covers the worklet end-to-end, but `App.jsx`'s reducer (multiband link, preset load, A/B slots) is still untested. The reducer lives in a `.jsx` file, so extracting it to a plain module is a prerequisite.
2. **[P1] Decide what Attack Time / Sustain Time should do per band and verify it.** The knobs map to a 0.25x–4x scale on each band's base time constants, but nothing pins the audible result. Currently the only `partial` entry left in the feature registry.
3. **[P1] Re-examine the Peak-vs-RMS and Energy-Flux sustain curves.** Both were written so their sustain signal never reaches zero in steady state (0.25 and 0.3 respectively), which makes "sustain" behave partly as a level offset rather than an envelope. Dual-Envelope and Derivative are correctly zero-centred.
4. **[P1] Document all routes/screens with screenshot evidence in `/product/snapshots`.** Baseline captures listed in the snapshots README are still missing; `screenshot.mjs` now captures at the correct 1400x860 size.
5. **[P1] Audit and explicitly label every display-only control in UI text/tooltips/docs.** The header preset arrows/menu are still classed `fake`.
6. **[P2] Add linting/formatting gate (ESLint/Prettier) and scripts.**
7. **[P2] Give `CrossoverEditor` touch and keyboard support.** It is mouse-only, so crossover points cannot be moved on a touch device or via the keyboard.
8. **[P2] Remove or quarantine stale duplicate docs to reduce truth fragmentation.**
9. **[P2] Investigate export compatibility across target browsers.** Error handling now surfaces failures in the toolbar; per-browser codec coverage is still unverified.
10. **[P3] Evaluate responsive/scaled layout strategy for non-1400x860 contexts.** The shell is fixed-size with `overflow: hidden`, so smaller viewports crop rather than scale.

## Recently completed (2026-09-21)
- Crossover allpass compensation — band sum went from -0.96 dB ripple to flat.
- Lookahead reimplemented to delay audio rather than the dry path.
- Solo precedence over bypass.
- Soft Clip moved to the true output stage.
- Meters report gain change in both directions.
- Duplicate right-panel controls removed.
- Parameters edited before engine init are no longer discarded.
- DSP regression harness (`npm test`).

## Parking lot (inactive)
- None currently; move lower-value items to `/product/backlog/backlog.md`.
