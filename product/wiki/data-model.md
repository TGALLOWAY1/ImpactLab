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
- `attack` (-100..100)
- `sustain` (-100..100)
- `attackTime`
- `sustainTime`
- `outputGain`
- `solo` (bool)
- `bypass` (bool)

## Global model (observed)
- gain/mix/bypass: `inputGain`, `mix`, `outputGain`, `globalBypass`
- detector/control: `detectionSpeed`, `detectionMethod`, `multibandLink`
- processing flags: `delta`, `softClip`, `lookahead`
- crossover config: `crossoverFreqs` (4 breakpoints for 5 bands)

## Configuration constants
- Band metadata: `src/constants/bands.js`
- Defaults and initializer: `src/constants/defaults.js`
- Ranges/presets/mappings: `src/constants/dspMapping.js`, `src/constants/presets.js`

## Data unknowns requiring investigation
- Exact persisted/exported schema contract stability across versions.
- Formal guarantees for mapping ranges to worklet parameters (currently code-convention based).
