# Transient Shaper MB — Development Plan

**Target:** Interactive React UI prototype (`.jsx` artifact) that faithfully reproduces the NB3 mockup layout and wires up all controls with state, ready to evolve into a JUCE/framework-native plugin UI.

**DSP Architecture Reference:** Production Realtime 3-band → 4-band LR4 IIR multiband, dual-envelope detection, per-band time constants, asymmetric gain smoothing, sidechain HPF on low-band detector.

-----

## Phase 0 — Project Scaffold & Constants

**Goal:** Establish the data model and color system before touching any UI.

### Step 0.1 — Define band config object

```
BANDS = [
  { id: "sub",      label: "Sub",      color: "#7B8CDE", colorDim: "#3D4570" },
  { id: "low",      label: "Low",      color: "#5BC0EB", colorDim: "#2D6075" },
  { id: "low-mid",  label: "Low-Mid",  color: "#5ECA89", colorDim: "#2F6544" },
  { id: "high-mid", label: "High-Mid", color: "#F5A623", colorDim: "#7A5311" },
  { id: "high",     label: "High",     color: "#E85D5D", colorDim: "#742E2E" },
]
```

> **Note on band count:** The mockup shows 5 bands (Sub, Low, Low-Mid, High-Mid, High). The original spec called for 4. **Follow the mockup — use 5 bands.** This means 4 LR4 crossover points in the DSP path.

### Step 0.2 — Define per-band state shape

```
bandState = {
  attack: 0,        // -100 to +100 (percentage, bipolar)
  sustain: 0,       // -100 to +100
  outputGain: 0,    // -30 to +6 dB
  solo: false,
  bypass: false,
}
```

### Step 0.3 — Define global state shape

```
globalState = {
  inputGain: 0,             // -30 to +12 dB
  outputGain: 0,            // -30 to +12 dB
  mix: 100,                 // 0-100% (dry/wet)
  detectionSpeed: "medium", // "slow" | "medium" | "fast"
  transientMode: "punch",   // "punch" | "snap" | "smooth"
  multibandLink: true,
  softClip: false,
  lookahead: false,
  delta: false,
  crossoverFreqs: [80, 500, 2500, 8000], // Hz — 4 points for 5 bands
}
```

-----

## Phase 1 — Top Bar (Header)

**Goal:** Fixed-height header strip matching mockup exactly.

### Step 1.1 — Plugin title block (left)

- Icon: vertical bars icon (CSS-only, 4 thin rects)
- Text: `TRANSIENT` (bold) + `SHAPER MB` (light weight)
- Font: sans-serif, ~18px, white, letter-spacing 2px

### Step 1.2 — Preset browser (center)

- Left/right arrows: `◀` `▶` styled as subtle buttons
- Center text: "Preset" in a recessed pill shape
- Edit icon (pencil): small, right of label
- Background: slightly lighter than header bg (`#2A2A30`)

### Step 1.3 — Plugin sub-title (right)

- Text: `TRANSIENT DESIGNER`
- Hamburger menu icon: three horizontal lines
- Same font weight as left title, slightly smaller

### Step 1.4 — Styling

- Header bg: `#1A1A20`
- Height: 48px
- Bottom border: 1px `#333`

-----

## Phase 2 — Global Controls Bar

**Goal:** Single horizontal strip below header with all global parameters.

### Step 2.1 — Input Gain knob

- Small rotary knob component (reusable)
- Label below: "INPUT GAIN"
- Range: -30 to +12 dB
- Interaction: click+drag vertical to adjust

### Step 2.2 — Transient Detection Speed

- Three icons in a row: slow (wide wave), medium (tighter wave), fast (sharp wave)
- Labels: "Slow", "Medium", "Fast"
- Selected state: brighter text, subtle underline
- Maps to DSP: envelope follower attack/release time constant set

### Step 2.3 — Transient Mode selector

