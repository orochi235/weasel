---
'@weasel-js/routing': patch
---

The canvas drops a gesture's cursor as soon as the gesture ends without a pointer release or keyup, as on a window blur or a tool switch, instead of keeping it until the pointer moves.

<!-- entry: fix visual -->
