---
'@weasel-js/audio': patch
---

`createAudioEngine` refuses an empty `buses` or a `voiceLimit` under 1 before making an `AudioContext` of its own. A refused call leaves no running context behind.

<!-- entry: fix -->