- Three-option radio: "Punch" | "Snap" | "Smooth"
- Stacked vertically in mockup, compact
- Active = white text, inactive = dim gray

### Step 2.4 — Multiband Link toggle

- Checkbox + label: "MULTIBAND LINK ✓"
- When ON: adjusting one band's attack/sustain offsets all bands proportionally

### Step 2.5 — Mix knob (dry/wet)

- Larger knob than I/O gains, centered in the bar
- Label: "MIX"
- Sub-labels: "Dry" (left), "Wet" (right)
- Range: 0–100%

### Step 2.6 — Output Gain knob

- Same component as Input Gain
- Label: "OUTPUT GAIN"

### Step 2.7 — Crossover Frequency display

- Horizontal bar showing frequency spectrum (log scale)
- 4 draggable colored dots at crossover frequencies
- Colors match the bands they separate
- Frequency labels appear on hover/drag
- Label: "CROSSOVER FREQUENCY"

### Step 2.8 — Delta button

- Toggle button: "DELTA"
- Label below: "(hear only processed signal)"
- Active state: highlighted border

### Step 2.9 — Soft Clip toggle

- Pill/button: "SOFT CLIP"
- Active = lit up, inactive = dim

### Step 2.10 — Lookahead toggle

- Pill/button: "LOOKAHEAD"
- Active = lit up, inactive = dim

### Step 2.11 — Styling

- Bar bg: `#22222A` with subtle top/bottom border
- Height: ~80px
- All controls evenly spaced with flexbox
- Knob diameter: 40px (global), labels 10px uppercase

-----

## Phase 3 — Band Channel Strips (Core UI)

**Goal:** 5 horizontal rows, each representing one frequency band. This is the main body of the plugin.

### Step 3.1 — Band strip layout (per band)

Each band is a horizontal row containing (left to right):

1. **Controls panel** (fixed width ~280px)
1. **Waveform displays** (flex, fills remaining width)

Border: 1px band color (dimmed), with band label badge top-left.

### Step 3.2 — Band label badge

- Small colored rectangle, top-left corner of the strip
- Text: band name (e.g., "Sub", "Low", "Low-Mid", "High-Mid", "High")
- Background: band color, text: dark/black
- Font: 10px bold uppercase

### Step 3.3 — Attack knobs (x2)

- Two rotary knobs stacked or side-by-side
- Top row labeled "ATTACK" with two knobs
- Bottom row labeled "ATTACK" with two knobs
- **Why two pairs:** The mockup clearly shows 4 knobs per band — 2 Attack knobs and 2 Sustain knobs. This maps to the DSP architecture's dual-envelope detection:
  - **Attack knob 1:** Controls transient boost/cut amount
  - **Attack knob 2:** Controls attack envelope time constant
  - **Sustain knob 1:** Controls sustain boost/cut amount
  - **Sustain knob 2:** Controls sustain envelope time constant

> **DSP mapping note:** The dual-knob Attack and Sustain pairs correspond to the dual-envelope detection method — one knob controls the gain amount, the other controls the envelope follower speed for that stage. This gives users control over both *how much* and *how fast* the shaping responds.

### Step 3.4 — Output Gain slider

- Vertical slider with dB markings: 0, -5, -10, -15, -20, -25, -30
- Located between knobs and waveforms
- Label: "OUTPUT GAIN"
- Colored fill from bottom to current level
- "dB" unit label below

### Step 3.5 — Solo button

- Small rectangular toggle: "SOLO"
- Active: bright band color bg
- Inactive: dark gray

### Step 3.6 — Bypass button

- Small rectangular toggle: "BYPASS"
- Active: highlighted
- Inactive: dark gray

### Step 3.7 — Styling

- Strip height: ~120px per band
- Controls bg: slightly darker than strip bg
- Knob diameter: 36px
- All labels: 9px uppercase, `#888`

-----

## Phase 4 — Waveform Display Area

