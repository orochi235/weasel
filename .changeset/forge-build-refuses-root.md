---
'@weasel-js/forge': patch
---

`weaselforge build` refuses an `--out` that is or holds the vite root, rather than writing the build over its source files.

<!-- entry: fix behavior -->
