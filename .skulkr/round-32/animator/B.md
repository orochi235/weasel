I couldn't write `.audit-night/out/findings.md` because permission was refused twice, so the full document is below.

# Audit round 32 — animator

**Note:** the brief names frozen commit 402f4984ce970ab4f140a9e9504a66e8770a4ea1, but that commit is not in this repository (`git cat-file` reports "bad object"). I read the tree at HEAD f10daafb87, where `packages/animator` has no uncommitted changes.

## A stagger whose item throws as it starts stays registered for good, and so does its frame loop
- where: packages/animator/src/stagger.ts:229-241 (runStagger), :114-124 (CompositeHandle.fireDue)
- scenario: `animator.stagger(items, 0).tween({...})` or `.each`, where the factory throws for an item with no delay (a bad `ms`, or a target whose axes don't match `to`).
  - **Item with no delay:** `createSupervisor` has already registered the entry when `fire()` runs synchronously inside `supervisor.starting`. The throw reaches the caller, who gets no handle to cancel. The entry's tick never finishes, so `isActive(cancelKey)` stays true and the animator requests frames forever.
  - **Item with a delay:** engine/frame.ts:118-119 catches and logs the throw inside `fireDue`. But the items after it in `due` were already filtered out of `pending` and never start. `outstanding` still counts the thrown item, so it never reaches 0 and `finish()` is never called.
  - **Expected:** a throw at start cancels the supervisor before it propagates. A throw from a due item counts that item as done, and the rest of `due` still fires.
- evidence: read
- severity: medium

## A loop whose factory throws stays registered for good and keeps the frame loop running
- where: packages/animator/src/loop.ts:31, :54-76 (createLoop/next)
- scenario: `animator.loop((i, next) => { if (i === 2) throw …; return animator.tween({…, onDone: next}) })`, or `animator.tweenLoop({ ms: NaN, … })`. The supervisor is registered at line 31, before the first `next()`.
  - **Throw on pass 0:** it escapes `createLoop`, so the caller has no handle. The entry's tick never finishes, so it holds `isActive()` true and requests frames forever.
  - **Throw on a later pass:** it happens inside the previous child's `onDone`. The engine logs it as that child's `error`, but `current` still points at the finished child and `next` is never called again. The loop never finishes, never calls `onDone`, and its entry stays live.
  - **Expected:** cancel or finish the supervisor when `factory` throws, then rethrow.
- evidence: read
- severity: medium

## createElementTarget with `value` and `set` but no `get` reads its starting value forever
- where: packages/animator/src/elementTarget.ts:83-88 (createElementTarget)
- scenario: `createElementTarget({ element, style, value: 0, set: (v) => save(v) })`.
  - Only a missing `get` together with a missing `value` is rejected. Here `get` falls back to `() => held`, but `set` is the caller's, so `held` is never written.
  - Every commit (an animation's destination, a cancel's stop point) goes to the caller, while the target's committed value stays 0. The next animation starts from 0, and reads show 0 plus what is left to travel.
  - `get` without `set` loses commits the same way: they go into `held`, which `get` never reads.
  - **Expected:** throw unless `get` and `set` come together, as the doc says ("give `get` and `set`"), or write `held` on every commit.
- evidence: read
- severity: medium

## A joint name that extends another by a dot drags that joint's axes into `axes: [name]`
- where: packages/animator/src/axisNames.ts:36-40 (axisIndexes), via rig/skeletonAxes.ts:10-12, :19-22
- scenario: a skeleton imported with Blender-style names `spine`, `spine.001`, `spine.002` (Blender's own duplicate naming). Its axis names are `spine.x`… and `spine.001.x`….
  - `animator.hold({ target: rig.target, axes: ['spine'] })` or `jointAxes(skeleton, ['spine'])` matches every name starting with `spine.`. It returns all three joints' 15 axes instead of `spine`'s 5, so the hold covers and commits joints it was not asked to.
  - With joints `arm` and `arm.x`, asking for `'arm.x'` answers both `arm`'s x field and all of `arm.x`'s axes.
  - **Expected:** a joint's name resolves to its own axes only, for example by matching joint names exactly before treating a name as a path prefix.
- evidence: read
- severity: medium

## animator.cancelAll stops a color cycle's frames but leaves its override painting
- where: packages/animator/src/colorCycle.ts:78-95 (cycleVertexColors)
- scenario: a `cycleVertexColors` is running when the app calls `animator.cancelAll()`, the "reset scene" path its doc names.
  - `keepAlive` is a supervisor entry (engine/animatorApi.ts:189-191), so `cancelAll` removes it and the frame loop goes idle. The function override stays in `colorOverrides`.
  - The cycle freezes until something else repaints, then jumps to wherever `tMs` has reached. Its `CycleHandle` still looks live.
  - Tween- and spring-driven colors all stop for good on `cancelAll`. The cycle is the only color animation that `cancelAll` neither stops nor leaves moving.
  - **Expected:** the cycle clears its override when its keep-alive entry is canceled, or keeps its frames running.
- evidence: read
- severity: low

## staggerVertexColors paints NaN when `anchorMs` is 0, and accepts any delay or origin unchecked
- where: packages/animator/src/colorHelpers.ts:173-200 (staggerVertexColors)
- scenario: `staggerVertexColors(animator, { ..., anchorMs: 0, perAnchorDelay: 50 })`.
  - `localT` is `(elapsedMs - startMs) / 0`. For an anchor reached exactly at its start it is `0/0 = NaN`. That is the origin anchor at t = 0, and every anchor when `perAnchorDelay` is also 0, since `totalMs` is then 0 and `elapsedMs` is always 0.
  - `Math.max(0, Math.min(1, NaN))` is NaN, so `easing(NaN)` and the color lerp write NaN into the painted colors.
  - A NaN `origin` makes `distance`, `maxDistance` and `totalMs` all NaN. A negative `perAnchorDelay` gives a negative `totalMs`.
  - **Expected:** reject these inputs with a RangeError, as `cycleVertexColors` does for a bad `msPerCycle`, or treat `anchorMs` 0 as a step.
- evidence: read
- severity: low

## TargetTable.remove of a row twice, or of one never added, hands one index to two rows
- where: packages/animator/src/targetTable.ts:224-232 (remove)
- scenario:
  - **Double remove:** `table.remove(r); table.remove(r)` pushes `r` onto `free` twice and drops `size` by 2. The next two `add()` calls both return `r`, so two callers write the same row, and each one's target throws once the other is removed.
  - **Out-of-range remove:** `remove(high + 5)` puts an index above `high` on `free`. The next `add` returns it, but `inUse` (`rows()`, which `holdRows` uses by default) only walks below `high` and never lists it.
  - **Expected:** throw on a row that is not in use, as a removed row's old target does.
- evidence: read
- severity: low

## ColorOverrideRegistry.target at a new length drops painted colors without notifying subscribers
- where: packages/animator/src/colorRegistry.ts:117-122 (target)
- scenario: a canceled `tweenVertexColors` on node `a` leaves its 8-number colors painted, because `onDone`, and so `release`, doesn't run on cancel. The node then gains an anchor and `target('a', 'fill', 12)` is called.
  - The held slot is idle, so `drop(held)` removes it. The new slot is `painted: false`, so `get` and `resolve` switch from the old colors to the painter's base.
  - `changed()` is never called, so the version doesn't move and no `subscribe` listener hears about it. A painter that repaints on the registry's events keeps showing the old colors until something else redraws.
  - `release` (line 171) does call `changed()` for the same drop.
- evidence: read
- severity: low

## Files read
packages/animator/src/axisNames.ts
packages/animator/src/colorArrays.ts
packages/animator/src/colorCycle.ts
packages/animator/src/colorHelpers.ts
packages/animator/src/colorInterpolate.ts
packages/animator/src/colorRegistry.ts
packages/animator/src/elementTarget.ts
packages/animator/src/createHostedAnimator.ts
packages/animator/src/index.ts
packages/animator/src/loop.ts
packages/animator/src/observe.ts
packages/animator/src/pbt.fixture.ts
packages/animator/src/react.ts
packages/animator/src/rig/autoSkin.ts
packages/animator/src/rig/mirrorPose.ts
packages/animator/src/rig/resolveSkeleton.ts
packages/animator/src/rig/skeletonAxes.ts
packages/animator/src/rig/skeletonEdits.ts
packages/animator/src/rig/skin.ts
packages/animator/src/rig/solveIk.ts
packages/animator/src/rig/types.ts
packages/animator/src/rig/weightEdits.ts
packages/animator/src/slew.ts
packages/animator/src/stagger.ts
packages/animator/src/staggerTypes.ts
packages/animator/src/supervisor.ts
packages/animator/src/tableMoves.ts
packages/animator/src/target.ts
packages/animator/src/targetTable.ts
packages/animator/src/targetTypes.ts
packages/animator/src/trimRegistry.ts
packages/animator/src/types.ts
packages/animator/src/useAnimator.ts
packages/animator/src/useAnimatorOptions.ts

<!-- done: 8 findings, files read: 34 -->