**Goal:** Scrolling/animated waveform visualization per band showing input, output, and delta signals.

### Step 4.1 — Waveform canvas (per band)

- Fills the right ~70% of each band strip
- Canvas element, aspect ratio ~5:1
- Dark background: `#111118`
- Horizontal time axis (left = past, right = present)
- Vertical axis: amplitude

### Step 4.2 — Three-layer waveform rendering

Based on the mockup, each band's waveform area shows three visual states across its width:

1. **Input signal** (left portion): Band-colored waveform on dark bg — shows the unprocessed band signal
1. **Processed signal** (center portion): Band-colored waveform — shows the shaped output
1. **Delta/difference** (overlaid or right portion): A brighter/different color tint showing the gain change being applied

> **From the mockup:** The waveforms appear to show the signal scrolling right-to-left, with a vertical cursor/playhead. The delta portions show up as a different color overlay (appears as a gold/amber tint overlaid on the band color).

### Step 4.3 — Delta visualization

- Delta signal rendered as a separate color layer (gold/amber `#D4A847`)
- Overlaid on the band-colored waveform
- Makes it visually obvious what the transient shaper is adding/removing
- Opacity: ~60% to remain distinguishable from the dry signal

### Step 4.4 — Simulated waveform data (for prototype)

Since this is a UI prototype (no real audio), generate synthetic waveform data:

```
function generateBandWaveform(band, attackAmount, sustainAmount) {
  // Generate a repeating envelope pattern:
  // - Sharp transient spike (attack region)
  // - Decaying sustain tail
  // - Scale amplitude by band (sub = large, high = small/dense)
  // - Apply attack/sustain gain to show shaping effect
}
```

- Sub/Low bands: wide, slow waveforms
- High-Mid/High bands: dense, fast waveforms
- Update waveform shape when attack/sustain knobs change

### Step 4.5 — Playhead cursor

- Thin vertical line (red or white) at a fixed position (~75% from left)
- Everything to the right of the playhead is "future" (if lookahead is on)
- Subtle glow effect on the line

-----

## Phase 5 — Reusable Components

**Goal:** Build the shared UI components that all sections use.

### Step 5.1 — Rotary Knob component

```
Props:
  - value: number
  - min, max: number
  - label: string
  - color: string (band color or white for globals)
  - size: "sm" | "md" | "lg"
  - onChange: (value) => void

Rendering:
  - SVG circle with arc indicator
  - Value range: 270° rotation (from 7 o'clock to 5 o'clock)
  - Filled arc in `color` from min to current value
  - Center: shows current value on hover
  - Subtle drop shadow

Interaction:
  - mousedown → track vertical drag → update value
  - Double-click → reset to default
```

### Step 5.2 — Vertical Slider component

```
Props:
  - value: number (dB)
  - min, max: number
  - label: string
  - color: string
  - onChange: (value) => void

Rendering:
  - Thin vertical track with notch marks
  - Colored fill from bottom
  - Thumb indicator
  - dB labels on left side
```

### Step 5.3 — Toggle Button component

```
Props:
  - active: boolean
  - label: string
  - color: string (active state color)
  - onClick: () => void
```

### Step 5.4 — Detection Speed Selector component

- Three-state segmented control with wave icons

### Step 5.5 — Crossover Frequency Editor component

- Horizontal bar with log-scale frequency axis
- 4 draggable points
- Colored regions between points match band colors
- Labels on hover showing Hz values

-----

## Phase 6 — Interaction Wiring

**Goal:** Connect all controls to state so the UI is fully interactive.

### Step 6.1 — State management

- Use `useReducer` with a single state object containing all band states + global state
- Action types: `SET_BAND_PARAM`, `SET_GLOBAL_PARAM`, `TOGGLE_SOLO`, `TOGGLE_BYPASS`, `RESET_BAND`

### Step 6.2 — Multiband Link behavior

