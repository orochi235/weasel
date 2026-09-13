---
"@weasel-js/audio": patch
---

The audio engine now reuses each voice's `GainNode` and `StereoPannerNode`
instead of building a new pair on every `play()`. Only the
`AudioBufferSourceNode` is still created per play, because a source can only be
started once.

In headless Chromium this took the engine from 37.17 to 26.14 µs per `play()`
with 32 voices and 8 plays a frame, and from 30.58 to 18.71 µs at 32 plays a
frame. `tests/perf/audio-voice-chain.mjs` reproduces these numbers: run it with
`--base <ref>` to compare two revisions. How long the audio thread takes to
render is unchanged.

A pair that isn't in use is disconnected from its bus. Left connected, 96 idle
pairs took the audio thread 166 ms to render 20 s of silence, where the same
graph without them took 20 ms. The engine keeps at most `voiceLimit` idle pairs
per bus, and creates new ones beyond that.

A handle whose voice has ended no longer changes anything. Calling `setGain`,
`setPan`, `setPosition` or `stop(fadeMs)` on it used to write to that voice's
own disconnected nodes, which had no audible effect. Those nodes can now belong
to another voice, so the calls are ignored instead.
