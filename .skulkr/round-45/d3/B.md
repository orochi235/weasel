I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the whole findings document is below.

# Audit round 45: area `d3` (blind reviewer)

The brief names the frozen commit 04c3a6536306f9e757e77a6ab15759ff43b02241, but that object isn't in this clone (`git cat-file` fails on it). What I read is HEAD, 782733b19c.

## A second transition with a different name on the same selection leaves the pose stuck at the prior pose
- where: packages/d3/src/transition.ts:57 (seedFromPoses), :79 (itemEnds), :192
- scenario: `const s = d3Bind(...).pose(...).join(); s.transition().end(); s.transition('fade').tween({ name: 'opacity', ... }).end();`
  - When the unnamed transition schedules, it sets every node back to its prior pose.
  - 'fade' then schedules as the first stage of its own chain. It records `joinedPoses` from the scene, which now holds the *prior* pose, and sets the prior pose again.
  - 'fade' has no `.pose()`, so `itemEnds` gives it a pose job from prior to prior, under the key `('fade', id)`. That key doesn't cancel the unnamed transition's key.
  - Both pose tweens call `setPose` on every frame. The one registered later writes last, so the node stays at the prior pose and ends there.
  - It should end at the joined pose, with 'fade' changing only opacity. In d3, a transition with another name leaves alone anything it doesn't tween.
  - If 'fade' starts a frame later, it snaps the node back to the prior pose and tweens toward a pose the other transition was midway through.
- evidence: read
- severity: high

## A chained transition's deferred item runs after that item was interrupted, and interrupts the newer transition
- where: packages/d3/src/transitionProgress.ts:71 (whenDone, `defer` path), packages/d3/src/transition.ts:155 (runItem), :225
- scenario: `t` is running; its item 0 has finished and the others have not.
  - `t.transition()` schedules the new stage `t2` with `deferReady`, so `runItem(0)` is queued on a microtask.
  - In the same synchronous block, `sel.transition().end()` (same name) starts on node 0. It interrupts `t`'s chain there, and `t2.cancelItem(0, true)` marks item 0 done through `progress.drop`.
  - `drop` deletes the item's waiters from the map, but it can't reach the microtask already queued.
  - The microtask calls `runItem(0)`. `progress.canceled` is false, since only one item was dropped, and the node is still present, so it launches tweens.
  - Their `spawn` calls `interruptNode`, which stops the newer transition on node 0.
  - `finishItem` later does nothing because `itemDone[0]` is already true. So `runs.untrack(0)` never runs and the stop callback stays in `LIVE_ITEMS`.
  - `runItem` should check that item `i` isn't done yet.
- evidence: read
- severity: medium

## Calling `.remove()` after `.end()` deletes nodes that were already interrupted
- where: packages/d3/src/transitionRemoval.ts:30 (arm), packages/d3/src/transitionProgress.ts:79, packages/d3/src/transition.ts:229
- scenario: `t = sel.transition(); t.end();`, then a transition with the same name interrupts node 0, which drops `t`'s item 0 and sets `itemDone[0] = true`. Then `t.remove()` is called.
  - `remove()` arms removal because `scheduled` is true.
  - `arm` calls `whenItemDone(0, ...)`. `whenDone` runs it immediately because the item is marked done, so the node, which is still present, is removed.
  - The type doc (types.ts:111) says an interrupted node is not removed. `drop` and `finish` set the same `itemDone` flag, so `arm` can't tell an interrupted item from a finished one.
- evidence: read
- severity: medium

## Two custom tweens with the same name on one transition make it hang: `end()` never resolves
- where: packages/d3/src/transition.ts:112 (itemJobs), packages/d3/src/transitionRuns.ts:48 (launch)
- scenario: `.tween({ name: 'o', ... }).tween({ name: 'o', ... })` on one transition.
  - Both jobs get the cancel key `(name, id, 'o')`.
  - When the second starts, the animator cancels the first by that key without running its `onDone`.
  - `jobsLeft` stops at 1, the item never finishes, and neither `'end'` nor `'interrupt'` fires.
  - `tween()` should either refuse a duplicate name or replace the earlier tween, as d3 does by name.
- evidence: read
- severity: medium

