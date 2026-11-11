---
"@weasel-js/parallax": patch
---

`tiledProject` and `createTiledLayer` name every cell the view touches where the division rounds onto a cell boundary, so a tiny bleed or a view edge an ulp short of a cell no longer leaves a gap at the edge. `createParallaxLayer` draws nothing of its world sources when the plane is so deep or zoomed so far that its view has no finite transform, instead of drawing them through an infinite one. `createParallaxPlane`'s `set` with a patch that changes nothing no longer notifies, and keeps the object `get` returns.
