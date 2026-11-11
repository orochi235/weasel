---
"@weasel-js/symmetry": patch
---

`mirrorAcross` takes its axis within a half turn before doubling it, so a mirror, `both`, a kaleidoscope, or a glide whose angle is near the double range's end reflects across that axis, where doubling it overflowed and the copy was made of `NaN`.
