---
'@weasel-js/core': patch
---

An inline `toolOptions` with array or object fields no longer rebuilds the presets' tools each render.

Fields such as `insert.behaviors` are compared by what they hold.

<!-- entry: fix perf -->
