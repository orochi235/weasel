---
'@weasel-js/paint': patch
---

`lerpOklch` no longer hangs when a hue is `Infinity` or `-Infinity`: the hue comes back `NaN`, as it already
did for a `NaN` hue. Finite hues interpolate exactly as before.
