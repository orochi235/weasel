---
'@weasel-js/forge': patch
---

A forge link keeps a knob set to `-Infinity` when its default is `Infinity`. An argType's `if: { eq: null }` no longer holds for an arg that is `NaN` or infinite.

<!-- entry: fix -->
