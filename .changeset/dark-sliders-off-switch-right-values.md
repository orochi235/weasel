---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

A range's track and thumb are easier to see in dark mode: both mix from `--wzl-accent-fg`, the bright accent there, and `--wzl-slider-track-mix` and `--wzl-slider-thumb-mix` are 40% and 100% in dark mode. Light mode keeps 18% and 70% of the same color it had.

An off `Switch` has a muted gray track, a share of the text color, where its sunken fill disappeared on a dark surface.

A `PrefsForm` row sets its control at the row's far edge, and a select's value at that edge inside it, so the values line up down a pane.

A `PrefsForm` rail entry is set at `--wzl-font-size`, the size of a control's text in the pane beside it, up from `--wzl-font-size-sm`.
