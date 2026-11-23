## Setting the output grid throws when any off-grid node is locked
- where: packages/core/src/core/scene/outputGrid.ts:79 (quantizePass)
- scenario: a scene with a quantize rule holds a node on a locked layer (or carrying `locked`) whose pose is off the new grid. `scene.doc.set(OUTPUT_GRID_KEY, grid)` makes the pass walk every node (`scene.nodes.keys()`) and emit `createSetPoseOp` for the locked one. Edit passes apply their ops through the adapter without lifting the lock guard (`editPass.ts` `run`), so `scene.setPose` reaches `refuse(id, 'set the pose of')` (`fieldEdits.ts:57`) and throws. The whole grid edit is refused because of one locked node. It should either snap the locked node with the guard lifted, as a replay does, or skip it; it should not throw. The same applies to a `posed`/`dataChanged` id that was written under `scene.unlocked`: the pass's follow-up op runs after that scope has closed.
- evidence: read (outputGrid.ts, editPass.ts run, fieldEdits.ts refuse sites); not run
- severity: medium

## Dev freeze stops at an already-frozen object, so its nested values stay writable
- where: packages/core/src/core/scene/owned.ts:44 (freezePlain)
- scenario: a caller stores `data = Object.freeze({ style: { fill: 'red' } })`, which is frozen only at the top. `own(data)` sees `Object.isFrozen(value)` and returns before descending, so `data.style` is never frozen. A later `node.data.style.fill = 'blue'` slips past history and notifications without throwing. That is exactly the write the dev check exists to catch. The early exit should skip only the freeze call itself and still walk the children, or check frozenness per level.
- evidence: read
- severity: low

## Nested hit tester's ancestor walk hangs on a parent cycle
- where: packages/core/src/core/scene/nestedHit.ts:56 (ancestorChain)
- scenario: an adapter whose `getParent` forms a cycle (a → b → a, such as a half-applied reparent in a consumer's store) makes `ancestorChain` loop forever on every pick, because `unshift` grows the array without bound. `nodeGates` (`above`, `climbs`) guards the same parent walk against cycles and answers "stop". The same question gets two different answers, and here the answer is a hang. It needs the same guard: a `seen` set after N hops.
- evidence: read
- severity: low

## Files read
packages/core/src/core/scene/layoutPass.ts
packages/core/src/core/scene/layoutTypes.ts
packages/core/src/core/scene/lockGuard.ts
packages/core/src/core/scene/minSize.ts
packages/core/src/core/scene/nestedHit.ts
packages/core/src/core/scene/nodeAsShown.ts
packages/core/src/core/scene/nodeFlags.ts
packages/core/src/core/scene/nodeFnFields.ts
packages/core/src/core/scene/nodeFnTypes.ts
packages/core/src/core/scene/nodeGates.ts
packages/core/src/core/scene/nodeLod.ts
packages/core/src/core/scene/nodeMemo.ts
packages/core/src/core/scene/nodeStore.ts
packages/core/src/core/scene/nodeTypes.ts
packages/core/src/core/scene/notifier.ts
packages/core/src/core/scene/opTable.ts
packages/core/src/core/scene/outerOps.ts
packages/core/src/core/scene/outputGrid.ts
packages/core/src/core/scene/outsideReads.ts
packages/core/src/core/scene/owned.ts
packages/core/src/core/scene/pathEffects/derive.ts
packages/core/src/core/scene/pathEffects/effects.ts
packages/core/src/core/scene/pathEffects/foundHidden.ts
packages/core/src/core/scene/pathEffects/index.ts
packages/core/src/core/scene/pathEffects/source.ts
packages/core/src/core/scene/pathEffects/textAlong.ts
packages/core/src/core/scene/pathEffects/textAlongBands.ts
packages/core/src/core/scene/pathEffects/tween.ts
packages/core/src/core/scene/plyStacks.ts
packages/core/src/core/scene/poseFeed.ts
packages/core/src/core/scene/poseHold.ts
packages/core/src/core/scene/poseOverrideTypes.ts
packages/core/src/core/scene/poseOverrides.ts
packages/core/src/core/scene/posePlies.ts
packages/core/src/core/scene/poseRemovals.ts
packages/core/src/core/scene/poseSnapshot.ts
packages/core/src/core/scene/poseWrites.ts
packages/core/src/core/scene/reconcileSpecs.ts
packages/core/src/core/scene/recorder.ts
packages/core/src/core/scene/registeredOp.ts

<!-- done: 3 findings, files read: 40 -->
