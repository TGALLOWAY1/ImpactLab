# Codebase Audit — Transient Shaper MB

**Date:** 2026-04-01
**Scope:** Full audit of the ImpactLab repository and `transient-shaper-mb` React UI prototype

---

## 1. Repository Overview

| Item | Detail |
|------|--------|
| **Repository** | `tgalloway1/impactlab` |
| **Primary project** | `transient-shaper-mb/` — React UI prototype for a 5-band multiband transient shaper plugin |
| **Framework** | React 18 + Vite 5 |
| **Language** | JavaScript (JSX) |
| **Total source files** | 18 `.js` / `.jsx` files |
| **Total source lines** | ~1,100 lines (excluding `node_modules`, configs) |
| **Test files** | 0 |
| **Build tooling** | Vite with `@vitejs/plugin-react` |
| **State management** | `useReducer` (single reducer in `App.jsx`) |
| **External dependencies** | `react`, `react-dom` only |

---

## 2. Directory Structure

```
ImpactLab/
├── CLAUDE.md                          # Project instructions for Claude Code
├── .gitmodules                        # Submodule: claude-skills
├── claude-skills/                     # Git submodule (external)
├── docs/
│   ├── transient-shaper-mb-dev-plan.md  # 570-line comprehensive dev plan
│   └── codebase-audit.md               # This file
└── transient-shaper-mb/
    ├── index.html                     # Vite entry point
    ├── package.json                   # Minimal deps (react, react-dom, vite)
    ├── package-lock.json
    ├── vite.config.js                 # Standard Vite React config
    ├── public/
    │   └── index.html                 # Duplicate entry HTML (see Issues)
    └── src/
        ├── index.jsx                  # React root mount (6 lines)
        ├── App.jsx                    # Root component + reducer (109 lines)
        ├── components/
        │   ├── Header.jsx             # Top bar (113 lines)
        │   ├── GlobalControls.jsx     # Global params bar (169 lines)
        │   ├── BandStrip.jsx          # Single band row (169 lines)
        │   ├── BandStripList.jsx      # 5-band container (23 lines)
        │   ├── WaveformCanvas.jsx     # Canvas waveform per band (166 lines)
        │   ├── CrossoverEditor.jsx    # Draggable crossover display (163 lines)
        │   └── ui/
        │       ├── RotaryKnob.jsx     # SVG knob with drag (157 lines)
        │       ├── VerticalSlider.jsx # Vertical dB slider (118 lines)
        │       ├── ToggleButton.jsx   # Toggle button component (29 lines)
        │       └── SpeedSelector.jsx  # Detection speed control (49 lines)
        ├── constants/
        │   ├── bands.js               # Band config (5 bands, colors) (8 lines)
        │   ├── defaults.js            # Initial state (38 lines)
        │   └── dspMapping.js          # DSP parameter reference (27 lines)
        ├── hooks/
        │   ├── useKnobDrag.js         # Mouse drag logic (36 lines)
        │   └── useWaveformGenerator.js # Synthetic waveform data (58 lines)
        └── styles/
            └── theme.js               # Color/size/typography tokens (34 lines)
```

---

## 3. Architecture Assessment

### 3.1 State Management

**Pattern:** Single `useReducer` in `App.jsx` with prop-drilled `dispatch`.

**Action types:**
- `SET_BAND_PARAM` — Sets any per-band parameter (attack, sustain, outputGain, attackTime, sustainTime)
- `SET_GLOBAL_PARAM` — Sets any global parameter
- `TOGGLE_SOLO` / `TOGGLE_BYPASS` — Band toggles
- `RESET_BAND` — Resets a band to defaults

**Assessment:** Appropriate for a prototype of this size. The reducer is well-structured with clean immutable updates. Multiband link behavior is correctly implemented within the `SET_BAND_PARAM` case.

### 3.2 Component Hierarchy

```
App
├── Header (stateless)
├── GlobalControls (state.global + dispatch)
│   ├── RotaryKnob (x3: Input, Mix, Output)
│   ├── SpeedSelector
│   ├── CrossoverEditor
│   └── ToggleButton (x3: Delta, Soft Clip, Lookahead)
└── BandStripList (bands + bandStates + dispatch)
    └── BandStrip (x5)
        ├── RotaryKnob (x5: attack, attackTime, sustain, sustainTime, outputGain)
        ├── VerticalSlider (outputGain)
        ├── ToggleButton (x2: Solo, Bypass)
        └── WaveformCanvas
```

**Assessment:** Clean component decomposition. Components are well-separated by responsibility. The `ui/` subdirectory for reusable primitives is a good pattern.

### 3.3 Rendering

- All styling is inline (no CSS files, no CSS-in-JS library). Appropriate for a prototype.
- Canvas rendering for waveforms uses `requestAnimationFrame` for animation.
- SVG-based knob rendering with computed arcs.

