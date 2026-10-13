---
'@weasel-js/core': patch
---

Additive, with one behavior change: rotating with Shift held snaps the angle to 15 degree steps. `snapRotationWithModifier({ key, step })` is the behavior, and a rotate binding that names no `behaviors` gets it through `DEFAULT_ROTATE_BEHAVIORS`, the way a resize gets the Shift aspect lock. What snaps is the angle the first rotated node ends at; the rest of a multi-selection turns by the same amount. Pass `rotate: { behaviors: [] }` to `selectionRotateContribution` or `selectionTransformContribution` to turn it off; an empty list used to be dropped there and now reaches the binding.

A `RotateBehavior.onMove` may return `{ rotation }` in radians where it only changes the angle, in place of a whole pose.

Making Shift snap by default was a judgment call, taken from how resize already treats Shift.
