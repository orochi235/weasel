---
'@weasel-js/core': patch
---

`SceneCanvasApi.camera` hands out the canvas's camera as an animation target, with the animator that moves it: `{ target, animator }`. An animation started on that animator with that target adds to an `animateView` glide in flight, so a shake or a nudge no longer needs a camera of its own.
