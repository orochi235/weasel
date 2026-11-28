---
'@weasel-js/routing': patch
---

A drag canceled mid-gesture (a lost pointer, a window blur) hands its `onEnd` the point it last reached and its `drag` start, delta and trail, rather than world (0, 0) and no `drag`.

<!-- entry: fix -->
