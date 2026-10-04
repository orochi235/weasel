---
'@weasel-js/core': patch
---

The animator computes tweens, springs, physics and decay in blits. Every signature is unchanged.

- Springs, physics and decay follow closed forms, so a spring lands in the same place at any frame rate. Their values differ slightly from the previous integrator's, and they settle on a different frame. A value that isn't a number, a number array or an object of numeric fields, or constants the closed forms can't solve, still uses the previous integrator.
- A tween of a number array or an object of numbers no longer needs an `interpolate`.
- A tween of anything else with no `interpolate` or `interpolator` now throws when `tween` is called, instead of on its first frame. `setTarget` and `setVelocity` throw when the value's shape differs from `from`'s.

At 10,000 tweens a frame costs about 3× what it did; at 1,000, 0.06 ms against 0.02. Springs cost slightly less than before.
