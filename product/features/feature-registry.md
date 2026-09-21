# Feature Registry

Status classes:
- **active**: implemented and used in normal flow
- **partial**: implemented but incomplete/uncertain
- **fake**: display-only or non-functional behavior
- **deprecated**: superseded/should be removed

## Core features

| Feature | Status | Notes |
|---|---|---|
| Main 5-band transient shaper UI | active | Core layout + controls available. |
| Per-band attack/sustain shaping | active | Reducer + DSP param path present. |
| Per-band attack/sustain time controls | partial | A time knob now sits beside each amount knob, reading out in resolved milliseconds via `effectiveTimeMs()`. Still `partial` because the audible result is not yet verified against reference material. Previously recorded as "UI/state present" when there was in fact no UI control at all — they were reachable only via presets. |
| Per-band output gain | active | Per-band slider; distinct from the global output knob, which sits beside Input in the global bar. |
| Solo/bypass per band | active | Reducer logic and UI state present. |
| Global input/mix/output | active | Wired through global state and engine updates. |
| Multiband link (attack/sustain) | active | Reducer-level fanout implemented. |
| Detection speed/method selectors | active | All four methods covered by the silence-gating regression test. |
| Delta (difference monitoring) | active | Nulls to -155 dBFS at zero shaping; verified in-browser. |
| Soft Clip / Clip Guard | active | Now the final stage, after mix and output gain, so it guards the real output. |
| Lookahead | active | Delays the audio inside each band while the detector reads live; export compensates the 3 ms. |
| Crossover transparency (band sum) | active | Allpass-compensated; flat to 0.00 dB at any crossover setting. |
| Gain-change metering | active | Signed: reports transient boost as well as reduction. |
| Preset load | active | Includes selective global-field preservation. |
| A/B slots (switch/copy) | active | Snapshot swap/copy implemented. |
| Audio file load and playback | active | Source hook manages lifecycle. |
| Audio export | active | Honours global bypass, compensates lookahead latency, surfaces failures in the toolbar. |
| Realtime waveform/meter rendering | partial | Requires SharedArrayBuffer (COOP/COEP). There is **no** postMessage fallback: without the headers the per-band waveforms stay blank. Headers are set for dev, `vite preview` and Vercel. |
| Explainer route/page | active | Fully separate route with pre-rendered scenes. |
| Preset picker | active | Dropdown over the 7 built-in presets with `listbox` semantics, arrow-key navigation, Escape-to-close and focus restore. Shows "Custom" once any parameter is edited. (Replaces a `fake` row describing arrows/pencil/hamburger affordances that no longer exist in the code at all.) |
| A/B compare | active | Slot switch plus copy-to-other-slot, both with explicit accessible names. |
| Master metering rail | active | IN / OUT / GAIN. The gain meter is bidirectional — colour carries direction, height carries magnitude — and gradients are anchored to the scale by `clip-path`, so a colour means the same level at any fill height. Hidden from assistive tech: they update at ~30 Hz. |
| Keyboard + touch control of all parameters | active | All 37 continuous parameters are `role="slider"` with the WAI-ARIA APG keyboard contract, driven by pointer events so touch and pen work. |
| Fit-to-viewport scaling | active | `PluginShell` scales the 1400x860 surface uniformly, clamped to [0.5, 1]. |
| DSP regression tests | active | `npm test` — 13 checks running the shipping worklet under a Node AudioWorklet shim. |

## Known gaps (labelled, not hidden)
- **Processed-vs-original waveform overlay** — the mockup draws the processed
  signal in amber over the original in band colour. The build draws one
  waveform; the rectified Delta lane is a partial substitute and is opt-in.
  Tracked in ranked TODO.
- **Master meters have no numeric tick scale** — the gain meter has a dB
  readout, but the IN/OUT bars rely on a caption to say the top is 0 dBFS.
- **Per-band gain-change indicator is a dot, not a meter**, and is hidden from
  assistive tech because it updates at ~30 Hz.
- **Prototype transport bar renders above the product header**, in what is
  otherwise dev chrome. Reset-all still uses `window.confirm`.
- **`pages/Explainer.jsx` is not on the token system** — it carries its own font
  stack and button styles.

## Deprecated/dead candidates
- Right panel "Clip Guard" / "Soften" — **removed 2026-09-21**. They duplicated the global bar's Soft Clip and Mix.
- Legacy docs that duplicate architecture truth outside `/product` should be treated as historical reference unless synchronized.
- Removed 2026-09-21: `src/styles/theme.js` (superseded by `src/styles/tokens.css`),
  `src/hooks/useKnobDrag.js` (superseded by `useParameterControl`), and
  `src/components/ui/PlaceholderBadge.jsx` (was dead code — defined but imported
  nowhere, so the mechanism CLAUDE.md rule 6 asks for was wired to nothing).
