---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Live symmetry: draw on one side of an axis and the mirrored half follows. A `symmetry` dep holds the setting, `{ axis: 'vertical' | 'horizontal' | 'both', center }`. While it answers one, the kit's `insert` dep follows every node it builds with its mirrored twins in the same batch, so the drawing and its mirror land and undo as one step. Every tool that inserts through that dep gets it: the shape tools, the pencil, and the pen. Pose and data are both mirrored, the data through the canvas's `geometryProjection` when there is one; text and images, which have no geometry to mirror, stay single. `mirrorInsertOps(ops, symmetry, ctx)` is the transform underneath, for a caller building its own inserts.

In path edit, dragging an anchor or a handle on a path that is its own mirror image moves its partner too, and an anchor on the axis stays on it. A path that is not symmetric edits as before.

`symmetryContribution(store)` installs it on a canvas through `ambient`: it publishes a `SymmetryStore` (`createSymmetryStore`) as the dep, and draws the axis with a handle at its center that drags it (`symmetryAxisDragAction`, through the `snap` dep). Only the handle takes a press, so a stroke can still start on the line. `symmetryAxisLayer` is the layer on its own.

The insert dep's types (`InsertDep`, `InsertExtras`, `InsertLive`) moved to their own module; they are still exported from the same place.

`@weasel-js/geom` adds the edits underneath: `anchorMirror(set, m, tolerance)` pairs a path's anchors with their mirror images, or answers `null` for a path that is not its own image, and `translateAnchorsMirrored` and `moveHandleMirrored` move a partner with what is dragged.