---

## 4. Dev Plan Compliance

### Implementation Status by Phase

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| Phase 0 | Scaffold & Constants | **Complete** | Band config, state shapes, theme tokens all match spec |
| Phase 1 | Header | **Complete** | All elements present: title, preset browser, sub-title, hamburger |
| Phase 2 | Global Controls | **Complete** | All 10 controls wired (Input/Output Gain, Speed, Mode, Link, Mix, Crossover, Delta, Soft Clip, Lookahead) |
| Phase 3 | Band Strips | **Complete** | 5 bands, 4 knobs each, output gain slider, solo/bypass |
| Phase 4 | Waveform Display | **Complete** | Canvas rendering with scrolling animation, delta overlay, playhead |
| Phase 5 | Reusable Components | **Complete** | RotaryKnob, VerticalSlider, ToggleButton, SpeedSelector, CrossoverEditor |
| Phase 6 | Interaction Wiring | **Mostly Complete** | State management, multiband link, solo dimming all work. See issues below. |
| Phase 7 | Visual Polish | **Partially Complete** | Gradients, typography, glows present but some spec items missing |
| Phase 8 | DSP Mapping | **Complete** | Reference data defined in `dspMapping.js` |
| Phase 9 | File Structure | **Complete** | Matches spec exactly |
| Phase 10 | Integration | **Mostly Complete** | All components integrated; minor issues remain |

### Spec Deviations

1. **Band state model extended:** The dev plan (Step 0.2) specified `attack`, `sustain`, `outputGain`, `solo`, `bypass`. The implementation adds `attackTime` and `sustainTime` fields — this is a reasonable addition that maps to the dual-envelope architecture described in Step 3.3.

2. **BandStrip knob label layout:** The spec describes the layout as "2 Attack knobs side-by-side, 2 Sustain knobs side-by-side" with row labels "ATTACK" and "SUSTAIN". The implementation places all 4 knobs in a column with labels "Attack" and "Sustain" interleaved in a way that may not match the mockup (labels appear between row pairs rather than above each pair).

3. **Output gain dual control:** BandStrip renders both a RotaryKnob AND a VerticalSlider for output gain, both wired to the same parameter. The dev plan specifies only a vertical slider for per-band output gain. The dual control is functionally harmless but visually redundant.

---

## 5. Issues Found

### 5.1 Bugs

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| B1 | **Medium** | `BandStrip.jsx:81-111` | Knob group labels are misplaced. Labels "Attack" and "Sustain" appear between the first row and second row, then again after the second row. This creates a confusing layout where both label pairs say "Attack" on the left and "Sustain" on the right, but one label pair sits between the Attack and Sustain rows. |
| B2 | **Medium** | `CrossoverEditor.jsx:68` | `barWidth` is computed from `barRef.current?.getBoundingClientRect().width` on every render, but `barRef.current` may be `null` on the initial render, falling back to `200`. The colored band regions and dot positions will be incorrect until a re-render occurs after mount. |
| B3 | **Low** | `WaveformCanvas.jsx:22-29` | Canvas resize handler is called once at mount but never on window resize. If the viewport changes, the canvas resolution won't update (will render blurry or cropped). |
| B4 | **Low** | `RotaryKnob.jsx:100` | SVG gradient IDs use `label` prop as suffix (`knob-grad-${label}`). When `label` is empty string (as in BandStrip knobs), all knobs share the same gradient ID `knob-grad-`, which may cause rendering issues if the browser deduplicates SVG defs. |
| B5 | **Low** | `useKnobDrag.js:8-28` | The `value` in the `useCallback` dependency array is stale — `startValue.current` is set from the `value` closure at mousedown time, but if the component re-renders during drag, the `onMouseDown` callback is recreated with a new closure reference. This can cause discontinuous jumps during drag on certain re-render sequences. |

### 5.2 Code Quality Issues

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| Q1 | **Medium** | `App.jsx:73` | `RESET_BAND` hardcodes default values (`attack: 0, attackTime: 50, sustain: 0, sustainTime: 50, outputGain: 0, solo: false, bypass: false`) instead of importing `DEFAULT_BAND_STATE` from `constants/defaults.js`. This creates a maintenance risk if defaults change. |
| Q2 | **Low** | `BandStrip.jsx:71,99` | `bandState.attackTime || 50` and `bandState.sustainTime || 50` use `||` instead of `?? 50`. If `attackTime` is `0` (a valid value), it would incorrectly fall back to `50`. |
| Q3 | **Low** | `WaveformCanvas.jsx:41` | `offsetRef.current += 0.5` — the scroll speed is hardcoded. This could accumulate floating-point drift over long sessions since `Math.floor` is applied after. Not a practical issue for a prototype but worth noting. |
| Q4 | **Low** | `CrossoverEditor.jsx:71` | `regionColors` rebuilds the `BANDS.map` on every render. Minor performance concern — could be a module-level constant. |
| Q5 | **Info** | `transient-shaper-mb/public/index.html` | A second `index.html` exists in `public/`. Vite uses the root `index.html`, so this file is unused and potentially confusing. |

