---
'@weasel-js/kernel3d': minor
---

`createCameraDep(world, { set })` builds the `camera3d` dep from the world the other deps use: its camera, pane size and up.

A z-up host no longer has to repeat its up on the dep for a pan and a dolly to slide the right way.

<!-- entry: rank=5 new api -->
