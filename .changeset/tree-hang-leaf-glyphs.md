---
'@weasel-js/ui': patch
---

A `Tree` can hang a leaf's glyph in its gutter. Additive: `TreeProps` gains `hang`, under which a leaf's `leading` stands where a branch has its fold mark, so a leaf's label starts at the same x with a glyph or without. It has no effect under `guides`. `PrefSchemaEditor`'s action list sets it.

`ShortcutKeys` letters its keycaps at the UI font's normal weight, where they were bold.
