---
'@weasel-js/core': patch
---

The built-in actions and tools read their deps at the types `DepSchema` declares instead of casting each one. `gestureViewReader` and `gesturePlaneReader` take `Pick<ActionDeps, 'view'>`, so a `view` that is not a `ViewApi` is a type error rather than a runtime one.
