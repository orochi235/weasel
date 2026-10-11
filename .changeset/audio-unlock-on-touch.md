---
'@weasel-js/audio': patch
---

`createAudioEngine`'s automatic unlock listened once for `pointerdown`, `keydown`, and `touchstart`. On a touch screen a tap grants audio at `pointerup`, `touchend`, and `click`, so the first tap used up the listeners without starting the context and every later `play()` was dropped. The engine now listens for `pointerdown`, `pointerup`, `touchend`, `click`, and `keydown`, and keeps listening until the context is running.
