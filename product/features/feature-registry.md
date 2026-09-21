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
| Per-band output gain | active | Per-band slider; distinct from the global output knob. |
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
| Header preset browser arrows/menu | fake | UI affordances with limited functional behavior. |
| DSP regression tests | active | `npm test` — 13 checks running the shipping worklet under a Node AudioWorklet shim. |

## Deprecated/dead candidates
- Right panel "Clip Guard" / "Soften" — **removed 2026-09-21**. They duplicated the global bar's Soft Clip and Mix.
- Legacy docs that duplicate architecture truth outside `/product` should be treated as historical reference unless synchronized.
