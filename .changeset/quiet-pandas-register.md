---
'@weasel-js/audio': patch
---

Add `engine.register(buffer)` for playing an `AudioBuffer` the consumer already
holds — a procedural synth, an `OfflineAudioContext` render, a recording. `load`
and `decode` both assume encoded bytes; neither covers audio you generated.
