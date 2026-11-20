---
'@weasel-js/core': patch
---

A tween draws at most 4096 steps, so a tiny `distance` or an infinite `steps` no longer hangs the page.

It warns in development when it caps them.

<!-- entry: fix behavior -->
