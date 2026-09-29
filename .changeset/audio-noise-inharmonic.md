---
'@weasel-js/audio': patch
---

Noise and inharmonic synth voices, all additive. `engine.playNoise({ noise: 'white' | 'pink' | 'brown', duration, envelope, filter, ...playOptions })` plays noise looped from a seeded buffer made once per color per context, under the same ADSR envelope as `playNote`, and returns an ordinary `VoiceHandle` sharing the bus's voice pool, stealing and `cancelKey`. `playNote`'s `wave` also takes `{ partials: [{ ratio, gain, decay }] }`: sine oscillators at any ratio of the pitch, each with its own level and exponential decay, for bells, bars and struck metal. `partialPresets` holds `bell`, `marimba` and `metal`.

Both voices take a `filter`: a biquad ahead of the envelope, with `type`, `frequency`, `Q`, `gain`, and an optional cutoff `envelope` whose level moves the cutoff by `amount` Hz. Pattern players accept noise events (`{ step, noise, length, … }`). Also exported: `noiseSamples`, and the types `NoiseOptions`, `NoisePatch`, `NoiseColor`, `Inharmonic`, `SynthPartial`, `VoiceFilter` and `PatternNoise`.
