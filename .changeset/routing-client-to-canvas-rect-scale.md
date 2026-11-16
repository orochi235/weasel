---
'@weasel-js/routing': patch
---

`clientToCanvasRect` divides out the `scale` of a box that carries one, as `layoutBoxOf` returns, so a box measured once maps a client point the way `clientToCanvas` does.

<!-- entry: api -->
