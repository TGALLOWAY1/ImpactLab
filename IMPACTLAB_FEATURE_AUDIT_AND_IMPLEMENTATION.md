# ImpactLab — Feature Gap Audit and Easy-Win Implementation

## 1. Current Product Summary

ImpactLab (code-name **Transient Shaper MB**) is a 5-band multiband
transient-shaper prototype built as a React + Vite app with a single
`AudioWorklet` hosting all DSP. The processor implements LR4 crossovers,
four swappable transient-detection algorithms (dual-envelope, peak-vs-RMS,
derivative, energy-flux), asymmetric gain smoothing, an optional 3 ms
lookahead delay, and a tanh soft limiter. The UI is a single-screen layout
that mirrors the mockup: a header strip, a global-controls bar, and five
stacked band strips.

**Current workflow (before this pass).** The user clicks a power button to
initialize the audio engine, loads an audio file (decoded via
`AudioContext`), hits Play to loop playback through the processor, dials in
parameters, and optionally clicks "Save" to render the file offline and
download a WAV.

**Per-band controls.** Attack amount + time, Sustain amount + time (all as
rotary knobs), Output Gain (vertical slider), Solo, Bypass.

**Global controls.** Input Gain, Detection Speed (Slow/Medium/Fast),
Detection Method (4 algorithms), Multiband Link, Dry/Wet Mix, 4 draggable
crossover points (log frequency bar), Delta, Soft Clip, Lookahead.

**Strengths.**
- DSP side is surprisingly complete for a prototype — most of what a real
  product needs is already implemented in the worklet.
- Clean `useReducer` state model; adding new actions is trivial.
- Real-time viz uses a SharedArrayBuffer with a postMessage fallback.
- Offline rendering via `OfflineAudioContext` for deterministic WAV export.
- Theme tokens centralised in `styles/theme.js`.

**Limitations going in.**
- No presets, so a first-run user sees five flat bands and has no musical
  starting point.
- No A/B compare — standard plugin-workflow affordance is missing.
- Global **Output Gain** existed in `DEFAULT_GLOBAL_STATE` and was pushed
  to the worklet, but **no UI control** was wired for it. Silent gap.
- `transientMode` ("punch" / "snap" / "smooth") existed in state and was
  serialized to the worklet, but nothing read it — dead field.
- `RESET_BAND` action existed in the reducer but was never dispatched from
  the UI.
- No obvious way to clear all solos once multiple bands are soloed.
- No meters, no master level indicator, no gain-reduction readout — user
  has limited feedback on what the processor is doing overall.
- Minor canvas/drag bugs previously noted in `docs/codebase-audit.md`.

---

## 2. Gap Analysis

### Tier 1 — Best Easy Wins

| # | Item | User value | Complexity | Recommend? |
|---|------|------------|------------|-----------|
| 1 | **Preset library** (5–8 musical starting points: Drums Punch, Drums Tighten, Bass Tighten, Vocals Presence, Master Glue, Loop Tame) | Huge first-impression and usability win. The plugin instantly feels "full" and teaches the user what it does. | Low — pure data file + reducer action + picker. | **Yes — implement.** |
| 2 | **Expose the missing global Output Gain knob** | Fixes a real control gap: the DSP honours `outputGain` but the UI can't set it. | Trivial. | **Yes — implement.** |
| 3 | **A/B compare slot** | Standard plugin workflow — essential for tweaking choices. | Low (keep a snapshot of the inactive slot in state, add Swap / Copy actions). | **Yes — implement.** |
| 4 | **Reset buttons (per-band + reset-all)** | `RESET_BAND` is already defined but orphaned; a reset-all is a two-line addition. Saves users from "Did I actually return this to 0?" anxiety. | Trivial. | **Yes — implement.** |
| 5 | **Unsolo-all affordance** | With five bands and solo toggles, it's easy to leave a solo on and forget; a single "Unsolo" shortcut that only appears while any band is soloed is a nice small detail. | Trivial. | **Yes — implement.** |
| 6 | **Remove `transientMode` dead field** | Eliminates a lie in the data model. If it's exposed later, add it with a real DSP effect — don't keep an unused param. | Trivial. | **Yes — implement.** |
| 7 | **"Custom" preset label once user tweaks a loaded preset** | Small but tells the user they've dirtied the preset. | Trivial. | **Yes — implement (rolled into #1).** |

### Tier 2 — Moderate Wins

