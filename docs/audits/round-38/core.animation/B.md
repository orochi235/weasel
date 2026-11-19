# Audit round 38 — core.animation

## scenePoseTarget keeps, and keeps returning, the target of a node deleted while at rest
- where: packages/core/src/animation/poseTarget.ts:186 (scenePoseTarget)
- scenario: animate node `a` once (its target is cached in `sceneTargets(scene.overrides)`), let it come to rest, then delete `a`. The cache entry is removed only by the `onRest` callback, and only if the node is gone *at that moment* (line 221), so it stays. A later `scenePoseTarget(scene, 'a')` hits `fits = ... || !node` → true and returns the held target, though the docstring says it answers undefined for a node not in the scene; `tweenPose`/`springPose` then take the poseTarget path for a node that does not exist (recording a setPose op for it). And every id ever animated then deleted stays in the map for the scene's lifetime: an unbounded cache in a long session that creates and deletes nodes.
- evidence: read
- severity: medium

## A coast canceled from outside leaves its preview on screen and records nothing, though the drag's own commit was suppressed
- where: packages/core/src/animation/behaviors/coastByWrite.ts:41 (coast.stop / commitFlick); packages/core/src/animation/behaviors/coastOnTargets.ts:126 (coast.stop); packages/core/src/animation/behaviors/momentum.ts:140 (onEnd)
- scenario: flick a node so it coasts, then something cancels the decay from outside — `animator.cancelAll()`, or `cancelKey` on the coast — before it rests. A canceled decay never calls `onDone`, so `commitFlick` never runs. Over an adapter with `previewPoses` (coastByWrite), the coast's last preview frame is never cleared with `null`, so the node stays drawn where the coast left it while the document still holds the pre-drag pose; over a pose target (coastOnTargets), the decay commits the pose it reached into the document with no op. Either way `onEnd` already returned `null`, so the drag *and* the coast leave no undo entry. The next drag of the node reaches `stop()`, which sees `!animator.isActive(cancelKey)` and only deletes the coast from the set; the stranded preview is still not cleared and nothing is recorded. Expected: a coast ending by any path clears its preview and records the flick where it stopped.
- evidence: read (no test covers an external cancel: grep for cancelAll in behaviors/ finds only the two comments)
- severity: medium

## `boundary: 'stop'` stops each node at its own edge on a pose target, but only once every node is at an edge when written
- where: packages/core/src/animation/behaviors/coastOnTargets.ts:113 (tick) vs packages/core/src/animation/behaviors/coastByWrite.ts:80-93 (onTick)
- scenario: flick a two-node selection under `bounds` with the default `boundary: 'stop'` so node A reaches the right edge well before node B reaches any edge. Over a scene adapter (coastOnTargets) A halts at once at the edge, both axes zeroed, while B travels on. Over an adapter without `poseTarget` (coastByWrite) the coast ends only when `allHit`, so until B also hits, A stays clamped on x and keeps sliding along the edge in y — the 'continue' behavior the option promises 'stop' does not do. The option docs ("'stop' settles at the edge at once") are answered two ways depending on the adapter.
- evidence: read
- severity: low

