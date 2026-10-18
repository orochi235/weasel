---
'@weasel-js/audio': patch
---

`createAudioEngine` takes `synthVoices: 'worklet'`, which renders `playNote` and `playNoise` voices in an `AudioWorkletProcessor` from events posted when they are played, rather than building nodes when the scheduler fires. A voice played ahead of a main-thread stall then starts on time. Its handle, bus pool, stealing, pan and position behave as a node voice's do. The processor loads from a `blob:` URL, so a CSP has to allow `script-src blob:`; `unlock()` waits for it to load, and until it has, or where it cannot, synth voices play on nodes. The default, `'nodes'`, is unchanged, and an engine that never asks for the worklet does not load its source.
