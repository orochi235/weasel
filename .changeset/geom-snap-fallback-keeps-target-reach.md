---
"@weasel-js/geom": patch
---

A pointer within reach of a guide snaps to it even when a grid line across it would pull it just out of reach. The grid then holds only the other axis: `resolveSnap` measures a target's reach where the targets alone move the probe.

<!-- entry: fix -->
