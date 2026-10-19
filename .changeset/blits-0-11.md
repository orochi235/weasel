---
'@weasel-js/animator': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

Depend on `@msb235/blits` 0.11.0, where stopping an animation no longer costs time in step with how many are running. blits' `loop` now defaults to one pass; no voice weasel cues depends on it, since each is either a motion (a tween or a spring) or a patch with no duration, and blits ignores `loop` for both.
