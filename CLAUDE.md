# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ImpactLab is a **Transient Shaper MB** (multiband transient shaper) audio plugin project. The goal is to build an interactive React UI prototype that reproduces the NB3 mockup layout, eventually evolving into a JUCE/framework-native plugin UI.

## Architecture

- **5-band multiband** transient shaper: Sub, Low, Low-Mid, High-Mid, High
- **DSP design:** LR4 IIR crossovers (4 crossover points), dual-envelope detection, per-band time constants, asymmetric gain smoothing, sidechain HPF on low-band detector
- **UI prototype:** React with JSX, using `useReducer` for state management across 5 band states + global state
- Per-band controls: 4 knobs (2 attack, 2 sustain mapping to gain amount + envelope time), output gain slider, solo/bypass toggles
- Global controls: input/output gain, mix, detection speed, transient mode, crossover frequencies, soft clip/lookahead/delta toggles

## Key Reference

The comprehensive development plan is at `docs/transient-shaper-mb-dev-plan.md`. It contains:
- Complete data model definitions (band config, per-band state, global state)
- DSP-to-UI parameter mapping table
- Per-band default time constants and detection speed presets
- 10-phase implementation order with specific prompts for each step
- Target file structure under `transient-shaper-mb/src/`

## Implementation Notes

- Follow the **mockup** (5 bands), not the original spec (4 bands)
- Band colors are defined in the dev plan (Step 0.1) — use consistently across all components
- Knob interaction: click+drag vertical to adjust, double-click to reset
- Waveform displays use synthetic data in the prototype (no real audio)
- Multiband Link: when enabled, adjusting one band's attack/sustain offsets all bands proportionally
