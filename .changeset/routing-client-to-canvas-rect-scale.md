---
'@weasel-js/routing': minor
---

`clientToCanvasRect` divides out the `scale` of a box that carries one, as `layoutBoxOf` returns.

A box measured once then maps a client point the way `clientToCanvas` does; a bare `DOMRect` maps unscaled, as before.

<!-- entry: api -->
