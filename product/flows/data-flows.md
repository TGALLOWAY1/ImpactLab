# Data Flows

## Control flow to DSP
UI interaction -> reducer action -> state update -> `useAudioEngine` serialization -> `AudioWorkletNode.port.postMessage` -> worklet parameter application.

## Audio flow
Audio file -> decode/load in source hook -> connect source node -> worklet processing -> destination output (+ optional media destination for recording/export).

## Visualization flow
Worklet writes meter/viz buffers -> realtime hook reads buffers (SAB path when available) -> per-band canvas render.

## Explainer flow
Scene/keyframe metadata -> variant prerendering -> per-frame blend + draw -> dry/wet gain automation during playback.
