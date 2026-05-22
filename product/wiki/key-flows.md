# Key Flows

## 1) Main playback flow
1. User initializes engine.
2. User loads audio file.
3. Source connects to audio graph.
4. User adjusts controls (reducer updates state).
5. State serializes to worklet; output/meter/viz update.
6. User plays/stops and optionally exports.

## 2) Parameter edit flow
1. UI control emits value.
2. Dispatch action updates reducer.
3. Multiband-link logic may fan out attack/sustain changes.
4. Hooks propagate new state to DSP node.
5. Visual components re-render with updated values.

## 3) A/B comparison flow
1. Start in slot A.
2. Copy current slot to other snapshot or switch slots.
3. Slot switch swaps live state and snapshot backing.

## 4) Preset flow
1. User selects preset.
2. Preset is loaded from constants.
3. Ephemeral globals are preserved by reducer during load.

## 5) Explainer flow
1. Route to `#/explainer`.
2. Drum loop loaded/synthesized.
3. Scene variants are pre-rendered.
4. Playback and scene-dependent dry/wet transitions run.
5. Optional recording path writes media output.
