# Decision Log

## 2026-05-22 — Establish `/product` as source-of-truth product system
- **Type:** process/architecture documentation decision
- **Context:** Repo has implementation depth but documentation is spread across root/docs files and can drift.
- **Decision:** Introduce structured `/product` hierarchy separating:
  - current state (`/wiki`, `/features`, `/flows`)
  - historical decisions (`/decisions`)
  - near-term execution (`/todos`)
  - long-term ideas (`/backlog`)
  - observability and evidence (`/diagnostics`, `/snapshots`)
- **Tradeoff:** Adds maintenance overhead but reduces ambiguity and audit cost.
- **Follow-up:** Enforce ongoing updates via `CLAUDE.md` operating rules.

## 2026-09-21 — UI foundation: CSS Modules + design tokens over inline styles
- **Type:** UI architecture decision
- **Context:** 100% of styling was React inline `style={{}}` objects — ~96 of them
  and ~146 hex literals across 16 files, against a `theme.js` with 24 tokens of
  which 8 were dead and only 6 of 17 files imported. Inline styles structurally
  cannot express `:focus-visible`, `:hover`, `@media` or
  `prefers-reduced-motion`, which is why the UI had none of them.
- **Decision:** Introduce `src/styles/tokens.css` (CSS custom properties) plus
  per-component `*.module.css`. Vite supports CSS Modules natively, so this adds
  no dependency. `src/styles/theme.js` is deleted.
- **Alternatives rejected:** Tailwind (adds a build dependency; the five runtime
  band colours would need arbitrary-value escapes anyway, and it produces no
  named token vocabulary); a single global stylesheet (no scoping); staying
  inline (leaves focus indication unfixable).
- **Tradeoff:** Two style systems during migration, and a small JS mirror of the
  canvas-relevant tokens (`src/styles/canvasPalette.js`) because Canvas 2D
  cannot read custom properties and `getComputedStyle` in a 60 fps rAF loop
  would force a style recalc every frame.
- **Note:** Band accent colours deliberately stay in `src/constants/bands.js`,
  not `tokens.css` — `WaveformCanvas` needs real JS strings. `BandStrip`
  publishes them to the cascade as `--band-accent`, which removed the `color`
  prop from every control primitive.

## 2026-09-21 — Fit-to-viewport scaling, not responsive reflow
- **Type:** UX/layout decision
- **Context:** The root was hard-pinned at 1400x860 with `overflow: hidden` and
  centred by flexbox, so any viewport under 1400px clipped the UI on both sides
  with no scrollbar. `screenshot.mjs` captured at 1160x800, so every committed
  screenshot was already missing the band labels, the input knob and the entire
  meter rail. Closes ranked-TODO #10.
- **Decision:** `PluginShell` scales the whole surface uniformly with
  `transform: scale()`, clamped to [0.5, 1], with `overflow: auto` below the
  floor. Authoring resolution stays 1400x860.
- **Rationale:** This is a plugin editor. JUCE's model is a fixed design
  resolution plus `setScaleFactor`/`AffineTransform::scale`. A responsive reflow
  would have no analogue in the host and would make the prototype diverge from
  the thing it prototypes.
- **Consequences:**
  - A `.sizer` element is load-bearing: `transform` does not affect layout, so
    without it the stage still occupies its unscaled box and produces
    mis-centering plus phantom scrollbars.
  - `WaveformCanvas` could no longer size itself from a `ResizeObserver`: the
    observer reports the *untransformed* border-box and does not fire on scale
    changes, while `getBoundingClientRect()` reflects them immediately. Sizing
    moved into the rAF loop, which already measures every frame.
  - `Explainer` is deliberately NOT wrapped — it is already fluid.

## 2026-09-21 — Drag deltas are not divided by the plugin scale
- **Type:** UX decision
- **Context:** Under `transform: scale(s)`, `clientX/Y` are visual pixels.
- **Decision:** Delta-mode drags (knobs, faders) use raw pointer deltas, so a
  given amount of physical mouse travel always moves a parameter by the same
  amount regardless of window size. Dividing by the scale would make a small
  window require a proportionally huge drag.
- **Invariant recorded in code:** scale breaks *absolute* mapping, never *delta*
  mapping. Absolute-mode controls (crossover handles) must derive their ratio
  from a single `getBoundingClientRect()` call and never mix in a layout width.

