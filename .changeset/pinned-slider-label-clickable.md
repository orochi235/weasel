---
'@weasel-js/ui': patch
---

A pinned slider row's label can be clicked back to auto again. A stacked slider row pulls its track up under its label, and once the row was pinned the track sat over the label's auto toggle and took the click — visibly so at `density="tight"`. The toggle now draws above the track.