## One animator shared by two scenes lets their transitions interrupt each other, because tracking and cancel keys ignore the scene
- where: packages/d3/src/liveTransitions.ts:5, packages/d3/src/cancelKey.ts:7, packages/d3/src/selection.ts:62
- scenario: two `d3Bind`s on two scenes are given the same `animator`, and both key their data `'0'`, `'1'`, ….
  - Starting an unnamed transition on scene B calls `interruptNode(animator, key('', '0'))`. That stops scene A's transition on its own node `'0'` and fires A's `'interrupt'`.
  - The animator's cancel key also cancels A's tween.
  - `sel.interrupt()` on B does the same to A.
  - The keys are built from the animator and node id only; they should include the scene.
- evidence: read. That a shared animator is a real setup is my inference: `D3BindOptions.animator` accepts any `Animator`, and nothing ties it to one scene.
- severity: medium

## When `schedule` throws for a missing `lerp`, the transition is left scheduled, so a retried `end()` never settles
- where: packages/d3/src/transition.ts:178 (schedule)
- scenario: a `poseDescriptor` with no `lerp`. `t.remove().end()` throws, but only after setting `scheduled = true` and after `armRemoval()` has registered pending removals.
  - A second `t.end()` returns `progress.end`, which never resolves.
  - The registered removals stay in `PENDING_REMOVALS`.
  - The check also fires on a chained stage that has no `.pose()` and so needs no `lerp`.
  - The check should run before any state changes, and only when a pose job will run.
- evidence: read
- severity: low

## `delay(NaN)` silently starts at once, while `duration(NaN)` throws
- where: packages/d3/src/transition.ts:163, packages/d3/src/transitionHandle.ts:43
- scenario: `.delay((d) => d.offset)` where `offset` is undefined gives NaN. `Math.max(0, NaN)` is NaN and `NaN > 0` is false, so the item starts immediately.
  - `duration` refuses NaN with a `RangeError`, as ruled on 2026-11-11.
  - The same kind of timing input is handled two different ways.
- evidence: read
- severity: low

## `'start'` fires before an item's delay, and starting values are read before the delay too
- where: packages/d3/src/transition.ts:157-164 (runItem)
- scenario: with `.delay(1000).on('start', fn)`:
  - `progress.start()` runs before `runs.launch` begins waiting, so `fn` fires when `end()` is called. It fires even if the item is interrupted during the delay.
  - `itemEnds` reads a chained stage's `from` (the node's current pose), and `itemJobs` calls each custom tween's `from`, both before the delay.
  - If the pose changes during the delay (a drag, or a transition with another name), the node snaps back when the tween starts.
  - d3 fires `start`, and reads starting values, after the delay.
- evidence: read
- severity: low

## An entering datum's `.pose()` is called twice, so a random pose animates instead of snapping in
- where: packages/d3/src/bind.ts:145 (priorPosesOf) and :164 (applyJoin)
- scenario: no `.enterFrom()`, and `.pose((d) => ({ x: Math.random() * w, ... }))`.
  - The prior pose comes from the first call, and the added node's pose from the second.
  - `.transition()` then tweens an entering node between two random points, where the doc (types.ts:36) says entering nodes snap in.
  - Each entering pose should be computed once and reused.
- evidence: read
- severity: low

## `join()` cancels pending removals before it throws on a missing pose
- where: packages/d3/src/bind.ts:76, :166
- scenario: a binding whose `.exit()` runs `exit.transition().remove()`. A later join has an entering datum and no `.pose()`, so it throws "enter node has no pose".
  - By then `cancelPendingRemoval` has already run for every exiting and re-entering id.
  - Those nodes' exit chains are stopped and the nodes are never removed, though the join changed nothing else.
  - The 2026-11-10 ruling on held keys has `join` refuse before changing anything; this refusal comes after a change.
- evidence: read
- severity: low

## Files read
packages/d3/src/bind.ts
packages/d3/src/cancelKey.ts
packages/d3/src/index.ts
packages/d3/src/liveTransitions.ts
packages/d3/src/pbt.fixture.ts
packages/d3/src/pendingRemovals.ts
packages/d3/src/selection.ts
packages/d3/src/transition.ts
packages/d3/src/transitionHandle.ts
packages/d3/src/transitionProgress.ts
packages/d3/src/transitionRemoval.ts
packages/d3/src/transitionRuns.ts
packages/d3/src/transitionTweens.ts
packages/d3/src/types.ts

<!-- done: 10 findings, files read: 14 -->