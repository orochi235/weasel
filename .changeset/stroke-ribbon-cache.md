---
'@weasel-js/core': patch
---

Stroke ribbons are tessellated once per stroke configuration instead of once
per frame. The renderer rebuilt every stroked path's ribbon geometry on every
frame and discarded it; it now caches the result on `Path` identity, keyed by
the parameters that change the ribbon — width, cap, join, miter limit,
alignment, dash, and flatten tolerance. Paint and vertex colors are not in the
key, since both are applied over the same triangles at draw time.

A ribbon that survives a frame also stops paying for a fresh VAO and two
buffers on every subsequent frame. One whose path or stroke parameters change
each frame keeps the transient upload it had before, freed at end of frame —
so an animated or freshly drawn path never accumulates GL resources waiting on
garbage collection.

Nothing about the drawn result changes. The cache is keyed on object identity,
matching the fill cache: a `Path` rebuilt with equal coordinates is a distinct
entry and re-tessellates.
