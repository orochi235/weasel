---
"@weasel-js/ui-input": patch
---

`moveItems` ignores an index that is not a whole number, as it ignores one outside the list. `movedIndex`, `isNoopDrop` and `nudgeGap` read indices the same way.

<!-- entry: rank=-5 fix -->
