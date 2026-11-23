# Audit round 79 — core.core findings

## useSceneStream disposes its stream in an effect cleanup but builds it in useMemo, so a remounted effect keeps a disposed stream
- where: packages/core/src/core/stream/useSceneStream.ts:15-16 (useSceneStream)
- scenario: under `<StrictMode>` (or any effect replay React does for an unchanged memo, e.g. Activity/offscreen reveal) React runs the effect, its cleanup, then the effect again. The cleanup calls `stream.dispose()` (TileStream disposed, edit pass removed); the memo still returns the same, now disposed, stream and nothing recreates it. Every later `update` drives a disposed TileStream with no edit pass, so recorded edits on streamed nodes are no longer adopted, and nothing streams in or out as it should. The stream should be created and disposed by the same effect (or recreated when the effect re-runs).
- evidence: read (TileStream.dispose in packages/tiles/src/stream.ts:96 sets `disposed` and releases every held tile)
- severity: medium

## Dropping a cell removes adopted nodes that sit under, or derive from, a streamed node
- where: packages/core/src/core/stream/streamScene.ts:94-97 (release)
- scenario: a cell answers parent P with child C. The user moves C (recorded edit) → C is adopted, P stays streamed. The view leaves the cell; `release` calls `scene.removeMany([P])`, which takes P's subtree and its dependents (types.ts:148-151), so C, which the doc promises "stays in the scene for good" so undo can find it, is removed outside history. Undoing the move then targets a missing node. Release should keep (or reparent / adopt the ancestors of) any streamed node whose subtree or dependents contain an adopted node.
- evidence: read
- severity: medium

## A cell load that throws partway through `scene.add` leaves the nodes it already added in the scene, untracked by the stream
- where: packages/core/src/core/stream/streamScene.ts:86-90 (load)
- scenario: a source answers two specs with the same `id` in one cell (both pass the `fresh` filter, since it checks the scene before either is added), or a child naming a parent the cell does not hold. `fresh.map((spec) => scene.add(spec))` throws on the second; the first is already in the scene, but `ids` is never assigned, so it is never put in `streamed`, never released when the cell drops, and survives `dispose`. The error goes to `onError` and the cell is retried, and the retry's filter skips the leaked id, so the leak is permanent. Should record each id as it is added (or roll back the cell's adds on a throw).
- evidence: read
- severity: low

## usePointerStylus treats an element from another window as a ref and listens to nothing
- where: packages/core/src/core/stylus/usePointerStylus.ts:72 (usePointerStylus effect)
- scenario: a popout window's element (the case `watchDevicePixelRatio` names explicitly) is passed directly as `target`. `target instanceof HTMLElement` is false across realms, so the code reads `target.current`, gets `undefined`, and binds nothing; the hook reports IDLE forever. Same for an `SVGElement` target. Should test for a ref by shape (`'current' in target`) rather than by the global `HTMLElement` constructor.
- evidence: read
- severity: low

## Files read
packages/core/src/core/adapters/testing/rootsTree.ts
packages/core/src/core/adapters/types.ts
packages/core/src/core/applyOps.ts
packages/core/src/core/device/index.ts
packages/core/src/core/device/targets.ts
packages/core/src/core/device/types.ts
packages/core/src/core/device/useDeviceProfile.ts
packages/core/src/core/device/useTargetBasePx.ts
packages/core/src/core/device/watchDevicePixelRatio.ts
packages/core/src/core/isPlainObject.ts
packages/core/src/core/modifierState.ts
packages/core/src/core/pbt.fixture.ts
packages/core/src/core/persistence/codec.ts
packages/core/src/core/persistence/pbt.fixture.ts
packages/core/src/core/persistence/sceneDocument.ts
packages/core/src/core/selection/chromeState.ts
packages/core/src/core/selection/legalSelection.ts
packages/core/src/core/selection/readOnlySelection.ts
packages/core/src/core/selection/selectionContract.ts
packages/core/src/core/selection/selectionTarget.ts
packages/core/src/core/selection/usePublishSceneSelection.ts
packages/core/src/core/selection/viewerSelection.ts
packages/core/src/core/shapeKinds.ts
packages/core/src/core/stableStringify.ts
packages/core/src/core/stream/streamScene.ts
packages/core/src/core/stream/useSceneStream.ts
packages/core/src/core/stylus/stylus.ts
packages/core/src/core/stylus/usePointerStylus.ts

<!-- done: 4 findings, files read: 28 -->