| # | Item | User value | Complexity | Recommend? |
|---|------|------------|------------|-----------|
| M1 | Per-band gain-reduction / activity meter | Turns the plugin from "trust me" into "you can see what it does." | Moderate — requires reserving a viz buffer slot for `gainSmooth` per band and rendering a small bar per strip. | Not this pass. |
| M2 | Master input/output peak + RMS meters with clip indicator | Protects the user from clipping on export and provides headroom feedback. | Moderate — new viz slot + meter component. | Not this pass. |
| M3 | Auto-gain compensation (match output loudness to input when Mix ≈ 100%) | Removes "louder = better" bias while A/B-ing. | Moderate — offline LUFS integration, or a simple running RMS ratio with attack/release. | Not this pass. |
| M4 | Adjustable lookahead time (e.g. 1–10 ms) instead of fixed 3 ms | Gives power users headroom for transient preservation at the cost of latency. | Moderate — resize circular buffer on change, with click-free guarantee. | Not this pass. |
| M5 | Save / Load user presets (localStorage) | Lets users keep custom chains. | Moderate — JSON serialization + UI. | Not this pass. |
| M6 | Fix known bugs from `docs/codebase-audit.md` (canvas resize on window resize, `CrossoverEditor` initial width) | Removes rough edges. | Small each. | Defer unless touching the file. |

### Tier 3 — Larger Opportunities

| # | Item | Notes |
|----|------|-------|
| L1 | Oversampling toggle (2×/4× for detector path) | Worklet architecture supports it with modest refactor. Real DSP payoff at high detection-speed settings. |
| L2 | Spectrum analyser over the crossover bar | Big UX win but needs FFT + new worklet message. |
| L3 | Host-parameter automation surface (for eventual JUCE port) | Architectural, not a UI change. |
| L4 | MIDI learn / keyboard shortcuts | Standard pro-plugin feature, non-trivial. |
| L5 | Undo / redo | Requires a broader state ledger. |
| L6 | A real per-band sidechain visualisation (envelope curves over the waveform) | High polish, high cost. |

---

## 3. Selected Improvements

The selection is driven by *noticeable* product value per line of code, with
zero risk to the DSP path:

