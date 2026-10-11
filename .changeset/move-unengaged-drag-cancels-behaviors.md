---
'@weasel-js/core': patch
---

A move drag released before it travels `dragThresholdPx` cancels its behaviors. It used to run each behavior's `onEnd`, so a behavior could commit ops for a move that never started, with `onGestureStart` and `onGestureEnd` never fired around it.
