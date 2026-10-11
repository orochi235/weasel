---
'@weasel-js/core': patch
---

An even-odd path with a hole lost the hole wherever it was not a plain fill: as a group `clip` its children painted across the hole, a stroke with `align: 'inner'` or `'outer'` treated the hole as inside the shape, and a fill with `vertexColors` filled it. All three now cut the hole the way the fill does.
