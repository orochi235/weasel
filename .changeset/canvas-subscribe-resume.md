---
'@weasel-js/core': patch
---

`CanvasExtensionApi` gains `subscribeResume(fn)`, which runs `fn` when the canvas's frame loop resumes after a hidden tab or an offscreen canvas suspended it. A `subscribeBeforePaint` or `subscribeFrame` subscriber that advances by the time between frames can now rebase its clock there; before, an hour in a background tab arrived as one hour-long step. Frame times also no longer run backward: a `syncPaint` paint made inside another animation-frame callback could be followed by a frame carrying an earlier timestamp.
