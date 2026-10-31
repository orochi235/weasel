---
'@weasel-js/core': patch
---

`reconcileSpecs` now puts siblings in `next`'s order wherever a parent's children there differ from `prev`'s, by an addition or a reorder. A node added among existing siblings used to land after all of them, so it could paint above a node `next` listed after it. A reorder made in the scene still stands while `next` keeps the same order, and a child no spec names keeps its place.
