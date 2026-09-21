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
