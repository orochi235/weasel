---
'@weasel-js/core': patch
---

A `tweenLoop` (or a `loop` of tweens) whose duration reached 0 hung the tab when it had no `count`, and ran every iteration of a counted one inside a single frame. An animation started while a frame is ticking now waits for the next frame, so a zero-duration loop runs one iteration per frame.
