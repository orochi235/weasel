---
'@weasel-js/renderer': patch
---

A text layer that has to draw text by text frees the GPU buffers it had already uploaded for it.

<!-- entry: fix perf -->
