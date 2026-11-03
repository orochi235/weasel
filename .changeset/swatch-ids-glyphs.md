---
'@weasel-js/ui': patch
---

A `SwatchGrid` option can take an `id` beside its color, so two swatches of one color are told apart: the grid's `value` names the current swatch by id, and `onChange` and `onAltChange` hand back the id with the option as a second argument. With no `id` a swatch is keyed by its color, as before. An option can also draw a `glyph` (a string or any React node) centered over its paint, in its own `ink`; the glyph is only seen, and the label stays the accessible name. `SwatchStrip` palettes take the same options and still hand back the color applied. `SwatchButton`, `useSwatchApply` and `swatchId` are exported from the package entry, for a palette laid out by its own rules.
