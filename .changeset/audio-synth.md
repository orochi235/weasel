---
'@weasel-js/audio': patch
---

Synth voices and a pattern player, both additive. `engine.playNote({ pitch, duration, wave, envelope, glide, ...playOptions })` plays an `OscillatorNode` under an ADSR envelope, with pitch as hertz, a note name or `{ midi }` and `wave` as a built-in shape or harmonic partial amplitudes (built into a cached `PeriodicWave`). It returns an ordinary `VoiceHandle` and shares the bus's voice pool, stealing and `cancelKey` with buffer voices. `VoiceHandle` gains `release()`: a note-off that runs the envelope's release from its current level, and is `stop()` for a buffer voice. `engine.schedule(when, fire, key?)` exposes the lookahead scheduler for booking callbacks against the audio clock.

`createPatternPlayer(engine, { tempo, stepsPerBeat, events, length, loop, onStep })` is a step sequencer over notes and buffer hits, booking each step through `engine.schedule` so `setTempo` and `setEvents` land on the next step; a step that fires late skips ahead in phase rather than playing the missed steps at once. Also exported: `toFrequency`, `midiToFrequency`, `noteToMidi`, and the pure envelope helpers `resolveEnvelope`, `envelopeLevel` and `envelopePoints`.
