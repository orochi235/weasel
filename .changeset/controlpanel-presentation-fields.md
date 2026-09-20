---
'@weasel-js/labkit': patch
---

A labkit control panel honors the three presentation fields a schema leaf could
already declare but `ControlPanel` ignored.

`.pair('Offset')` on two adjacent leaves draws them side by side on one row the
pair names, the way weasel-ui's `SelectionPanel` merges the same annotation.
Each cell keeps its own path and writes only itself; a leaf whose control the
lab draws itself, and one that needs the whole row (a slider, a paint, an
object), stays on a row of its own.

`.unit(prefUnit(ANGLE_RADIANS, 'deg'))` on a number stores the canonical value
and edits the displayed one: the field shows 90 for a stored π/2, and the
bounds and step the schema declares in radians convert with it, so a typed
degree is clamped against 0..180 rather than 0..6.28.

`.alpha()` on a color says the value carries alpha as `#rrggbbaa`. The row then
splits it into the `#rrggbb` the swatch holds and the opacity track beside it,
and rejoins them on every write. Without the split an `#rrggbbaa` default is a
value the color input cannot parse, so the first edit wrote back black.
