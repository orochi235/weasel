---
'@weasel-js/renderer': patch
---

A convex clip that is not an axis-aligned rect (a rect turned off the axes, a convex polygon of up to eight edges) no longer breaks the batch on a single-sampled canvas: the batch shader tests each fragment against the clip's edges, snapped to a sixteenth of a device pixel, and keeps exactly the pixels the stencil would. On a multisampled canvas, which is the browser default, such a clip still goes on the stencil: WebGL2 gives a fragment shader no way to keep some of a pixel's samples and drop the rest.

`DrawContext.batchFillMatrices` is replaced by `DrawContext.batchVariants`, which also carries the hull-clipping builds; code that builds its own `DrawContext` and set the old field needs to set the new one.