### 5.3 Missing Functionality

| # | Priority | Description | Dev Plan Reference |
|---|----------|-------------|--------------------|
| M1 | **Medium** | Waveform reactivity is partial — attack/sustain values affect waveform shape via `useWaveformGenerator`, but `attackTime` and `sustainTime` are not used in generation. | Phase 6.4 |
| M2 | **Medium** | No `.gitignore` at the repo root — `node_modules/`, build output, and OS files are not excluded from git tracking. | — |
| M3 | **Low** | Preset browser buttons (arrows, edit) in the Header are non-functional (no state or handlers). | Phase 1.2 |
| M4 | **Low** | Transient Mode selector has no effect on waveform rendering or any other state beyond storing the selection. | Phase 2.3 |
| M5 | **Low** | Detection Speed selector has no effect beyond storing the selection — doesn't modify envelope times or waveform display. | Phase 2.2 |
| M6 | **Low** | Delta/Soft Clip/Lookahead toggles store state but have no visual or behavioral effect. | Phase 2.8-2.10 |
| M7 | **Info** | No responsive scaling — the plugin is fixed at 1160x800px with no viewport adaptation. | Phase 7.5 |

---

## 6. Dependency Analysis

### Production Dependencies

| Package | Version | Assessment |
|---------|---------|------------|
| `react` | ^18.2.0 | Current (React 19 is available but 18 is stable and appropriate) |
| `react-dom` | ^18.2.0 | Matches React version |

### Dev Dependencies

| Package | Version | Assessment |
|---------|---------|------------|
| `@vitejs/plugin-react` | ^4.2.0 | Current |
| `vite` | ^5.0.0 | Current (Vite 6 exists but 5 is stable) |

**Assessment:** Minimal dependency footprint. No unnecessary packages. No security concerns.

---

## 7. Testing

**Current state: No tests exist.** No test runner configured, no test files present.

**Recommendation for future phases:**
- Add Vitest (integrates seamlessly with Vite) for unit tests
- Priority test targets: reducer logic in `App.jsx`, `useWaveformGenerator` output, `useKnobDrag` value clamping
- Component tests with React Testing Library for interaction flows (solo/bypass, multiband link)

---

## 8. Performance Considerations

1. **Canvas animation (5 simultaneous):** Each `WaveformCanvas` runs its own `requestAnimationFrame` loop. With 5 bands, this means 5 concurrent animation loops. Acceptable for a prototype, but a shared animation coordinator would be more efficient for production.

2. **Waveform regeneration:** `useWaveformGenerator` returns a `useMemo`-ized `Float32Array`. This correctly avoids recomputation unless attack/sustain values change. Good use of memoization.

3. **Inline styles on every render:** Every component creates new style objects on each render. React's reconciler handles this fine for this scale, but it prevents style-based optimizations.

4. **CrossoverEditor bar width:** `getBoundingClientRect()` is called in the render path (line 68), which forces a synchronous layout reflow. Should be moved to a `useLayoutEffect` or `ResizeObserver`.

---

## 9. Code Style Summary

- **Consistent naming:** PascalCase components, camelCase props/state, SCREAMING_SNAKE for action types
- **File organization:** Matches the dev plan's Phase 9 spec exactly
- **Comments:** Phase annotations on each file are helpful for traceability
- **No linting configured:** No ESLint, no Prettier config files. Formatting is manually consistent but not enforced
- **No TypeScript:** Pure JS/JSX. Type safety relies on convention only. Acceptable for a prototype.

---

## 10. Summary

The codebase is a well-structured React prototype that faithfully implements the majority of the Transient Shaper MB dev plan. All 18 source files follow a clean component architecture with appropriate separation of concerns. The data layer (constants, state management, hooks) is solid.

**Strengths:**
- Clean file structure matching the dev plan spec exactly
- Well-implemented reducer with multiband link behavior
- Good component decomposition with reusable UI primitives
- Canvas waveform rendering with proper `requestAnimationFrame` usage
- Minimal, appropriate dependencies

**Key areas for improvement:**
- Fix the SVG gradient ID collision for empty-label knobs (B4)
- Fix the CrossoverEditor initial render width issue (B2)
- Import `DEFAULT_BAND_STATE` in the `RESET_BAND` handler instead of hardcoding (Q1)
- Add a `.gitignore` file (M2)
- Wire up detection speed and transient mode to affect waveform rendering (M1, M4, M5)
- Add a test runner and basic unit tests
- Configure ESLint/Prettier for code style enforcement
