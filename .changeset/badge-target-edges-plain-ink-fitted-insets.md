---
'@weasel-js/ui': patch
---

More fixes for `Badge`.

On `pill` and `plain`, a removable badge with an action of its own now takes a click on its whole box except the remove control: the padding to the right of the control was left out, and a `padding` prop did not move the click target's edges. A badge wrapped across lines takes it on every fragment, with `breakStyle` `slice` or `clone`. The remove control also stays on the line of the label's last word instead of wrapping onto a line of its own, unless the line cannot hold that word and the control together; with `breakStyle="clone"` it can still wrap alone over a span of line widths as wide as the badge's right edge.

The `padding` prop is now applied as four custom properties, `--badge-pad-top`, `--badge-pad-right`, `--badge-pad-bottom`, and `--badge-pad-left`, rather than as an inline `padding`. The padding it produces is the same. The root also carries `data-break` when `breakStyle` is set.

A `plain` badge is legible in every variant. `variant="solid"` computed its ink for a fill that `plain` never paints, so the label was white on a light surface and near-black on a dark one. All three variants now use the status color, and the muted text color for the `neutral` status; `solid` still sets the label bold.

The `quatrefoil`, `octant-spline`, `octant-bspline`, and `puzzle` bases keep their content inside their outline at any label length. Their outline dips inside the box by a share of the box, so with fixed insets it ran through a long label and the remove control. A badge whose content the base's declared insets already keep clear of the outline is the size it was. Otherwise each inset grows, never under what the base declares, to the smallest box that keeps the measured content clear, so a badge on one of these bases is wider with a long label than it was. `BaseModule` gains an optional `fitsContent` flag that turns this on for a base.
