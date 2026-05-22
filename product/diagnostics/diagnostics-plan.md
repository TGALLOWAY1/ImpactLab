# Diagnostics Plan

## Current gaps
- No automated regression tests for reducer, worklet mapping, or audio export.
- No structured logging/telemetry for user-visible audio failures.
- Limited objective checks for feature claims (especially partial/fake boundaries).

## Minimum diagnostics to add
1. Reducer unit tests for key actions (band/global set, link, preset, A/B).
2. Serialization contract tests between UI state and worklet payload format.
3. Smoke tests for app route load and `#/explainer` route render.
4. Manual QA checklist with pass/fail evidence attached in `/product/snapshots`.

## Failure triage conventions
- Categorize failures by: UI state bug, DSP mapping bug, browser capability gap, perf regression.
- Every confirmed non-trivial issue should add/update:
  - `/product/decisions/decision-log.md` (if tradeoff required)
  - `/product/todos/ranked-todo.md` (if actionable next step)
