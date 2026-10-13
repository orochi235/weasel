---
'@weasel-js/core': patch
---

Adds API: `Bivariant` and `ScopedScene` are exported from `@weasel-js/core`. `DerivePathFn`, `DerivePoseFn`, and `ClipFromPoseFn` are written in terms of the first, and `sceneUnitScopes` takes the second, so a consumer can now name both.
