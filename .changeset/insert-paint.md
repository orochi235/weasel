---
'@weasel-js/core': patch
---

`<SceneCanvas insertPaint>`: choose the fill and stroke of a shape the kit's insert builds, without replacing its geometry. It takes `(kind, seq) => { fill?, stroke? }`; a key left out stays off the node and `null` means none. The default, exported as `paletteInsertPaint`, is the palette cycle the kit already used, so nothing changes for a canvas that passes no `insertPaint`. Additive: a new optional prop, the `InsertPaint` type, and `paletteInsertPaint`.
