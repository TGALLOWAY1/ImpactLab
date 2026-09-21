# Test fixtures

`impulse-loop.wav` — 1 second, 44.1 kHz stereo, four synthetic drum-like hits
per bar with energy at 60 Hz, 900 Hz and 5 kHz so that every one of the five
bands sees signal.

Generated, not recorded, so it carries no licensing constraints and gives
repeatable snapshots. Used by `capture-snapshots.mjs`; override with the
`SNAPSHOT_AUDIO` environment variable to capture against real material.

This is not the demo loop the UI's "Load Demo Loop" button fetches — that one is
Pannage's "Drum loop (Carrai Pass)", CC BY-SA 3.0, pulled from Wikimedia at
runtime. See docs/demo-loop-attribution.md.
