---
'@weasel-js/renderer': patch
---

`createGLRecorder` keeps object handles and uniform and attribute locations distinct across `reset()`.

A program built after a reset no longer shares a location with one built before it.

<!-- entry: fix -->
