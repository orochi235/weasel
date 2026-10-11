---
'@weasel-js/core': patch
---

The renderer no longer compiles the `imageFill` program, which nothing drew with: images go through the batch program.
