---
'@weasel-js/core': patch
---

`resolvePreviews(sources, scene)` reads what an in-flight gesture is proposing,
with no renderer in it.

An ongoing action publishes interim poses on its handle rather than writing them
to the scene, and until now `<SceneCanvas>`'s ghost layer was the only thing that
knew how to read them: which ids are in flight, whose preview wins when two
sources name the same id, which previewed nodes are roots and which are their
previewed children, and which are merely displaced rather than dragged. None of
that is about drawing. A consumer with its own renderer needed all of it and had
to rebuild it from `Dispatcher.getInFlightHandles()`.

It returns the previewing subtrees as roots, each carrying the committed node
beside the interim pose and data; `flattenPreviews` walks them parents-first.
`usePreviewGhostLayer` now draws from it, and the 3D lab under
`packages/labkit/examples/3d-lab` reads its drag ghosts through it instead of
its own copy.

The overlay channel — marquee, lasso, insert preview — is not covered: those
arrive as `DrawCommand[]`, which is core's own 2D renderer vocabulary.
