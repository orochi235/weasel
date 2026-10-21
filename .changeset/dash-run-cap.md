---
'@weasel-js/paint': patch
'@weasel-js/stroke': patch
'@weasel-js/pdf': patch
---

A dash pattern too fine for the path it strokes now strokes solid instead of making work without bound: `dashPattern` (`@weasel-js/paint`) takes the path's length and reads a pattern that would cut it into more than `MAX_DASH_RUNS` (100,000) dash and gap runs as `'solid'`. The tessellator decides this once per path, over every subpath, and `@weasel-js/pdf` writes no dash for the same strokes. `@weasel-js/stroke` exports `dashLength`, the length a pattern runs along a path.
