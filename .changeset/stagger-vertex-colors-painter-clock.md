---
'@weasel-js/core': patch
---

`staggerVertexColors` no longer jumps straight to its end colors. It published a function-form override that read its timestamp as time since the stagger began, but `createPathLayer` calls a function-form override with `performance.now()`, so on screen every anchor finished the moment the stagger started. The helper now publishes a plain color array on each tick, the same way `tweenVertexColors` does.
