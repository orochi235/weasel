---
'@weasel-js/ui': patch
---

Add `layoutRows`, `layoutColumns` and `layoutGrid` — one square field cut three
ways, for choosing how a workspace tiles.

They are drawn in ink rather than outline because `grid` is already an outlined
3x3 on the same field: at 16px an outlined layout grid and the grid you snap to
are the same picture.

`gen-icons.mjs` now throws when two glyphs claim one name with different
drawings. It used to skip the second in silence, so a new glyph could vanish
into an existing key with the generator still reporting success — which is how
`layoutGrid` got its name.
