# Audit round 41 — core.core.ops

## writtenBy rebuilds ops through defaultOpRegistry, ignoring the scene's own opRegistry
- where: packages/core/src/core/ops/writtenBy.ts:47 (copyOf)
- scenario: a scene created with `opRegistry: createOpRegistry(...)` (scene exposes it as `scene.opRegistry`, used by restore in `outerOps.ts:90`) holds a host-scoped factory, or overrides a kit name such as `transform`. `writtenBy(sc, ops)` (called by `pathEditCommits.transformOps` / `createTransformPreview`, diagram's `waypointFollower`, labkit's `reticleFollower`) looks the name up in `defaultOpRegistry` instead. A host-only op is not found, so `copyOf` returns null and the *real* op is applied to the recorder — exactly the first-apply side effect the docstring says the copy exists to avoid (an op that records its undo on first apply records it against the recorder's state). An overridden kit name is rebuilt with the kit's factory rather than the host's, so the read can disagree with what the scene will actually commit. Should read `sc.opRegistry`, the same registry the scene rebuilds through.
- evidence: read
- severity: medium

## setPath and setSelection report a no-op from the stated `from`, so a real write can be dropped from history
- where: packages/core/src/core/ops/setPath.ts:53 (createSetPathOp apply); packages/core/src/core/ops/select.ts:32 (createSetSelectionOp apply)
- scenario: the caller's `from` is stale and equals `to`, while the live node/selection differs (e.g. `from` captured before another edit, or from a cached snapshot). `apply` writes `to` through the adapter, then returns `false` because `fieldsEqual(from, to)` / `sameList(from, to)`. History (`entryOps.ts:74`) treats the batch as a no-op and pushes no entry, so the write happened but cannot be undone. The sibling ops answer the same question from the live node — `setPose`, `setData`, `setLayer`, `setDependsOn`, `setLayout`, `setHidden`/`setLocked` all go through `alreadyHolds`, and setPose's own comment says "a stated `from` can be stale". One decision, two answers; setPath/setSelection should read the adapter (`getNode` / `getSelection`) where it has the read, falling back to `from` only when it has none.
- evidence: read
- severity: medium

## Files read
packages/core/src/core/ops/alreadyHolds.ts
packages/core/src/core/ops/arrange.ts
packages/core/src/core/ops/create.ts
packages/core/src/core/ops/createHistory.ts
packages/core/src/core/ops/delete.ts
packages/core/src/core/ops/index.ts
packages/core/src/core/ops/nodeFlags.ts
packages/core/src/core/ops/nodeOps.ts
packages/core/src/core/ops/registry.ts
packages/core/src/core/ops/reorder/algorithms.ts
packages/core/src/core/ops/reorder/index.ts
packages/core/src/core/ops/reorder/setChildOrder.ts
packages/core/src/core/ops/reparent.ts
packages/core/src/core/ops/select.ts
packages/core/src/core/ops/setData.ts
packages/core/src/core/ops/setDependsOn.ts
packages/core/src/core/ops/setLayer.ts
packages/core/src/core/ops/setLayout.ts
packages/core/src/core/ops/setPath.ts
packages/core/src/core/ops/setPose.ts
packages/core/src/core/ops/setText.ts
packages/core/src/core/ops/slot.ts
packages/core/src/core/ops/types.ts
packages/core/src/core/ops/writtenBy.ts

<!-- done: 2 findings, files read: 24 -->
