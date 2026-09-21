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

## 2026-09-21 — Allpass-compensate the crossover bank
- **Type:** DSP architecture / audio-correctness decision
- **Context:** The 5-band split is a serial LR4 tree: each split's low output becomes a band, its high output feeds the next split. A single LR4 split sums flat, but in a serial tree the low band skips every later split and so arrives phase-shifted against the bands that went through them. Measured on the default 80/500/2500/8000 layout, the band sum deviated from flat by up to **-0.96 dB at 3 kHz** with every control at its neutral position — the plugin coloured the signal before the user touched anything. A code comment asserted the opposite ("mathematically identical to the input"), so the error was invisible to review.
- **Decision:** Feed each band through the allpass equivalent of the splits it skipped (`AllpassChain` in the worklet). The bank then collapses to `AP(f0)·AP(f1)·AP(f2)·AP(f3)` — flat magnitude at any crossover setting. Run the global dry path through the same cascade so Mix and Delta stay phase-coherent with the wet sum.
- **Tradeoff:** 10 extra biquads per channel (~20 total). Negligible CPU against the 5 bands of detection already running. The alternative — a linear-phase FIR bank — would be sample-exact but adds substantial latency and CPU, which is the wrong trade for a transient tool.
- **Consequence:** Bypassed and muted bands must go through the same chain, or any solo/bypass combination re-introduces the ripple. Verified by regression test at every crossover setting and band combination.
- **Known property, not a defect:** the bank is minimum-phase, so it has frequency-dependent group delay (~219 samples at 220 Hz on default settings). This is inherent to any IIR crossover and is not fixed latency to compensate.

## 2026-09-21 — Lookahead delays the audio, not the dry path
- **Type:** DSP correctness decision
- **Context:** "Lookahead" delayed only the global dry signal. At 100% mix the dry is unused, so the toggle did nothing at all; below 100% it comb-filtered the blend against an undelayed wet signal, and Delta subtracted a time-misaligned dry.
- **Decision:** Each `BandProcessor` now holds its own delay line. The detector reads the live sample while the audio it shapes is held back, so the gain envelope is already open when the transient arrives. The global dry delay matches, and bypassed bands run `processBypassed()` so they leave the band with identical latency.
- **Tradeoff:** Toggling Lookahead changes plugin latency by 3 ms, which is audible as a discontinuity. Accepted: this matches how hardware and plugin lookahead behave, and a host would report the latency change. Offline export compensates the delay so a saved file stays aligned with its source.

## 2026-09-21 — Solo takes precedence over bypass
- **Type:** UX / semantics decision
- **Context:** The band loop tested bypass first, so a bypassed band kept passing audio while another band was soloed — soloing the high band still let the bypassed sub band through at full level (measured -0.6 dB leakage).
- **Decision:** Solo is evaluated first. Soloing any band silences every other band, bypassed included.
- **Rationale:** Solo is a monitoring control and should win over a processing control. "Bypass this band's processing" and "mute everything except this band" are different statements, and the second is the stronger one.

## 2026-09-21 — Meters report gain change, not gain reduction
- **Type:** UX decision
- **Context:** Meters tracked only the minimum gain (`grDb`), i.e. reduction. A transient shaper adding attack spends its time *above* unity, so the GR meter and every per-band activity dot stayed dark through the plugin's primary use case — including on its own "Drums — Punch" preset.
- **Decision:** Track the signed peak deviation from unity (`gainDb` / `bandGainDb`) and colour boost and cut differently in the right panel.
- **Tradeoff:** Renames the worklet→UI meter message fields. Contained to `useAudioEngine`, `useMeters`, `BandStrip` and `RightPanel`.

## 2026-09-21 — Remove duplicated global controls from the right panel
- **Type:** UX decision
- **Context:** The right panel's "Clip Guard" and "Soften" wrote to the same `softClip` and `mix` parameters as the global bar's "Soft Clip" and "Mix". Two names for one control, moving in lockstep, with nothing indicating they were linked.
- **Decision:** Remove both from the right panel; the global bar owns them. Per `CLAUDE.md` rule 11, prefer removing duplicate functionality over extending it.
- **Note:** This closes ranked-TODO "duplicate output gain controls" only partially — the per-band output slider and the global output knob are genuinely different parameters and both stay.
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

## 2026-09-21 — Two more "the UI is lying" fixes
- **Type:** UX correctness decision
- **Context:** Found in the same pass as the duplicate right-panel controls
  above, which this branch and the DSP-correctness branch identified
  independently and fixed the same way.
- **Preset name:** the picker rendered `presetName || 'Punch and Clarity'`, so
  touching any control made the header claim a preset the user had never loaded.
  It now shows "Custom", which is what the reducer's `markDirty` already meant.
- **Meter gradient:** fills painted their gradient on a div whose *height* was
  the level, so the gradient scaled with the fill and the top of the bar read
  clipping-red at every level — a -40 dB signal drew a tiny bar tipped in red.
  The gradient is now anchored to the full bar and revealed by `clip-path`, so a
  colour means the same thing at any fill height. This composes with the
  gain-change meter decision above: direction is carried by colour, magnitude by
  height.
- **Gain staging:** the global Output knob moved beside Input in the global bar,
  so the pair sits together and `RightPanel` is purely a metering rail.
