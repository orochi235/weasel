---
"@weasel-js/labkit": patch
"@weasel-js/forge": patch
---

A lens's reticle marks the patch the lens shows: the body's box divided by the factor, in the body's shape, where it was a fixed 16 px circle. It resizes with a new factor and, in the same undo step, with its body. It takes no resize handles. `RETICLE_SIZE` is removed, which breaks any import of it; `reticleAt` places a Follow reticle at its current size.

A lens's chrome strip hangs below the reach of its body's handles, so the bottom handles of a selected body take presses again.

`<CanvasStack>` sizes its canvases from its layout box and puts any ancestor transform's scale into their backing density. Under a magnifying lens it draws sharp, where it used to enlarge a canvas sized from its scaled client rect. The density is capped at 4096² backing pixels a layer.
