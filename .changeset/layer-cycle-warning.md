---
'@weasel-js/core': patch
---

Two custom layers anchored on each other (`a: { after: 'b' }`, `b: { after: 'a' }`) were reported as a `dangling reference` in the console. `composeOrderedLayers` now reports them as a cycle; they still fall back to the tail.
