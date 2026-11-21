---
'@weasel-js/renderer': patch
---

The GL recorder answers one location per program and name, as a real context does.

An attribute's lookup returns the index `bindAttribLocation` gave it, or else the lowest free one.

<!-- entry: fix -->
