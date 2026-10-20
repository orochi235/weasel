---
'@weasel-js/audio': patch
---

Add a patchable audio graph: `engine.graph(bus)` returns nodes that can be added, removed, replaced, connected and re-parameterized while it plays, every edit crossfaded. New source nodes play a looping file, an oscillator or noise; gain, pan, mix, filter, delay, reverb and compressor nodes process. `impulseResponse(ctx, seconds)` generates a decaying-noise impulse, which a reverb node uses when it is given `seconds` rather than an `impulse`. `tap(id)` puts an analyser on any node. `createAnalyserTap` now accepts any `BaseAudioContext`.
