---
'@weasel-js/core': major
'@weasel-js/paint-kinds': minor
---

The paint-kind swatches and the none and inherit glyphs move from the `core` icon namespace to `paint-kinds`, renamed for it.

This is breaking: `core:paintSolid`, `core:paintLinear`, `core:paintRadial`, `core:paintConic`, `core:paintMesh`, `core:paintPattern`, `core:paintNone` and `core:paintInherit` are now `paint-kinds:solid`, `paint-kinds:linear`, `paint-kinds:radial`, `paint-kinds:conic`, `paint-kinds:mesh`, `paint-kinds:pattern`, `paint-kinds:none` and `paint-kinds:inherit`. An app passing tables by hand adds `@weasel-js/paint-kinds/icons`; `kitIcons` and the build plugin include it. The glyphs are drawn as before.

<!-- entry: breaking api -->
