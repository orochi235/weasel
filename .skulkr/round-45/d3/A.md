# Audit round 45 — area `d3`

Note: the brief names frozen commit 04c3a65…, which does not exist in this clone; HEAD is 782733b19c and
`packages/d3` has no uncommitted changes, so that is the revision read.

## An item only ends through its tween's `onDone`, so any other stop of the tween hangs the transition
- where: packages/d3/src/transitionRuns.ts:48 (launch), packages/d3/src/transitionTweens.ts:33/55 (poseTweenJob, customTweenJob)
- scenario: the item's `jobDone` runs only from the animator's `onDone`, and the animator never calls `onDone` for a
  canceled or errored tween (`engine/tweenAnimation.ts:73`: "A canceled tween never completes"). So
  (a) `animator.cancelKey(transitionCancelKey('move', 'a'))` — the use `transitionCancelKey` is exported and
  documented for, and the one `interrupt.test.ts:149` exercises — stops the tween, but the item never finishes:
  `end()` never resolves, neither `end` nor `interrupt` fires, a chained transition never starts, a `.remove()`
  never removes, and the item stays in `LIVE_ITEMS` and the pending-removals emitter forever. The same happens on
  `animator.cancelAll()` (a "reset scene" path), and (b) on a tick that throws, e.g. `.tween({ name: 'fill',
  from: () => 'red', to: () => 'blue', apply })` with no `interpolate`: `customTweenJob`'s fallback throws, the
  animator drops the tween as `error`, and the transition hangs the same way. Expected: the item is dropped as an
  interrupt (or the transition rejects/ends), as `selection.interrupt` already does.
- evidence: read
- severity: medium

## Transitions on two scenes sharing one animator interrupt each other's nodes with the same id
- where: packages/d3/src/cancelKey.ts:7 (transitionCancelKey), packages/d3/src/liveTransitions.ts:5 (LIVE_ITEMS), packages/d3/src/transitionRuns.ts:55
- scenario: the cancel key and the live-item table are keyed by animator, name and node id only — not by scene.
  Two canvases with their own scenes and one shared animator, each `d3Bind`-ing data keyed `'a'`: starting a
  transition on scene B's `'a'` runs `interruptNode` on scene A's live `'a'` item (fires A's `interrupt`), and its
  `animator.tween` with the same `cancelKey` cancels A's pose tween outright. `sel.interrupt()` on scene B likewise
  stops scene A's transitions. Node ids are only unique within a scene, so the key needs the scene in it.
- evidence: read
- severity: medium

## A second transition on the same selection snaps every node back to its pre-join pose
- where: packages/d3/src/transition.ts:192 (stage.schedule → seedFromPoses), :88 (itemEnds)
- scenario: every root stage seeds from, and tweens from, the selection's `priorPoses`, captured at `join()`.
  `const sel = b.join(); await sel.transition().end();` then later `sel.transition().pose(d => …).end()` (or
  `sel.filter(…).transition()`, which keeps the same `priorPoses`): `seedFromPoses` writes the pre-join pose back
  into the scene and the tween runs from there, so the node jumps to where it was before the join and replays the
  first move. Restarting a transition mid-flight does the same. Expected (and what `types.ts:91` says, "defaults to
  the pose the node holds when this transition starts"): a transition after the first tweens from where the node
  stands.
- evidence: read
- severity: medium

## A dropped item counts as done, so a later `.remove()` or chained transition acts on an interrupted node
- where: packages/d3/src/transitionProgress.ts:71 (whenDone), :63 (drop); callers transitionRemoval.ts:36, transition.ts:190/225/230
- scenario: `drop` sets `itemDone[i] = true`, and `whenDone` then runs a late waiter at once. `const t =
  sel.transition().duration(1000); t.end();` then `sel.filter((d, i) => i === 0).transition().end()` interrupts
  item 0 of `t` (`root.cancelItem(0, true)`), while item 1 keeps going. Now (a) `t.remove()` — armed mid-flight
  through `remove() { if (scheduled) armRemoval() }` — registers `whenItemDone(0, …)`, which runs immediately, and
  `present(0)` is true, so node 0 is deleted although `types.ts:113` says an interrupted node is not removed;
  (b) `t.transition().pose(…)` queues with `schedule(true)`, its `whenItemDone(0, runItem)` runs on a microtask,
  and the new stage's spawn calls `interruptNode`, killing the transition that displaced `t` on node 0.
  Expected: waiters on a dropped item never run, as `drop` already ensures for waiters registered earlier.
- evidence: read
- severity: low

## A failed `join()` still cancels pending exit removals, leaving those nodes in the scene for good
- where: packages/d3/src/bind.ts:76 (join)
- scenario: `cancelPendingRemoval` runs for every key and exit before `applyJoin`, and outside its batch. A binding
  with no `.pose()` (or a `.pose`/`.enterFrom` mapper that throws) joined with one new key while earlier exits are
  running `exit.transition().remove()`: `applyJoin` throws "enter node has no pose", the batch reverts the scene,
  but the exit chains' items were already canceled, so those nodes are never removed and no later join hands them
  to the exit handler as already-transitioning (they stay as plain marks until a join exits them again). Expected:
  a join that throws changes nothing, as the held-key and duplicate-key checks already guarantee by running first.
- evidence: read
- severity: low

## `on('start')` fires when the transition is scheduled, before any delay has elapsed
- where: packages/d3/src/transition.ts:162 (runItem)
- scenario: `progress.start()` is called before `runs.launch` waits out the delay. `sel.transition().delay(500)
  .on('start', fn).end()` calls `fn` synchronously inside `end()`, 500 ms before any tween spawns; with every item
  delayed and then interrupted during the delay, `start` fires for a transition that never moved anything.
  Expected (the test at transition.test.ts:153 says "fires once when tweens spawn"): `start` when the first item's
  tweens spawn.
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

<!-- done: 6 findings, files read: 14 -->
