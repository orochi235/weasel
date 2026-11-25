# Audit round 39 — core.canvas.deps

## A transform's preview of the other nodes extensions change differs from what its commit writes
- where: packages/core/src/canvas/deps/pathEditCommits.ts:184 (createTransformPreview), vs :163 (transformOps → otherOps → reshapeOps)
- scenario: a path-edit extension's `finishTransform` returns, for a node outside the transform, a `PathEditOther` carrying `data` — either beside a `path`, or alone (no path). `transformOps` commits both: `otherOps` lays `o.data` over the node's data in `reshapeOps`, strips the shape generator and geometry-bound data (`withoutShapeGenerator`, `withoutGeometryBoundData`), and for a data-only other emits a `createSetDataOp`. `createTransformPreview`, documented as "what transformOps would commit for that frame, read the same way", drops every data-only other (`!stored` → `[]`), and for a path-bearing one shows `stored.data` without `o.data` and without the generator/geometry-bound strip. So during the drag the follower node shows its old data (or its generator still regenerating), and on release it jumps to the committed data. The same decision ("what the other node becomes") is answered two ways.
- evidence: read
- severity: medium

## The `editAnchors` dep's setters gate on, and compare against, the editing id captured when the dep was read
- where: packages/core/src/canvas/deps/editAnchors.ts:90-124 (useEditAnchorsDepSource: setEditingId, setSelectedAnchors, setSelectedMark, setMarquee)
- scenario: the dep object is built once per read, with `effectiveId = state.getEditingId()` frozen into it, and the file itself notes a drag holds the dep from its press (line 125). On a held dep read while nothing is edited, `setEditingId('a')` enters the edit, but a following `setSelectedAnchors([0])`, `setSelectedMark(m)` or `setMarquee(r)` on the same object returns early (`if (!effectiveId) return`) — silently dropped, though the state is now editing `a`. Conversely, `setEditingId` decides whether to clear the anchor selection, mark and marquee by comparing `next` with the stale `effectiveId`, not `state.getEditingId()`: a held dep read while editing `a`, after something else switched the edit to `b`, calling `setEditingId('a')` skips the clear, so `b`'s anchor indices are carried onto `a`'s path; and calling `setEditingId('a')` twice on a dep read with nothing edited clears anchors selected between the calls. The setters also mix `state` (captured) with `stateRef.current` (line 104), so an `externalState` swapped between read and call clears one state and sets the id on another. The `handleLocks` getter shows the intended pattern (read live).
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/deps/changes.ts
packages/core/src/canvas/deps/chromeRules.ts
packages/core/src/canvas/deps/colorAt.ts
packages/core/src/canvas/deps/debug.ts
packages/core/src/canvas/deps/dispatchSources.ts
packages/core/src/canvas/deps/dispatcher.ts
packages/core/src/canvas/deps/editAnchors.ts
packages/core/src/canvas/deps/enteredGroup.ts
packages/core/src/canvas/deps/geometryProjection.ts
packages/core/src/canvas/deps/hitTestArea.ts
packages/core/src/canvas/deps/index.ts
packages/core/src/canvas/deps/ingestion.ts
packages/core/src/canvas/deps/insertFactories.ts
packages/core/src/canvas/deps/insertParent.ts
packages/core/src/canvas/deps/insertSite.ts
packages/core/src/canvas/deps/inspection.ts
packages/core/src/canvas/deps/kitSettings.ts
packages/core/src/canvas/deps/layout.ts
packages/core/src/canvas/deps/modeDefaultTool.ts
packages/core/src/canvas/deps/nodeAtPoint.ts
packages/core/src/canvas/deps/operands.ts
packages/core/src/canvas/deps/pathEditCommits.ts
packages/core/src/canvas/deps/pathLeaf.ts
packages/core/src/canvas/deps/poseDescriptor.ts
packages/core/src/canvas/deps/previewPaths.ts
packages/core/src/canvas/deps/selectionSnapshot.ts
packages/core/src/canvas/deps/slice.ts
packages/core/src/canvas/deps/snap.ts
packages/core/src/canvas/deps/surface.ts
packages/core/src/canvas/deps/transformFollowers.ts
packages/core/src/canvas/deps/view.ts

<!-- done: 2 findings, files read: 31 -->
