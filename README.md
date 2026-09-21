# Transient Shaper MB

A **multiband transient shaper** audio plugin prototype — split your signal into 5 frequency bands and sculpt the attack and sustain of each independently.

<img width="931" height="644" alt="image" src="https://github.com/user-attachments/assets/62fe982b-91d0-4bbd-a6a6-a53096a6235a" />


## What Is Transient Shaping?

Transient shaping controls the **dynamics envelope** of audio without relying on a fixed threshold like a compressor. Instead, it detects the natural attack and sustain phases of each sound and lets you boost or cut them directly:

- **Boost attack** to add punch and presence to drums, plucks, and percussive sounds
- **Cut attack** to soften harsh transients and push sounds further back in the mix
- **Boost sustain** to bring out room tone, reverb tails, and body
- **Cut sustain** to tighten sounds, reduce bleed, and create a gated effect

Unlike compressors, transient shapers are **level-independent** — they respond to the shape of the waveform, not its amplitude, making them more predictable and musical.

## Why Multiband?

Traditional single-band transient shapers process the full spectrum at once. This means sharpening a kick drum's attack also sharpens the hi-hat bleed in the same signal. Multiband solves this by splitting the audio into **5 frequency bands** before shaping:

| Band | Range | Typical Use |
|------|-------|-------------|
| **Sub** | Below crossover 1 | Tighten or fatten sub-bass without affecting mids |
| **Low** | Crossover 1–2 | Add punch to kick drums, control bass guitar sustain |
| **Low-Mid** | Crossover 2–3 | Shape snare body independently from cymbals |
| **High-Mid** | Crossover 3–4 | Enhance vocal presence, tame harsh transients |
| **High** | Above crossover 4 | Control cymbal sustain, add air to transients |

Each band has its own attack/sustain controls, output gain, solo, and bypass — giving you surgical control over the dynamics of each frequency region.

## Features

- **5-band processing** with LR4 (Linkwitz-Riley 4th order) IIR crossovers for phase-coherent band splitting
- **Per-band controls**: Attack amount & time, Sustain amount & time, Mix, Output gain, Solo, Bypass. The time knobs read out in resolved milliseconds rather than an abstract 0-100 scalar.
- **Dual-envelope detection**: Separate fast and slow envelope followers for accurate transient/sustain separation
- **4 detection methods**: Dual Envelope, Peak vs RMS, Derivative, Energy Flux
- **3 detection speeds**: Slow, Medium, Fast — scales all per-band time constants proportionally
- **Multiband Link**: Adjust one band and all others follow proportionally, maintaining relative differences
- **Draggable crossover editor**: Visual log-scale frequency display with draggable crossover points
- **Per-band waveform display**: Real-time visualization of input, processed, and delta signals
- **Global controls**: Input/Output gain, Dry/Wet mix, Soft Clip, Lookahead, Delta monitoring
- **Preset picker** over 7 built-in presets, with A/B compare slots
- **Keyboard and touch control of every parameter**: all 37 continuous controls are `role="slider"` with the WAI-ARIA slider key contract (arrows, Shift for fine, PageUp/Down, Home/End, Backspace to reset), driven by pointer events so touch and pen work
- **Fit-to-viewport scaling**: the 1400x860 surface scales uniformly rather than reflowing, mirroring how a JUCE plugin editor scales in a host

## Technical Details

### DSP Architecture

- **Crossover network**: 4× LR4 IIR filters (24 dB/oct slopes) ensuring flat magnitude response when bands are summed
- **Envelope detection**: Dual-path detector with fast attack follower and slow RMS follower; the difference identifies transient events
- **Gain smoothing**: Asymmetric ballistics — fast attack for immediate transient response, slower release to avoid pumping artifacts
- **Sidechain HPF**: High-pass filter on the low-band detector input to prevent sub-bass energy from falsely triggering transient detection
- **Per-band time constants**: Tuned defaults from 5 ms attack / 200 ms release (Sub) down to 0.2 ms / 30 ms (High), reflecting the natural transient characteristics of each frequency range

