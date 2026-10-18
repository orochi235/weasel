---
'@weasel-js/animator': patch
---

A time scale below 0 plays an animation backward. `setTimeScale(-1)` on a handle, by key with `setTimeScaleByKey`, or on the animator runs each animation's clock back toward its start, while the animator's own clock goes on forward. Run back to its start, an animation ends there as it ends at its end going forward: a tween or spring on a target commits its start value, one with `onTick` is handed its `from` last, and `onDone` runs. A timeline's playhead runs back through the laps it has looped and ends at 0, firing no events on the way; a stagger ends once what it has in flight is back at its start. An animation started while the animator plays backward is at its start already, and ends at once. A time scale that is not a finite number is still refused.
