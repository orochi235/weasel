---
'@weasel-js/diagram': patch
---

The `chain` layout, and the `rack` look built on it, now leave room for group boxes across the line as well as along it. The gap between two levels of hung nodes widens by the inset of a group ending at one and starting at the other, so a box's inset no longer overlaps an outsider hung past it when the inset is wider than `nodeGap`. On a vertical line it also widens for a group's `minWidth`, which before it honored only on a horizontal one. Grouped chain layouts with hung nodes come out slightly taller (or wider) than before.
