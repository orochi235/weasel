---
"@weasel-js/renderer": patch
---

A trimmed stroke drawn under a clip uses its own trim, even when its mesh was uploaded earlier without one or for another shader.

<!-- entry: fix visual -->
