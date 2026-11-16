---
'@weasel-js/paint-kinds': minor
---

New package `@weasel-js/paint-kinds`: the registry of the kinds a `Paint` can be, each with its draw slots, label, glyph, editor and SVG.

`registerPaintKind`, `getPaintKind`, `switchGradientKind` and the rest are on its main entry, the hooks that list the kinds on `@weasel-js/paint-kinds/react`, and importing `@weasel-js/paint-kinds/mesh` registers the mesh kind at once rather than on first use. Its glyphs are the `paint-kinds` icon namespace, in `@weasel-js/paint-kinds/icons`.

<!-- entry: rank=10 new api -->
