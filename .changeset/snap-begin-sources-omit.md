---
"@weasel-js/core": patch
"@weasel-js/kernel3d": patch
---

`SnapBegin` takes `sources` and `omit`, so one gesture can ask snap sources the canvas does not list, or skip ones it does (a listed, registered or default source, by id), without changing the canvas. Gesture sources are ranked with the canvas's own, and one sharing an id with a source still asked throws. Gesture sources are 2D: kernel3d's `createSnap` honors `omit` but does not ask a gesture's `sources`, and warns once in dev when it is given some.