## 2026-09-21 — `role="slider"` rather than hidden native range inputs
- **Type:** accessibility decision
- **Context:** All 37 continuous parameters were `<div>`/`<svg>` elements with
  `onMouseDown` — not focusable, not in the tab order, invisible to assistive
  tech, no keyboard adjustment, and mouse-only (unusable on touch). The whole
  app contained exactly one `aria-` attribute.
- **Decision:** One shared `useParameterControl` hook exposing
  `role="slider"` with the full WAI-ARIA APG keyboard contract, built on pointer
  events with `setPointerCapture`.
- **Alternatives rejected:** A visually-hidden `<input type="range">` overlay —
  it is linear and one-dimensional, so the knob's vertical drag, bipolar centre,
  double-click-to-default and shift-for-fine are not expressible on it; two
  overlapping interactive elements fight over pointer capture; and the crossover
  bar has four thumbs on one track, which only the ARIA multi-thumb pattern can
  express.
- **Notes:**
  - All internal maths happen in normalized 0..1 space via
    `toNormalized`/`fromNormalized`, which is what makes the hook correct for the
    log-frequency crossover and maps 1:1 onto JUCE's `NormalisableRange`.
  - Quantization is load-bearing, not cosmetic: the multiband-link reducer
    propagates `value - previous` to every non-bypassed band, so unquantized
    keyboard repeat would accumulate float error across five bands. The grid is
    the *finest* step the control can produce, not the arrow step — snapping to
    the arrow step makes Shift+Arrow a no-op.
  - This is keyboard *accessibility of existing controls*. It is not the
    "MIDI learn / keyboard shortcuts" feature deferred as L1-L6 item L4 in
    `IMPACTLAB_FEATURE_AUDIT_AND_IMPLEMENTATION.md`.

## 2026-09-21 — Contrast and type-size floor
- **Type:** UX/accessibility decision
- **Context:** Measured against the real backgrounds, fader dB ticks were about
  2.4:1 at 7px, the detection list about 2.4:1, the crossover heading about
  2.9:1, and the knob's range arc about 1.4:1 — so a knob showed its fill but
  gave no reference for where that sat within its range.
- **Decision:** Text >= 4.5:1, meaningful UI graphics >= 3:1, and a hard 10px
  minimum type size, all encoded as tokens.
- **Tradeoff:** Inactive states can no longer be dimmed below the threshold, so
  state contrast now comes from making the *active* state brighter. The fader's
  dB ticks dropped from seven to four (0/-10/-20/-30) because seven 10px labels
  collide on an 80px track.

## 2026-09-21 — Expose `attackTime` / `sustainTime`, but keep them out of Multiband Link
- **Type:** UX decision
- **Context:** Both are live DSP parameters with a real mapping
  (`base x 2^((t-50)/25) x speedMultiplier`) and had **no UI control anywhere** —
  reachable only by loading a preset. The feature registry incorrectly recorded
  them as "UI/state present".
- **Decision:** Each shaper group is now an amount knob plus a smaller time knob
  under a shared heading, following the mockup's paired arrangement. The size
  difference encodes that time modifies amount.
- **Readout in milliseconds, not 0-100:** a bare "50" is meaningless. The UI
  renders the resulting time via `effectiveTimeMs()`, which mirrors the worklet
  exactly, so the per-band base times (sub 5 ms through high 0.2 ms) are legible
  for the first time. The 0-100 scalar remains `aria-valuenow`; the milliseconds
  are `aria-valuetext`.
- **Multiband Link deliberately NOT extended to them:** link applies a delta on a
  0-100 scale, and because each band's base time differs by 25x, the same delta
  would mean wildly different millisecond changes per band.

## 2026-09-21 — One parameter, one control
- **Type:** UX correctness decision
- **Context:** `RightPanel` carried a knob labelled "Soften" bound to
  `global.mix` — the same state as the global bar's "MIX" — and a toggle
  labelled "Clip Guard" bound to `global.softClip`, the same state as "Soft
  Clip". Moving one silently moved the other.
- **Decision:** The duplicates are removed. The global bar holds the canonical
  Mix and Soft Clip; the global Output knob moved there too, beside Input, so the
  gain-staging pair sits together. `RightPanel` is now purely a metering rail.
- **Also fixed:** the preset picker rendered `presetName || 'Punch and Clarity'`,
  so touching any control made the header claim a preset the user had never
  loaded. It now shows "Custom", which is what the reducer's `markDirty` already
  meant.
- **Also fixed:** meter fills painted their gradient on a div whose *height* was
  the level, so the gradient scaled with the fill and the top of the bar was
  clipping-red at every level. The gradient is now anchored to the full bar and
  revealed by `clip-path`.