### Per-Band Default Time Constants

| Band | Attack | Release |
|------|--------|---------|
| Sub | 5.0 ms | 200 ms |
| Low | 2.0 ms | 150 ms |
| Low-Mid | 1.0 ms | 100 ms |
| High-Mid | 0.5 ms | 50 ms |
| High | 0.2 ms | 30 ms |

Source of truth: `BAND_TIME_DEFAULTS` in `src/constants/dspMapping.js`. The
per-band time knobs scale these by `2^((value - 50) / 25)` (0.25x to 4x), and the
detection-speed selector scales them again by 2.0 / 1.0 / 0.5.

### UI Prototype Stack

The current implementation is a **React UI prototype** that reproduces the full plugin layout:

- **React 18** with `useReducer` for centralized state management
- **Vite 5** for fast development builds
- **Zero external UI libraries** — all controls (rotary knobs, sliders, waveform canvases, crossover editor) are built from scratch with SVG and Canvas
- **CSS Modules over a custom-property token layer** (`src/styles/tokens.css`), which is what makes focus rings, hover states and `prefers-reduced-motion` expressible

### Project Structure

```
transient-shaper-mb/
├── src/
│   ├── App.jsx                    # Root component + state reducer
│   ├── components/
│   │   ├── PluginShell.jsx        # Fit-to-viewport scaling wrapper
│   │   ├── Header.jsx             # Wordmark, preset picker, A/B, reset, bypass
│   │   ├── AudioSourceControls.jsx# Prototype transport (power/load/play/export)
│   │   ├── GlobalControls.jsx     # Global parameters + crossover editor
│   │   ├── BandStrip.jsx          # Single band channel strip
│   │   ├── BandStripList.jsx      # 5-band container
│   │   ├── RightPanel.jsx         # IN/OUT/GR metering rail
│   │   ├── WaveformCanvas.jsx     # Per-band waveform visualization
│   │   ├── CrossoverEditor.jsx    # Log-scale crossover bar
│   │   ├── CrossoverHandle.jsx    # One draggable crossover point
│   │   ├── DetectionMethodSelector.jsx
│   │   └── ui/                    # Reusable control components
│   │       ├── RotaryKnob.jsx     # SVG rotary knob
│   │       ├── VerticalSlider.jsx # Vertical dB fader
│   │       ├── ToggleButton.jsx   # Two-state button
│   │       └── SpeedSelector.jsx  # Detection speed radio group
│   ├── constants/                 # Band config, defaults, DSP mapping
│   ├── hooks/                     # useParameterControl, useRadioGroup,
│   │                              # useAudioEngine, useMeters, waveform hooks
│   └── styles/                    # tokens.css + canvasPalette.js
├── fixtures/                      # Generated audio for reproducible snapshots
├── capture-snapshots.mjs          # Writes /product/snapshots evidence
└── screenshot.mjs                 # Quick full-size + scaled captures
```

Each component has a sibling `*.module.css`. Every theme-able value lives in
`src/styles/tokens.css`; the five band accent colours stay in
`src/constants/bands.js` because the canvas renderer needs them as JS strings.

### Verification

There is no unit-test suite yet (tracked in `/product/todos`). What exists is a
pair of Playwright scripts that drive the real app:

```bash
npm run verify        # both of the below
npm run verify:ui     # ARIA coverage, the full keyboard contract, pointer drag,
                      # crossover log mapping, multiband-link float drift,
                      # contrast ratios and the 10px type floor
npm run verify:audio  # engine start, file load, playback, per-band canvas
                      # output, meter levels, delta, solo, WAV export, and that
                      # canvas backing stores track the scaled viewport
npm run snapshots     # refresh /product/snapshots evidence
```

## Getting Started

```bash
cd transient-shaper-mb
npm install
npm run dev
```

Open the local URL shown in the terminal to view the plugin UI prototype.

## Roadmap

This React prototype serves as the interactive design reference. The next phase involves porting the UI to a **JUCE/framework-native plugin** with real-time DSP processing.