1. **Preset library** (Tier 1-#1) — 7 curated starting points: *Default,
   Drums — Punch, Drums — Tighten, Bass — Tighten, Vocals — Presence,
   Master — Glue, Loop — Tame*. Preserves user-controlled globals (input /
   output / crossovers / delta / lookahead / detection method) across
   preset loads so the user's "session setup" is never clobbered. The
   picker displays a "Custom" label automatically once any parameter is
   tweaked.
2. **A/B compare** (Tier 1-#3) — the full active snapshot (bands + global
   + preset name) is swapped against an inactive "other" snapshot. Adds
   a `A↔B` toggle and a `A→B / B→A` copy button in the header.
3. **Missing global Output Gain knob** (Tier 1-#2) — closes the silent
   UI gap. Sits next to the Input Gain knob.
4. **Reset workflow** (Tier 1-#4/#5) — wires the orphaned `RESET_BAND`
   action to a small *Reset* button on each band strip, and adds
   `RESET_ALL` + `UNSOLO_ALL` actions with buttons in the header. Reset-all
   is guarded by a confirmation dialog so it isn't a footgun.
5. **Dead parameter cleanup** (Tier 1-#6) — removes `transientMode` from
   `DEFAULT_GLOBAL_STATE` and from both worklet-param serializers.

These five changes are coherent as a pass: they all improve feedback or
starting points for a new user, don't touch the DSP, and don't break the
existing plugin architecture.

---

## 4. Implementation Summary

### Files added
- `transient-shaper-mb/src/constants/presets.js` — 7 preset definitions
  built from `DEFAULT_BAND_STATE` / `DEFAULT_GLOBAL_STATE`.

### Files changed
- `transient-shaper-mb/src/App.jsx`
  - New actions: `RESET_ALL`, `UNSOLO_ALL`, `LOAD_PRESET`, `SWITCH_AB_SLOT`,
    `COPY_AB_SLOT`.
  - New reducer helpers: `snapshotFrom`, `markDirty`.
  - State now carries `abSlot`, `abOther`, `presetName`.
  - `LOAD_PRESET` preserves ephemeral globals (delta, lookahead,
    input/output gain, crossover freqs, detection method).
  - `SET_BAND_PARAM` / `SET_GLOBAL_PARAM` clear `presetName` to null once
    the state diverges from the loaded preset.
- `transient-shaper-mb/src/components/Header.jsx`
  - Full rewrite: preset picker (dropdown with name + description),
    A↔B toggle, A→B copy, conditional "Unsolo" shortcut, Reset-all
    button with confirm.
- `transient-shaper-mb/src/components/GlobalControls.jsx`
  - Adds Output Gain rotary knob next to Input Gain.
  - Renamed input label to "Input" / "Output" for visual symmetry.
- `transient-shaper-mb/src/components/BandStrip.jsx`
  - Adds a small per-band "Reset" button in the top-right corner wired
    to `RESET_BAND`.
- `transient-shaper-mb/src/constants/defaults.js`
  - Drops the dead `transientMode` field.
- `transient-shaper-mb/src/hooks/useAudioEngine.js`
  - Removes `transientMode` from `serializeState`.
- `transient-shaper-mb/src/hooks/useAudioSource.js`
  - Removes `transientMode` from the offline-export params.

### Systems touched
- **Reducer / state shape** — backward-compatible additions; no existing
  action semantics changed.
- **UI shell** — Header redesigned, Band strip gains one button, Global
  bar gains one knob.
- **Worklet interface** — only surface change is the removal of an unused
  field; no behavioural difference.

### Why these land cleanly
- Reducer-driven: no refs or context hacks were needed.
- No DSP changes; the worklet's parameter handling is unaffected.
- Visual additions follow existing theme / typography tokens.

---

## 5. Validation

- **Build:** `npm run build` passes (`vite v5.4.21`, 52 modules transformed,
  178 kB JS / 56 kB gzip).
- **Render smoke-test:** the existing `screenshot.mjs` boots Vite,
  navigates to the app, and captures a screenshot. The new Header (preset
  picker, A/B toggle, Reset), the added Output knob in the global bar,
  and the per-band Reset buttons all render as expected with no console
  errors.
- **Reducer logic — reasoning-based checks:**
  - `LOAD_PRESET` on an unknown name is a no-op.
  - `SWITCH_AB_SLOT` swaps the snapshot and the `abOther`, preserves
    `presetName` associated with the destination slot, and flips the
    slot label.
  - `COPY_AB_SLOT` stores the current active snapshot into `abOther`
    without altering active state.
  - `markDirty` only clones state when it actually changes `presetName`,
    avoiding unnecessary re-renders of child components.
  - `RESET_ALL` pulls from `createInitialState()` so any future default
    change propagates automatically.

### Known caveats
- Reset-all uses `window.confirm` — matches the prototype's low-chrome
  style but should become an in-app modal when the UI grows.
- Presets intentionally leave `inputGain`, `outputGain`, `crossoverFreqs`,
  `detectionMethod`, `delta`, and `lookahead` untouched to avoid
  surprising the user. If in future we want a preset to lock a specific
  detection method, this policy should be revisited.
- The A/B feature assumes the active and inactive slots have the same
  schema; they always do, because both come from `createInitialState()`.

---

## 6. Remaining Opportunities

Ordered roughly by value-per-effort:

1. **Per-band gain-reduction meter** (Tier 2-#M1) — reuse the viz
   SharedArrayBuffer slot to surface `gainSmooth` per band.
2. **Master input / output peak + RMS meters with clip LED** (M2).
3. **Save / load user presets via localStorage** (M5).
4. **Adjustable lookahead time** (M4) — currently a binary toggle with
   a fixed 3 ms delay.
5. **Fix the three non-critical bugs called out in
   `docs/codebase-audit.md`** (canvas-resize listener, crossover-bar
   initial width, drag-stale-closure).
6. **Auto-gain compensation for A/B fairness** (M3).
7. **Oversampling toggle for the detector path** (Tier 3-#L1).
8. **Spectrum analyser over the crossover bar** (Tier 3-#L2).

---

## 7. Human Review Needed

- **Preset values.** The attack/sustain amounts and time settings in
  `presets.js` are opinionated musical guesses; a producer should
  audition them against real material and tune.
- **Preserved-across-preset policy.** Currently the preset loader keeps
  user-set input/output gain, crossover frequencies, detection method,
  delta, and lookahead. This is debatable — a future pass could let
  presets opt in to overriding crossovers or detection method.
- **A/B UX.** Does the user expect a loaded preset to populate both A
  and B, or only A? Current behaviour is "only A, B is the
  initial-state snapshot until user either edits it or copies A→B."
- **Reset-all confirmation** uses the native `window.confirm`. Acceptable
  for a prototype; not acceptable for a shipping plugin.
- **Band-level Reset button** lives in the top-right of each band
  strip. If the visual team prefers it hidden behind a right-click
  context menu, the handler is already a single dispatch.
- **DSP-side dead code surfaces**: `transientMode` is gone; if a
  future DSP pass wants a punch/snap/smooth macro, re-introduce it with
  actual processor behaviour before adding a UI control.

---

## Code change summary

**What changed.** New `presets.js` module; new reducer actions and state
for presets + A/B compare + reset-all + unsolo-all; full Header rewrite
with a preset picker, A/B toggle + copy, conditional unsolo, and reset-all;
new per-band Reset button; new global Output Gain knob; `transientMode`
dead field removed from state and both param serialisers.

**What improved for users.** A first-run user now opens the plugin,
picks a preset that matches their source material, tweaks, A/Bs, and
resets — all without leaving the header bar. The output gain that was
silently ignored by the UI is now adjustable. Soloing no longer traps
the user.

**What remains open.** Metering (per-band GR, master I/O), user preset
save/load, adjustable lookahead, the small visual bugs called out in
`docs/codebase-audit.md`.
