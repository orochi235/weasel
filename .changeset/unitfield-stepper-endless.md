---
'@weasel-js/ui': patch
---

A `UnitField` with `steppers` and an `endless` end no longer disables its stepper at that bound, where the arrow key still steps on to infinity. Each stepper is now disabled exactly when its arrow key has nowhere left to step, typed text included.
