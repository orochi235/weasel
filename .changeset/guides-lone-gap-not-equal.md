---
"@weasel-js/guides": patch
---

Equal spacing no longer snaps a box to a gap it keeps to one neighbor and that matches no other gap.

`matchSpacing` and `spacingSnapSource` drop such a snap, so a box another axis's snap moved off center stays where it lands when snapped again.

<!-- entry: fix -->