- When `multibandLink` is true and user adjusts a band's attack/sustain:
  - Calculate the delta from previous value
  - Apply same delta to all non-bypassed bands
  - Clamp at min/max

### Step 6.3 — Solo exclusivity

- Solo is non-exclusive by default (multiple bands can solo)
- When any band is soloed, all non-soloed bands are visually dimmed
- Bypass + Solo are independent (bypass takes precedence)

### Step 6.4 — Waveform reactivity

- When attack/sustain values change, regenerate the synthetic waveform
- Attack boost → transient spike gets taller
- Attack cut → transient spike gets shorter
- Sustain boost → tail gets louder
- Sustain cut → tail decays faster
- Delta overlay updates accordingly

### Step 6.5 — Crossover drag interaction

- Mousedown on a crossover dot → track horizontal mouse position
- Convert pixel position to frequency (log scale)
- Clamp so crossover points can't cross each other
- Minimum spacing: ~1 octave between adjacent crossovers

-----

## Phase 7 — Visual Polish

**Goal:** Match the premium VST aesthetic from the mockup.

### Step 7.1 — Background and depth

- Plugin bg: linear gradient `#1A1A22` → `#14141A`
- Band strips: subtle 1px inset borders in dimmed band color
- Active bands: slight glow (box-shadow with band color at 20% opacity)
- Bypassed bands: entire strip at 40% opacity

### Step 7.2 — Typography

- Font: system sans-serif or `Inter` / `SF Pro` style
- Sizes: 18px title, 10px labels, 9px sub-labels
- Colors: `#FFFFFF` primary, `#888888` labels, `#555555` inactive
- All labels: uppercase, letter-spacing 1px

### Step 7.3 — Knob rendering

- Subtle radial gradient on knob body (simulates 3D)
- Thin arc indicator (2px stroke)
- Bipolar knobs (attack/sustain): center detent at 12 o'clock
- Unipolar knobs (gains): start at 7 o'clock

### Step 7.4 — Waveform rendering quality

- Use `requestAnimationFrame` for smooth scrolling effect
- Anti-aliased canvas paths with `lineCap: 'round'`
- Waveform fill: gradient from band color (top) to transparent (bottom)
- Mirror waveform below center line (symmetrical display)

### Step 7.5 — Responsive scaling

- Base design: 1160 x 800px (matches mockup proportions)
- Scale down gracefully for smaller viewports
- All sizes in relative units where possible

-----

## Phase 8 — DSP-to-UI Mapping Reference

**Goal:** Document how each UI control maps to the underlying DSP parameters from the architecture report, so the eventual JUCE/C++ implementation has a clear spec.

### Step 8.1 — Parameter mapping table

| UI Control          | DSP Parameter          | Range        | Unit  | Notes                                                                            |
|---------------------|------------------------|--------------|-------|----------------------------------------------------------------------------------|
| Band Attack Knob 1  | `transient_gain[band]` | -1.0 to +1.0 | ratio | Bipolar. Positive = boost transients, negative = cut                             |
| Band Attack Knob 2  | `attack_time[band]`    | 0.1 to 50 ms | ms    | Envelope follower attack time. Per-band defaults differ                          |
| Band Sustain Knob 1 | `sustain_gain[band]`   | -1.0 to +1.0 | ratio | Bipolar. Positive = boost sustain, negative = cut                                |
| Band Sustain Knob 2 | `release_time[band]`   | 10 to 500 ms | ms    | Envelope follower release time. Per-band defaults differ                         |
| Band Output Gain    | `band_gain[band]`      | -30 to +6    | dB    | Post-shaping band gain                                                           |
| Input Gain          | `input_gain`           | -30 to +12   | dB    | Pre-crossover                                                                    |
| Output Gain         | `output_gain`          | -30 to +12   | dB    | Post-recombination                                                               |
| Mix                 | `dry_wet`              | 0.0 to 1.0   | ratio | Linear crossfade                                                                 |
| Detection Speed     | `speed_preset`         | enum         | —     | Sets all bands' time constants to preset ratios                                  |
| Transient Mode      | `mode_preset`          | enum         | —     | Adjusts gain curve shape (punch=hard knee, snap=fast release, smooth=soft knee)   |
| Crossover Freqs     | `crossover_freq[0..3]` | 20–20000     | Hz    | LR4 IIR crossover cutoff frequencies                                             |
| Soft Clip           | `soft_clip_enable`     | bool         | —     | Applies tanh saturation to output                                                |
| Lookahead           | `lookahead_enable`     | bool         | —     | Adds ~5ms latency for pre-transient detection                                    |
| Delta               | `delta_monitor`        | bool         | —     | Output = wet - dry (hear only the difference)                                    |
| Solo                | `solo[band]`           | bool         | —     | Mutes all non-soloed bands                                                       |
| Bypass              | `bypass[band]`         | bool         | —     | Passes band signal through unprocessed                                           |

