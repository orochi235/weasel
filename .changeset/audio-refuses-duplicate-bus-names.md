---
'@weasel-js/audio': patch
---

`createAudioEngine` throws on a bus name given twice in `buses`. Before, the repeat left an unreachable fader wired to the master.

<!-- entry: fix -->
