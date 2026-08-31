---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Edit a node's stroke as the union it is

`data.stroke` holds `string | Stroke`, and the schema described it with a
`color` leaf — which reads `undefined` off the object form, shows its own
default, and writes a bare hex back over the stroke's width, cap, join and
dash on the first edit. The same trap `ToolPrefPaint` was introduced to avoid
for `FillStyle`.

A `stroke` pref kind now describes it, and `defaultNodeProperties` uses it.
Its control shows whichever color the value has — the string itself, or a
solid paint's color — gives a gradient stroke the indeterminate chip rather
than claiming a color it doesn't have, and preserves the form on write.

`PrefsForm` gained the `stroke` case and the `paint` case it never had; a
`paint` leaf used to render as the literal text `(paint: no renderer)`.
`solidColorOf`, `strokeColorOf`, `strokeWithColor` and `isStrokeObject` are
exported from `@weasel-js/ui` for consumers writing their own property
renderers against either union.

Cap, join and dash are not editable from a panel yet, and `data.strokeWidth`
remains its own leaf — see `docs/proposals/2026-08-26-node-stroke-union.md`
for why that waits on the SVG mapping.
