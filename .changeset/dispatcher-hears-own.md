---
'@weasel-js/routing': patch
---

`useGestureDispatcher` takes `hears: 'own'`, which matches only the actions registered at its registry's own node and not those of the canvases nested under it.
