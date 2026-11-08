---
'@weasel-js/storage': patch
'@weasel-js/audio': patch
---

Fix teardown gaps in storage and audio.

- `createMemoryAdapter` no longer reports a change to a subscriber that unsubscribed while the change was on its way.
- A record cache no longer sends a write made while its `close()` was still flushing.
- `engine.analyser()` throws once the audio engine is disposed, as `engine.graph()` does, instead of handing out a tap nothing tracks.
- The audio engine stops listening for unlock gestures once its context closes, rather than calling `resume()` on a closed context at every press.