### Step 8.2 — Per-band default time constants

From the DSP architecture report — envelope follower defaults per band:

| Band     | Attack Default | Release Default | Sidechain HPF                                                                       |
|----------|----------------|-----------------|------------------------------------------------------------------------------------|
| Sub      | 5 ms           | 200 ms          | **Yes** — 80 Hz HPF on detector to prevent false triggers from low-frequency energy |
| Low      | 2 ms           | 150 ms          | Optional — 40 Hz HPF                                                                |
| Low-Mid  | 1 ms           | 100 ms          | No                                                                                  |
| High-Mid | 0.5 ms         | 50 ms           | No                                                                                  |
| High     | 0.2 ms         | 30 ms           | No                                                                                  |

### Step 8.3 — Detection speed presets

| Speed  | Attack Multiplier | Release Multiplier |
|--------|-------------------|--------------------|
| Slow   | 2.0x              | 2.0x               |
| Medium | 1.0x (defaults)   | 1.0x               |
| Fast   | 0.5x              | 0.5x               |

-----

## Phase 9 — File Structure (for Claude Code)

```
transient-shaper-mb/
├── src/
│   ├── App.jsx                    # Root component, state management
│   ├── components/
│   │   ├── Header.jsx             # Phase 1 — top bar
│   │   ├── GlobalControls.jsx     # Phase 2 — global params bar
│   │   ├── BandStrip.jsx          # Phase 3 — single band row
│   │   ├── BandStripList.jsx      # Phase 3 — maps over all 5 bands
│   │   ├── WaveformCanvas.jsx     # Phase 4 — canvas waveform per band
│   │   ├── CrossoverEditor.jsx    # Phase 2.7 — draggable crossover display
│   │   └── ui/
│   │       ├── RotaryKnob.jsx     # Phase 5.1
│   │       ├── VerticalSlider.jsx # Phase 5.2
│   │       ├── ToggleButton.jsx   # Phase 5.3
│   │       └── SpeedSelector.jsx  # Phase 5.4
│   ├── hooks/
│   │   ├── useKnobDrag.js         # Shared drag interaction logic
│   │   └── useWaveformGenerator.js # Synthetic waveform data
│   ├── constants/
│   │   ├── bands.js               # Phase 0.1 — band config
│   │   ├── defaults.js            # Phase 0.2/0.3 — initial state
│   │   └── dspMapping.js          # Phase 8 — parameter mapping reference
│   └── styles/
│       └── theme.js               # Colors, sizes, spacing tokens
```

-----

## Phase 10 — Implementation Order for Claude Code

Execute in this exact sequence. Each step is a single prompt/task.

### Prompt 1: Scaffold + constants

> "Create the project structure. Define band config, default state, and theme constants. Set up the root App component with useReducer state management for 5 bands + globals. No UI yet, just the data layer."

### Prompt 2: Rotary Knob component

