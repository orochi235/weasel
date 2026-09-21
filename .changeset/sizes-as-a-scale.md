---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

Draw a group of sizes as one grid of steps, generated from a base.

Three or more numbers, dimensions or durations sharing a group now draw the way
a color family does: one compact grid, each cell labeled with what its name adds
to the shared prefix (`2xs`, `1`, `track-h`). A group whose steps all carry one
unit says it once beside the group name; `slider` and `tracking`, whose units
differ, keep a unit per cell.

`TokenPanel` takes `scales` and `onScaleChange` for a group that is generated
rather than authored step by step. Such a group edits its base and its rule —
one multiplier per step, a constant ratio, or a constant step — with the
multipliers sitting under the steps they scale, and `refitScale` fits the new
rule to the steps as they stand when the rule changes. The panel reports the
parameters; regenerating the values stays with the consumer.

forge's CSS Vars panel wires that to the theme's own scales: the rule comes from
the definition, the base is read back from the values the frame reports, and the
steps are regenerated with the engine's `scale` so rounding matches the build.
A swatch also names its variable in a tooltip the moment it is hovered, in place
of the browser's delayed `title`.
