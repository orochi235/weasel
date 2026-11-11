---
"@weasel-js/guides": patch
---

Equal spacing takes a gap the box keeps to one neighbor, equal to no other, for no equal spacing. A box centered between two neighbors that another axis's snap moved off one of them kept its gap to the other, marked it alone, and moved again when snapped from there; `matchSpacing` and `spacingSnapSource` now drop such a snap.
