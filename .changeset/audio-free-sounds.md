---
'@weasel-js/audio': minor
---

`engine.free(sound)` and `SoundCache.free` let go of a loaded, decoded, or registered sound's buffer, and `engine.dispose()` now frees every one.

A voice already playing a freed sound plays on; one that comes due later drops as `unready`. `SoundCache.clear()` frees every handle at once.

<!-- entry: api fix -->
