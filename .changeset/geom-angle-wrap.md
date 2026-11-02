---
'@weasel-js/geom': patch
---

`@weasel-js/geom` exports one definition of each angle operation the packages used to write by hand:
`DEG_TO_RAD` and `RAD_TO_DEG`, `wrapAngle(a, half?)`, which wraps radians to the half circle either
side of zero, and `wrapPositive(a, period?)`, which wraps to `[0, period)` (radians by default, pass
`360` for degrees). A half turn has two names, so `wrapAngle` takes a `HalfTurn` saying which one it
returns: `'max'` (the default) gives `π`, `'min'` gives `-π`, and `'sign'` gives the one with the
input's sign.
