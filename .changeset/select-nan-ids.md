---
"@weasel-js/select": patch
---

`select` and `rangeOf` treat ids as a `Set` does, so a `NaN` id toggles off and can start or end a range, and `-0` is `0`.

<!-- entry: rank=-5 fix -->
