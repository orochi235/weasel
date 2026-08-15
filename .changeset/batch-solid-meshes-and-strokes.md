---
'@weasel-js/core': patch
---

Batch solid-fill meshes and stroke ribbons alongside rects, so a stroked shape
costs one draw instead of two plus a fresh VAO every frame.

`RectBatch` becomes `SolidBatch`, with a `pushMesh` alongside `pushRect` that
appends transformed vertices and rebases the mesh's indices onto the staged run.
Solid path fills and solid stroke ribbons both take it, and land in the same
draw as each other: GL rasterizes a draw's primitives in index order, so staging
the ribbon after its own fill is what keeps the stroke on top.

Frame cost at 3,200 commands, M2 Max via ANGLE at 800x600 (`npm run test:perf`,
new `meshes` and `stroked` variants):

| variant | before | after |
|---|---|---|
| solid-fill octagons | 5.63 ms | 0.65 ms |
| stroked rects (fill + ribbon) | 243.80 ms | 9.41 ms |

The stroke figure is the interesting one, and not for the reason the plan
assumed. A draw call is ~1.8 us when nothing is touched between draws; what
costs is issuing a draw against a buffer minted that same frame, which is
exactly what a per-frame stroke ribbon did. Of the 9.41 ms left, 7.9 ms is
stroke tessellation, which batching does not address.

Excluded from a run: stencil fills, inner/outer-aligned polygon strokes, and
anything carrying per-vertex colors, all as before — plus meshes past a vertex
cap, since batching re-copies a mesh every frame where the persistent mesh cache
would not. Rects pay ~0.1 ms per frame at 3,200 for the index buffer becoming a
per-flush upload rather than a static pattern.
