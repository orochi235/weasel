---
'@weasel-js/animator': patch
---

animator: a hold covers the move an animation's destination makes in the committed value. `tween({ target, to })` or `spring({ target, to })` started under a hold used to jump the value on screen by the hold's weight times the travel and settle back; now a full hold shows none of it and a hold at 0.5 shows half, with no jump. A coast, a spring pushed where it stands, and a `from` away from the committed value still add on top of the hold. This changes what shows: a tween with no `from` no longer plays over a full hold, a tween or spring canceled under a hold commits its remaining move at once where it used to wait beside the hold, a hold released with a commit takes the share it covered of each move with it, and a spring's `setTarget(null)` commits where the spring had brought the value before it coasts.
