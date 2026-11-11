---
"@weasel-js/geom": patch
---

`resolveSnap` measures a target's reach where the targets alone move the probe, so a fallback such as a grid, snapping another axis, no longer carries a target in reach out of it. A pointer within reach of a horizontal guide, beside a grid line across it that took it just past reach, snapped to the grid on both axes; it now lands on the guide, with the grid holding the other axis.
