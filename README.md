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
- **Per-band controls**: Attack amount & time, Sustain amount & time, Output gain, Solo, Bypass
- **Dual-envelope detection**: Separate fast and slow envelope followers for accurate transient/sustain separation
- **3 transient modes**: Punch (aggressive), Snap (tight), Smooth (gentle) — each with tuned detection characteristics
- **3 detection speeds**: Slow, Medium, Fast — scales all per-band time constants proportionally
- **Multiband Link**: Adjust one band and all others follow proportionally, maintaining relative differences
- **Draggable crossover editor**: Visual log-scale frequency display with draggable crossover points
- **Per-band waveform display**: Real-time visualization of input, processed, and delta signals
- **Global controls**: Input/Output gain, Dry/Wet mix, Soft Clip, Lookahead, Delta monitoring
- **Preset browser** with navigation

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
| Low | 3.0 ms | 150 ms |
| Low-Mid | 1.0 ms | 80 ms |
| High-Mid | 0.5 ms | 50 ms |
| High | 0.2 ms | 30 ms |

### UI Prototype Stack

The current implementation is a **React UI prototype** that reproduces the full plugin layout:

- **React 18** with `useReducer` for centralized state management
- **Vite 5** for fast development builds
- **Zero external UI libraries** — all controls (rotary knobs, sliders, waveform canvases, crossover editor) are built from scratch with SVG and Canvas
- **~1,150 lines** of source code across 17 modules

### Project Structure

```
transient-shaper-mb/
├── src/
│   ├── App.jsx                    # Root component + state reducer
│   ├── components/
│   │   ├── Header.jsx             # Top bar with preset browser
│   │   ├── GlobalControls.jsx     # Global parameters + crossover display
│   │   ├── BandStrip.jsx          # Single band channel strip
│   │   ├── BandStripList.jsx      # 5-band container
│   │   ├── WaveformCanvas.jsx     # Per-band waveform visualization
│   │   ├── CrossoverEditor.jsx    # Draggable crossover frequencies
│   │   └── ui/                    # Reusable control components
│   │       ├── RotaryKnob.jsx     # SVG rotary knob with drag
│   │       ├── VerticalSlider.jsx # Vertical dB slider
│   │       ├── ToggleButton.jsx   # Toggle button
│   │       └── SpeedSelector.jsx  # Detection speed selector
│   ├── constants/                 # Band config, defaults, DSP mapping
│   ├── hooks/                     # useKnobDrag, useWaveformGenerator
│   └── styles/                    # Theme tokens
└── docs/
    └── transient-shaper-mb-dev-plan.md  # Full development plan
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
