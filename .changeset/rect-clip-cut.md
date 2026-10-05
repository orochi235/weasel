---
'@weasel-js/core': patch
---

A clip that is an axis-aligned rect no longer breaks the batch. The renderer
cuts staged geometry to it on the CPU instead of writing it to the stencil, so
a clipped group's content shares a draw with what surrounds it. The clip falls
back to the stencil only where it must: for content that draws for itself, and
for content with a slanted edge across the clip's edge. Rotated or non-rect
clips are unchanged.
