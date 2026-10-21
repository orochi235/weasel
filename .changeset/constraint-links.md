---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Constraint links now hold through whole-node transforms, preview through every path-edit drag, and have a gesture that makes them.

- core: `PathEditExtension.finishTransform(ctx: PathTransformFinishCtx)` answers the other nodes a move, resize, rotate, flip, nudge or transform-again changes along with the ones it transforms — align and distribute too — committed in the same history entry; the `editAnchors` dep runs it as `transformOps(ops, label)`, and those actions now declare `editAnchors`. An extension may refuse a transform by answering null.
- core: `pathEditPreview` finishes each frame itself through the new `finishPathEditFrame`, so bend segment and the path-tools drags preview the node's constraints and linked nodes as they will commit. Breaking: its `current` thunk now answers a `PathEditFrame` (`{ path, origins? }`) instead of a bare path.
- geom: `PathsEditItem.yields` lets a path the edit left alone give way freely.
- path-tools: the constraints extension carries linked nodes through whole-node transforms; `constraintLinkConflictsOf(scene, id)` reports the links tying a node that do not hold; `linkAnchorAction` (in `constraintsPreset`) links an anchor Alt-dragged onto another node's anchor (`coincident`) or segment (`onPath`), with `linkTargetAt` and `linkConstraint` beside it.