> "Build the RotaryKnob SVG component with click+drag interaction, bipolar support (center detent), and value display on hover. Test with a standalone knob on screen."

### Prompt 3: Toggle Button + Vertical Slider

> "Build the ToggleButton and VerticalSlider components. ToggleButton takes active/label/color. VerticalSlider has dB markings and colored fill."

### Prompt 4: Header bar

> "Build the Header component matching the mockup: plugin title left, preset browser center, sub-title + menu right. Dark bg, exact typography."

### Prompt 5: Global Controls bar

> "Build the GlobalControls bar with Input Gain knob, Detection Speed selector, Transient Mode selector, Multiband Link checkbox, Mix knob, Output Gain knob, and toggle buttons for Soft Clip / Lookahead / Delta. Wire to global state."

### Prompt 6: Single Band Strip (controls only)

> "Build BandStrip component showing the controls panel for one band: 4 knobs (2 attack, 2 sustain), output gain slider, solo button, bypass button, band label badge. Wire to band state."

### Prompt 7: Band Strip List

> "Render all 5 BandStrip rows stacked vertically. Each band uses its color from config. Solo/bypass interactions work correctly (solo dims others, bypass grays out the strip)."

### Prompt 8: Waveform Canvas

> "Build WaveformCanvas component. Generate synthetic waveform data that responds to attack/sustain values — transient spike height changes with attack, tail decay changes with sustain. Render band-colored waveform with delta overlay in gold. Include scrolling animation."

### Prompt 9: Crossover Editor

> "Build CrossoverEditor as a horizontal log-frequency bar with 4 draggable colored dots. Colored regions between dots match band colors. Dots can't cross each other. Show frequency on hover."

### Prompt 10: Integration + Polish

> "Integrate all components into the final layout. Apply final styling: backgrounds, borders, glows, spacing. Ensure the layout matches the mockup proportions (1160x800). Add subtle animations for knob changes and toggle states."

-----

## Appendix A — Key DSP Architecture Decisions (from report)

For reference when moving from UI prototype to real plugin implementation:

1. **Crossover topology:** LR4 (Linkwitz-Riley 4th order) IIR, 4 crossover points for 5 bands. Maintains phase coherence at crossover frequencies. Flat magnitude response when bands are summed.
1. **Detection method:** Dual-envelope difference. Fast envelope (short attack) tracks transients. Slow envelope (longer attack) tracks sustain. Difference = transient signal. Normalize by slow envelope for level-independent detection.
1. **Gain smoothing:** Asymmetric — fast attack on gain increases (to catch transients), slow release on gain decreases (to avoid clicks). Per-band smoothing coefficients.
1. **Low-band sidechain HPF:** Apply an 80 Hz high-pass filter to the Sub band's *detector* input (not the audio path). Prevents low-frequency energy from falsely triggering transient detection. Critical for clean bass handling.
1. **Recombination:** Sum all band outputs after per-band gain application. LR4 crossover guarantees flat summing when gains are at unity.

## Appendix B — Differences from Original Spec

| Original Spec                       | Mockup (Followed)                           | Rationale                                                                                 |
|-------------------------------------|---------------------------------------------|-------------------------------------------------------------------------------------------|
| 4 bands                             | 5 bands (Sub, Low, Low-Mid, High-Mid, High) | Mockup adds Sub band — useful for bass-heavy material                                     |
| Vertical columns per band           | Horizontal rows per band                    | Mockup uses rows with waveform display — better use of space                              |
| Transient response curve graph      | Per-band waveform with delta overlay        | User's revision: waveforms with delta color are more useful than abstract envelope curves  |
| 2 knobs per band (attack + sustain) | 4 knobs per band (2 attack + 2 sustain)     | Maps to dual-envelope: amount + time constant per stage                                   |
| Crossover as EQ-style draggable     | Horizontal bar in global controls           | Mockup places it in the global bar, cleaner layout                                        |
