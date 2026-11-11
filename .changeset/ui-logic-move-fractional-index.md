---
"@weasel-js/ui-logic": patch
---

`moveItems` ignores an index that is not a whole number, as it ignores one outside the list. Given `[0.5]`, it took nothing out and put an `undefined` in, so the list grew. `movedIndex`, `isNoopDrop`, and `nudgeGap` read their indices the same way.
