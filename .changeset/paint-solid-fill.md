---
'@weasel-js/paint': minor
---

New `solidFill(color)`: a fill of one color, `{ paint: { kind: 'solid', color } }`, that fits both `Fill` and `CommandFill`.

Unlike `solid`, it leaves an alpha channel in the color string rather than moving it to `opacity`.

<!-- entry: api -->
