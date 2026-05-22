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
| Per-band attack/sustain time controls | partial | UI/state present; behavior validation depth unclear. |
| Per-band output gain | active | Knob + slider both control same param (duplication risk). |
| Solo/bypass per band | active | Reducer logic and UI state present. |
| Global input/mix/output | active | Wired through global state and engine updates. |
| Multiband link (attack/sustain) | active | Reducer-level fanout implemented. |
| Detection speed/method selectors | partial | State wiring present; audible effect verification incomplete in docs. |
| Delta / soft-clip / lookahead toggles | partial | Exposed and propagated; current UX verification unclear. |
| Preset load | active | Includes selective global-field preservation. |
| A/B slots (switch/copy) | active | Snapshot swap/copy implemented. |
| Audio file load and playback | active | Source hook manages lifecycle. |
| Audio export | partial | Export path exists; compatibility/error handling depth unknown. |
| Realtime waveform/meter rendering | active | SAB path plus fallback path present. |
| Explainer route/page | active | Fully separate route with pre-rendered scenes. |
| Header preset browser arrows/menu | fake | UI affordances with limited functional behavior. |

## Deprecated/dead candidates
- Legacy docs that duplicate architecture truth outside `/product` should be treated as historical reference unless synchronized.
