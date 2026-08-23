---
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

Add a source rect and flip to `ImageDrawCommand`, so one bitmap can be drawn as
many frames.

`source` is a sub-rectangle in bitmap pixels; `flipX` / `flipY` mirror the
sampled region within the destination rect without moving the quad. Both are
additive and optional — a command that sets neither draws exactly as before.
Until now a sprite sheet needed a custom `ShaderDrawCommand` to do what is
arithmetic on the quad's four UV pairs.

`source` is not range-checked: a rect past the bitmap edge samples outside
`[0..1]`, which `CLAMP_TO_EDGE` smears. With `sampling: 'linear'` the filter
also reaches half a texel beyond `source`, so an atlas whose frames touch will
bleed at the seams — pad frames with a gutter or use `'nearest'`. The renderer
deliberately does not inset for this, which would make an exact 1:1 blit soft.

New `frameRect(sheet, index)` and the `SpriteSheet` type turn a uniform grid
(`frameWidth`, `frameHeight`, `columns`, optional `margin` and `spacing`,
following the Tiled / Aseprite convention) into that source rect. It is
row-major from 0 and does not wrap past the last cell — wrapping belongs to the
animation, since a sheet does not know how many of its cells are filled.

`@weasel-js/hud`'s image widget takes `source`, `flipX` and `flipY` as options
and gains `setSource` and `setFlip` to change them in place. `setFlip` merges,
leaving an omitted axis alone. Without the setters a sprite animation would
have to dispose and rebuild the widget every frame.
