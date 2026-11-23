---
'@weasel-js/audio': patch
---

`createAudioEngine` throws on a bus name given twice in `buses`, rather than leaving a second fader of that name wired to the master that no handle reaches.

<!-- entry: fix -->
