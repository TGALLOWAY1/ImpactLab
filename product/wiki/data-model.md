# Data Model

## Primary state tree

```txt
RootState
├─ bands: Record<BandId, BandState>
├─ global: GlobalState
├─ abSlot: 'A' | 'B'
├─ abOther: { bands, global, presetName }
└─ presetName: string | null
```

## Band model (observed)
- `attack` (-100..100, bipolar %)
- `sustain` (-100..100, bipolar %)
- `attackTime` (0..100) — scalar on the band's base attack time. The worklet
  applies `baseAttackMs * 2^((attackTime - 50) / 25) * speedMultiplier`, i.e.
  0.25x..4x. Surfaced in the UI as milliseconds via `effectiveTimeMs()`.
- `sustainTime` (0..100) — same scaling on the release time.
- `mix` (0..100 %) — per-band dry/wet blend. (Was missing from this list.)
- `outputGain` (-30..+6 dB)
- `solo` (bool)
- `bypass` (bool)

Per-band base time constants live in `BAND_TIME_DEFAULTS` and differ by band
(sub 5 ms / 200 ms through high 0.2 ms / 30 ms), which is why the UI shows the
resolved milliseconds rather than the raw 0-100 scalar.

## Global model (observed)
- gain/mix/bypass: `inputGain`, `mix`, `outputGain`, `globalBypass`
- detector/control: `detectionSpeed`, `detectionMethod`, `multibandLink`
- processing flags: `delta`, `softClip`, `lookahead`
- crossover config: `crossoverFreqs` (4 breakpoints for 5 bands)

## Presentation tokens
- Band accent colours: `src/constants/bands.js` (also consumed by canvas
  rendering, so they must stay JS values).
- Everything else theme-able: `src/styles/tokens.css` as CSS custom properties.
- JS mirror of the canvas-relevant tokens: `src/styles/canvasPalette.js`.

## Configuration constants
- Band metadata: `src/constants/bands.js`
- Defaults and initializer: `src/constants/defaults.js`
- Ranges/presets/mappings: `src/constants/dspMapping.js`, `src/constants/presets.js`

## Data unknowns requiring investigation
- Exact persisted/exported schema contract stability across versions.
- Formal guarantees for mapping ranges to worklet parameters (currently code-convention based).
