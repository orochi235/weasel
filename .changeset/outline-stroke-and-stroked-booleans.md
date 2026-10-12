---
'@weasel-js/core': patch
---

Outline Stroke, and Boolean operations that can count an operand's stroke.

Adds API: the `outlineStroke` action (`outlineStrokeAction`, in the `pathfinder` group, part of the `paths` feature) and `applyOutlineStroke` replace each selected stroked path with the region its stroke covers, filled in the stroke's paint; a node that is also filled keeps its fill as a path of its own underneath, grouped with the outline when the adapter mints containers. It runs through the `createOutlinesAdapter` dep, which gains optional `getWorldPath` and `getPaint`; an adapter without them leaves the action disabled.

Adds API: `applyBooleanOp` and `useBooleans` take `strokes`: `'ignore'` (the default, and what every operation did before), `'unfilled'` (an operand with a stroke and no fill is the region its stroke covers), or `'include'` (every operand is what it paints, fill and stroke together). `BooleansAdapter` gains optional `getPaint`, which either mode needs, and `createPathNode` is passed a fourth argument, `paint`, when the topmost source's stroke went into the result's shape: the result must wear that paint and not the source's stroke again. Changes behavior: the built-in Pathfinder actions pass `'unfilled'`, so a line or an open pencil stroke with no fill is now an operand by the ink it draws, where it used to be the unseen region its path encloses; an adapter without `getPaint` behaves as before.

Adds API: `PathPaint` and `pathPaintOf`, the resolved fill and stroke of a node that keeps them in `data.fill` and `data.stroke`, as the built-in path painter reads them.

Changes API: `CreateOutlinesAdapter.createPathNode` is passed a `Path` where it was passed a `PolygonPath`, since a filled node's own path can be a rect.
