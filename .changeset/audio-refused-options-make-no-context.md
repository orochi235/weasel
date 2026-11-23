---
'@weasel-js/audio': patch
---

`createAudioEngine` refuses an empty `buses` or a `voiceLimit` under 1 before it makes an `AudioContext` of its own, so a refused call leaves no running context behind.

<!-- entry: fix -->
