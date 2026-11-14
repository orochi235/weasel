---
'@weasel-js/core': patch
---

A path effect saved as a blend loads as the tween it was renamed to, live, rather than painting nothing.

`pathEffectOf` reads `kind: 'blend'` as `'tween'`, so a scene saved before the rename keeps its steps, and the next edit writes the effect back as a tween.

<!-- entry: fix data -->
