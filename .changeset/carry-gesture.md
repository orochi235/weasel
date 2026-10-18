---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

A press that begins on one element and is released over a canvas is a gesture of its own, `carry` (`CarrySpec`), the in-app sibling of an OS drop. `startCarry(origin, pointerdown, { type, value }, callbacks)` opens one from any element; every dispatcher's element is a surface for it unless `channels={{ carry: false }}`, and the surface under the pointer dispatches it through its bindings. An ongoing action bound to `{ kind: 'carry', types }` starts as the carry comes over the surface and reads the payload from `ctx.carry`: moves update it, the release commits it, and leaving the surface or a canceled press cancels it. An immediate action fires on the release, with the payload in `params.carry`. `onEnd` tells the source whether a binding took the drop.

labkit's palette drag-drop is a carry now, and a drop routes through the trial canvas's dispatcher beside its pan, zoom, and tap, as the `labkit.paletteDrop` action. This is breaking for a direct `useDragDrop` caller: it no longer takes `canvasContainerRef`, `view`, or `worldSpec`, and its result carries a `target` to render inside the `<CanvasStack>` the palette drops onto. A drop now lands only where nothing else on the page covers the canvas.
