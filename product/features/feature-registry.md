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
| Per-band attack/sustain time controls | active | Paired time knob beside each amount knob, with a millisecond readout derived from `effectiveTimeMs()`. Previously recorded as "UI/state present" — there was in fact no UI control at all and they were reachable only via presets. |
| Per-band output gain | active | Single vertical slider per band. The duplication note was stale — the extra global knob was removed in `4266e36`. |
| Solo/bypass per band | active | Reducer logic and UI state present. |
| Global input/mix/output | active | Input and Output sit together in the global bar as a gain-staging pair; Mix is the large dry/wet knob. Each is exposed exactly once — the duplicate "Soften" (mix) and "Clip Guard" (soft clip) controls in the right panel are gone. |
| Multiband link (attack/sustain) | active | Reducer-level fanout implemented. |
| Detection speed/method selectors | partial | State wiring present; audible effect verification incomplete in docs. |
| Delta / soft-clip / lookahead toggles | partial | Exposed and propagated; current UX verification unclear. |
| Preset load | active | Includes selective global-field preservation. |
| A/B slots (switch/copy) | active | Snapshot swap/copy implemented. |
| Audio file load and playback | active | Source hook manages lifecycle. |
| Audio export | partial | Export path exists; compatibility/error handling depth unknown. |
| Realtime waveform/meter rendering | active | SAB path plus fallback path present. |
| Explainer route/page | active | Fully separate route with pre-rendered scenes. |
| Preset picker | active | Working dropdown over the 7 built-in presets, with `listbox` semantics, arrow-key navigation, Escape-to-close and focus restore. Shows "Custom" once any parameter is edited. (The old row described arrows/pencil/hamburger affordances that no longer exist in the code at all.) |
| A/B compare | active | Slot switch plus copy-to-other-slot, both with explicit accessible names. |
| Master metering rail | active | IN/OUT/GR bars. Gradient is anchored to the scale and revealed by `clip-path`, so a colour means the same level at any fill height. Hidden from assistive tech — they update at ~30 Hz. |
| Keyboard + touch control of all parameters | active | All 37 continuous parameters are `role="slider"` with the WAI-ARIA APG keyboard contract, driven by pointer events so touch and pen work. |
| Fit-to-viewport scaling | active | `PluginShell` scales the 1400x860 surface uniformly, clamped to [0.5, 1]. |

## Known gaps (labelled, not hidden)
- **Processed-vs-original waveform overlay** — the mockup draws the processed
  signal in amber over the original in band colour. The build draws one
  waveform; the rectified Delta lane is a partial substitute and is opt-in.
  Tracked in ranked TODO.
- **Master meters have no numeric or tick scale** — only the caption states that
  the top of the bar is 0 dBFS.
- **Per-band GR indicator is a dot, not a meter**, and is hidden from assistive
  tech because it updates at ~30 Hz.
- **Prototype transport bar renders above the product header**, in what is
  otherwise dev chrome, and reports errors with `window.alert`. Reset-all still
  uses `window.confirm`.

## Deprecated/dead candidates
- Legacy docs that duplicate architecture truth outside `/product` should be treated as historical reference unless synchronized.
- Removed 2026-09-21: `src/styles/theme.js` (superseded by `src/styles/tokens.css`),
  `src/hooks/useKnobDrag.js` (superseded by `useParameterControl`), and
  `src/components/ui/PlaceholderBadge.jsx` (was dead code — defined but imported
  nowhere, so the mechanism CLAUDE.md rule 6 asks for was wired to nothing).
