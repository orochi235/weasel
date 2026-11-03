---
'@weasel-js/core': patch
'@weasel-js/history': patch
'@weasel-js/registry': patch
---

A bare scene call allocates less: it opens its edit mode and pose-write label without building closures, `history.apply` keeps the one-op array it builds rather than copying it, a history push builds its step only when something observes steps, an emitter reuses its listener array until the listeners change, and the pose-write log skips its flush when nothing is pending. `scene.setPose` takes about 10 ns less, 0.24 µs on an M3 Max (9 interleaved runs). Nothing observable changes; `history.applyOps` still copies the array it is handed.
