---
'@weasel-js/core': patch
---

A derived node is clickable where it paints

A node whose geometry comes from `derivePath` had no silhouette and no `ink`:
`NodeShapeEntry.silhouette` took only `(node, pose)`, and a derived path is
resolved from the *dependencies'* poses, which a painter has no handle on. So
`kit:derived` could not report one, `shapeCoversPoint` read the resulting null
as "no opinion" and answered `true` everywhere, and picking fell back to the
node's own pose — for an edge, a zero-sized placeholder at the origin. An edge
was unpickable, and a derived container contributed no clip.

`silhouette` now takes a `NodeSilhouetteCtx` carrying `derivedPath`, on the
same convention `NodePaintCtx` already uses, and `kit:derived` reports the
derived path as its silhouette and its declared stroke as its `ink`.

Resolving that path needs the scene, so it is the *source* that answers, not
the painter: `PickSource.derivedPathOf`, a matching optional argument to
`buildSceneTree`, and `SceneSlotConfig.derivedPathOf` — the slot already
carried the derived path a node *paints*, and now also the clip a derived
container *imposes*, so the live canvas and the headless walk clip alike. The
bare-adapter paths supply none of them and behave exactly as before.

The pre-filter had to move with it. `useSceneSelectTool` grew its region test
from the node's pose, which for a derived node is the wrong box entirely, so
the edge was rejected before the shape test could claim it. It now tests the
derived path when there is one — `poseContains` already reads a path-like pose
as a path, so this reuses it rather than adding a second reach calculation.

`findShapeSilhouette` skips its memo when handed a derived path. That slot is
keyed on `(node, pose, data)` and cannot see the path, so it would serve one
caller's silhouette to a caller that passed a different one — the same reason
`kit:derived` already skips `PAINT_SLOT`.
