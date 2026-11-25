# Audit round 41 — core.core.scene.part2

## nodeAsShown hands back a stale shown copy after the stored node is written in place
- where: packages/core/src/core/scene/nodeAsShown.ts:44-47 (nodeAsShown)
- scenario: a node has a data override (e.g. a text draft being typed). `nodeAsShown` spreads the node once and caches the copy keyed on the node object, revalidating only `node.data` and the override's `data` function. `kit:setPose` (kitOps.ts:121) replaces `node.pose` on the same object, and `kit:setHidden`/`kit:setLocked` (nodeFlags.ts:44) write flags on it, leaving `node.data` as it was. The next `nodeAsShown` call returns the cached copy with the old `pose`/`hidden`/`locked`. Readers that take the shown node whole — `shownLookup(scene).get(id)` in useSceneTextEdit's fit, measureHit/measureLayer, the pick paths' `nodesAsShown` — see the node as it was before the edit for as long as the override stays (e.g. a text box resized while its draft is live). The cache should also check `node.pose` (and the flags), as nodeMemo checks `pose`.
- evidence: read (nodeAsShown.ts cache check; kitOps.ts:121 and nodeFlags.ts:44 write in place; derivedPath.ts:36-38 has to patch `pose` back itself)
- severity: medium

## A tween spaced by distance has no bound on its stations, and hangs when `distance` is below the run's precision
- where: packages/core/src/core/scene/pathEffects/tween.ts:50-53 (tweenStations); also :55 for `steps`
- scenario: `{ kind: 'tween', spaceBy: 'distance', distance: 1e-6 }` between two sources 1000 apart pushes 1e9 stations, and each becomes an interpolated path, so the derivation runs out of memory or never returns. With `distance` below half the ulp of `s` (e.g. `distance: 1e-14` on a run of 1000), `s += d` stops moving `s` and the loop never ends. `steps: Infinity`, which a numeric field can hand over, also loops forever (`Math.max(Math.floor(Infinity), 0)` is `Infinity`). The station count should be capped (as textAlongBands caps samples at MAX_SAMPLES), or the loop driven by an integer count.
- evidence: read
- severity: medium

## onPoseWrite reports a node the change both added and removed, when it is not the removal's root
- where: packages/core/src/core/scene/poseRemovals.ts:50-58 (createRemovalLog.seeOff's returned call)
- scenario: in one `scene.batch`, add child `c` under an existing group `g`, then remove `g`. `seeOff` builds `g`'s RemovedNode with `c` among its children; the done call drops `c`'s pending add from `pending` and collects `c` into `added`, but only checks `added.has(r.id)` for the roots. So `removed` reports `g` with `c` beneath it, a node no listener ever saw. `ScenePoseReports.onPoseWrite` promises a node both added and removed by the change is left out of both; `c` should be pruned from the children too.
- evidence: read (poseWrites.ts:68 states the contract)
- severity: low

## A node removed and put back in one change is reported as freshly added when it was removed under its parent
- where: packages/core/src/core/scene/poseWrites.ts:139-145 (noteAdded) with poseRemovals.ts:56-58,61-65
- scenario: the removal log keeps an entry only for each removal root, with descendants nested in it. When a change removes group `g` with child `c` and then re-adds both (one `kit:add` per node, e.g. a remove-and-reinsert in one batch), `takeBack(g)` finds `g`'s pose, but `takeBack(c)` finds nothing, so `c` is reported with `from: undefined`, as added. Listeners that glide moves and fade in arrivals (reflow/onPoseWrite consumers) fade in a node that was on screen the whole time. `takeBack` should also search the roots' nested children.
- evidence: read
- severity: low

## A layout pass never re-arranges the parent of a container the pass resized
- where: packages/core/src/core/scene/layoutPass.ts:112-120 (runLayoutPass's `write`)
- scenario: a vertical stack `S` holds containers `A` and `B`; `A` has an `arrive` that grows `A` (`result.bounds`). Dropping a child into `A` runs `A`'s arrive, `write(A, …)` grows `A`, and since `id === current` nothing is queued. Even when `A` is resized by someone else, only `A` itself is queued (its children are re-laid). `S`, whose child `A` changed size, is never queued, so `B` stays where it was and `A` now overlaps it. The pass's own writes go through `writePose` after `settle` has closed the arrival window (arrivalWindow.ts:112-113), so they don't reach `changed` for a later pass either. The module header promises "a container this pass resizes is arranged in turn, so nested layouts settle in the same edit", and a container "resized, had a child moved" is re-arranged; a resize should also queue the parent when it has a layout.
- evidence: read
- severity: medium

## outsideGeneration can come back to a value a derivation recorded after a source is removed
- where: packages/core/src/core/scene/outsideReads.ts:17-20,42-46 (addOutsideSource, outsideGeneration)
- scenario: the generation is the sum of every registered source's. With sources A = 3 and B = 5, a derivation records 8. Removing B (its returned removal) drops the sum to 3; once A's loads move it to 8, `held.outside === outsideGeneration()` (pathEffects/derive.ts:102) and a derivation that read A's not-yet-loaded data is served stale. "It must only ever grow" holds per source but not for the sum once a source leaves; removal should fold the departing source's last value into a base offset.
- evidence: read
- severity: low

## NodeBase.dependsOn's doc says it is fixed at add time, but setDependsOn retargets it
- where: packages/core/src/core/scene/nodeTypes.ts:20-21 (NodeBase.dependsOn)
- scenario: the doc says "Nodes whose poses this node's geometry is computed from. Fixed at add time." A reader concludes they must remove and re-add a node to change its sources, while `scene.setDependsOn` (used by reconcileSpecs.ts:68, implemented by nodeStore.ts `retarget`, and named by foundHidden.ts as "every writer of `dependsOn`") changes it as an undoable edit.
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

<!-- done: 7 findings, files read: 39 -->
