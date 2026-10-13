---
'@weasel-js/ui': patch
---

Fixes for a `Badge` with `onRemove`, and for one drawn with `base`.

A removable badge with an action of its own (`onClick`, `href`, or `as="button"`/`as="a"`) took a click only on its label text. The whole badge now takes it, padding and the gap before the remove control included, and the remove control takes only itself. On `pill` and `plain`, which can wrap across lines, the padding to the right of the remove control is not part of the click target, and a `padding` prop does not move the target's edge on those two shapes.

A badge drawn through the compose pipeline showed no focus indicator: one given `base`, and the built-in shapes that compose one, such as `square`, `hexagon`, `cloud`, and `ribbon`. It now draws a ring that follows the composed outline, effects and `bloat` included, as the other SVG shapes do.

The remove control is centered on the label's capitals in every shape and size; on `pill` and `plain` it sat about a pixel low. On `plain` it is now one `em` across, 10 to 13px by size where it was 12 to 16px, so it fits inside the badge's box.

For anyone styling the internals: the remove control no longer sets its own `font-size`, its glyph is absolutely positioned inside it, and in the shapes other than `pill` and `plain` the content wrapper of a removable badge with an action is no longer `position: relative`.
