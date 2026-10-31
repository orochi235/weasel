---
'@weasel-js/ui': patch
---

`Plot2D`'s `grid.color` and `axes.color` now take effect: they set `--plot-grid` and `--plot-axis` rather than an SVG `stroke` attribute the stylesheet outranked.
A `divider` motif's heading drops the browser's heading margin and font at every `level`, not only at the default `h4`.
A `Powerline` given an `aria-label` is exposed as a named group; the label was ignored before.
`IconPicker` draws its keyboard focus ring in `--wzl-focus-ring` instead of the accent.
**Breaking:** `isMeshPaint` is removed from `@weasel-js/ui`; use `isMeshGradientPaint` from `@weasel-js/core/mesh`, which it only forwarded to.
