---
"@weasel-js/core": minor
---

The built-in path and shape painters accept a `FillStyle` in `data.fill`.

`kit:path` and `kit:shape` typed `data.fill` as a color string and emitted
`{ color }`, so a node could not carry a gradient or a pattern without the
consumer registering a painter of its own — even though the renderer has taken
every `FillStyle` variant since the paint model landed. The two painters were
the narrow point, not the renderer.

`data.fill` is now `string | FillStyle` (exported as `NodeFill`). A string
still means a solid color, `'none'` still skips the fill, `undefined` still
falls back to `data.color` and then to the default — and only when there is no
stroke, so a stroke-only pencil path stays unfilled. An object is used as-is.
`ink()` agrees with `paint()` on all of it, which the existing agreement test
plus a new one both check.

One behavior change beyond the widening: `kit:shape` used to paint `'none'` as
a literal color, since only `kit:path` special-cased it. It now skips the fill,
matching `kit:path` and matching what the string obviously means.

This is the kit half of gradient and texture fills. The app half — widening
WeaselDraw's own data shape, a fill-kind switch in the properties panel, a
gradient editor with on-canvas handles, and matching SVG `<linearGradient>` /
`<pattern>` export — is untouched.
