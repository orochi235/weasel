---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/hud': patch
---

`--wzl-fg-muted` and `--wzl-fg-subtle` are now a step down from the text color in effect rather than fixed grays: `rgb(from currentColor r g b / 0.7)` and `/ 0.54` in dark mode, `/ 0.78` and `/ 0.64` in light. Muted text on an accent fill, a raised row, or a sunken rail follows the text beside it instead of landing on a gray picked for the default surface, and muted text nested in muted text no longer compounds. Under `--wzl-fg` both steps clear WCAG 4.5:1 on every neutral surface in both modes; dark-mode subtle text previously did not.

In a property other than `color` the step is taken from the element's own `color`. `Checkbox`, `SwatchGrid`, `PatternPicker`, and `Disclosure` now inherit their text color so their hover edges and disabled fill step down from it, and `Slider`'s thumb fills from `--wzl-fg` directly. Nested entries in the `PrefsDialog` rail are drawn a step down from the entry they sit under again.

The resolved theme record carries these tokens as CSS, since a canvas has no `currentColor`. New `resolveCurrentColor(value, current)` flattens one to a concrete color; the HUD window's title uses it.
