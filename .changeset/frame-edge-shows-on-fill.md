---
'@weasel-js/ui': patch
---

The rules either side of a `PropertyGroup` title show in light mode. A `MotifFrame` took its edge color from `--wzl-border` and its fill from `--wzl-surface-sunken`, which are the same gray in light mode, so the rules, and a `notch` or `stereo` frame's edge on a sunken ground, were drawn in the color behind them. The edge is now mixed from the frame's own surface, 12% of the way to the text color: light mode gains the rules, and dark mode looks as it did. A stance that names a border color still draws in it.
