---
'@weasel-js/text-dom': patch
---

`useTextEdit`'s `nodeStyle` and `effectiveStyle` keep reporting the node style an open edit rewrote while its `container` is `null`, matching what a commit then writes.

<!-- entry: fix -->