## useRigNode throws during render when a node under the rig names a joint the skeleton no longer has
- where: packages/core/src/animation/rig/rigNode.ts:117-121 (read) → packages/core/src/animation/rig/bindRig.ts:155 (requireRestInverse), via useRig.ts:19 (useSeatedRig's useMemo)
- scenario: a rig node's `data.skeleton` has joint `elbow`; a child has `data: { joint: 'elbow' }` (or a `data.skin` weighing `elbow`). Rename or delete that joint in the skeleton — a document edit the rig node re-reads on every version bump. `read` collects the child's stale joint name into `bindings` without checking it against the skeleton, and `bindRigOn` throws `bindRig: the skeleton has no joint "elbow"` inside `useMemo`, so the component holding `useRigNode` crashes on a state the document can reach, and stays crashed until the child data is fixed elsewhere. For a hook that reads arbitrary user data (unlike `bindRig`, whose caller passes the bindings), a dangling joint name should be skipped, not fatal.
- evidence: read (the document reaching that state is inference: nothing in `read` or the scene forbids it)
- severity: medium

## Rig.bake throws when a bound or skinned node was deleted (or locked) after binding, and show keeps re-installing its override every frame
- where: packages/core/src/animation/rig/bindRig.ts:238 (bake) and :211 (show); packages/core/src/animation/rig/skinBinding.ts:95-97 (write), :87 (show)
- scenario: `bindRig({ scene, skeleton, bindings: { hand: 'n1' } })` (or `useRig` with memoized bindings, which does not rebind when a node goes), pose it, delete `n1`, then call `rig.bake()`. `bake` calls `scene.setPose('n1', …)` for every bound entry with a pose; `Scene.setPose` goes through `requireNode` and throws, so the batch fails, `release()` is never reached and every override stays installed. `skins.write` reads `scene.get(s.node)?.data` as though the node might be gone, then calls `scene.update` on it anyway, which throws the same way; a node locked since binding throws from `refuse`. Meanwhile each `show` re-adds an override for the deleted id (`!scene.overrides.has(...)` is true once the table dropped it), publishing the table every frame for a node that does not exist. Expected: bake and show skip nodes the scene no longer holds.
- evidence: read (`requireNode`/`refuse` in packages/core/src/core/scene/fieldEdits.ts:49-57)
- severity: medium

## momentum({ friction: 1 }) throws at release over a scene adapter and coasts forever over any other
- where: packages/core/src/animation/behaviors/momentum.ts:64 (momentum) → coastOnTargets.ts:62 / coastByWrite.ts:58
- scenario: `MomentumOptions.friction` is unvalidated and documented only as "default 0.92 (per second)". With `friction: 1` (a frictionless coast stopped by `bounds`), a flick over a pose-target adapter reaches `animator.decay({ target, friction: 1 })`, which throws `RangeError: decay: a coast on a target needs friction below 1` from inside `onEnd`, after `coasts.add(coast)` — the release throws through the dispatcher and the coast is left in the set. Over an adapter without `poseTarget` the same option is accepted and, with no `bounds`, the decay never slows, so it never reaches `onDone`, runs a frame loop indefinitely, and never records the flick. One option, two answers by adapter; it should be rejected (or clamped) when `momentum()` is called.
- evidence: read (packages/animator/src/engine/decay.ts:7-8)
- severity: low

## Files read
packages/core/src/animation/behaviors/coast.ts
packages/core/src/animation/behaviors/coastByWrite.ts
packages/core/src/animation/behaviors/coastOnTargets.ts
packages/core/src/animation/behaviors/momentum.ts
packages/core/src/animation/clipTargets.ts
packages/core/src/animation/departures.ts
packages/core/src/animation/index.ts
packages/core/src/animation/pathMotion.ts
packages/core/src/animation/poseHelpers.ts
packages/core/src/animation/poseTarget.ts
packages/core/src/animation/poseTransition.ts
packages/core/src/animation/reflow.ts
packages/core/src/animation/reflowGlide.ts
packages/core/src/animation/rewind.ts
packages/core/src/animation/rig/bindRig.ts
packages/core/src/animation/rig/index.ts
packages/core/src/animation/rig/rigNode.ts
packages/core/src/animation/rig/rigSeat.ts
packages/core/src/animation/rig/skinBinding.ts
packages/core/src/animation/rig/useRig.ts
packages/core/src/animation/wrappers/animateLifecycle.ts
packages/core/src/animation/wrappers/animateOnSetPose.ts
packages/core/src/animation/wrappers/index.ts
packages/core/src/animation/wrappers/instantPose.ts
packages/core/src/animation/writtenPoseTarget.ts

<!-- done: 6 findings, files read: 25 -->
