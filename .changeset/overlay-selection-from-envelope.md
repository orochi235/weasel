---
'@weasel-js/core': patch
---

Draw selection chrome for the view that asked, not for the canvas.

`createSelectionOverlayLayer`'s `getSelection` is now optional. Omitted, the
layer takes its ids from the `ChromeState` on the draw envelope — the same
channel it already read the multi-selection union AABB from. `<Canvas>` and
`<SceneCanvas>` stop passing one, so the single overlay layer a surface builds
outlines whichever view is drawing it.

The multi-selection split is unchanged: the handle pass works against the
synthetic union id, the outline pass against the real members.
