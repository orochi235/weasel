---
'@weasel-js/renderer': patch
---

Registering a program a renderer already compiled from the same source no longer recompiles it.

So adding a shader to `<Canvas shaders>` no longer repaints every retained layer.

<!-- entry: fix perf -->
