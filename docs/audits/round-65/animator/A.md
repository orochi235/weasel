# Audit round 65 — animator — blind reviewer findings

## A color cycle replaced or cleared through the registry keeps the frame loop running for good
- where: packages/animator/src/colorCycle.ts:79-100 (cycleVertexColors)
- scenario: `const h = cycleVertexColors(animator, { id: 'a', channel: 'fill', msPerCycle: 1000 })`, then the app repaints the node with `animator.colorOverrides.set('a', 'fill', solid)` or drops it with `animator.colorOverrides.clear('a', 'fill')` / `clearAll()`. The cycle's override is gone, but its `animator.keepAlive(end)` entry (a supervisor whose tick never finishes, `engine/animatorApi.ts:189`) is only released by `h.cancel()` or `cancelAll()`. So `animator.isActive()` stays true and rAF/`onTick` fire every frame, painting nothing that changes, until someone happens to call `h.cancel()`. `cancel()`'s own doc treats "another has been set on the same node and channel since" as a normal case, but only skips the clear, not the keep-alive. It should release the keep-alive once the override it installed is no longer the one painted (or `clear`/`set` should end it).
- evidence: read
- severity: medium

## setJointWeights rescales by a sum that counts negative and NaN weights, which skinPath and jointShares ignore
- where: packages/animator/src/rig/weightEdits.ts:24-32 (setJointWeights)
- scenario: skin `{ a: [-0.5], b: [1] }`, `setJointWeights(skin, 1, 'c', new Map([[0, 0.5]]))`. `others` = -0.5 + 1 = 0.5, so the factor is (1-0.5)/0.5 = 1: `a` stays -0.5, `b` stays 1, and `c` is 0.5. skinPath and jointShares count only weights > 0 (commit 12ded8a8b5 changed jointShares to match), so `c`'s share comes out 0.5/1.5 = 0.33, not the 0.5 that was asked for. The doc promises "the point still sums to 1". With a NaN weight on another joint, `others` is NaN, so the `else` branch gives `c` the whole weight (1) and leaves `b` at 1: the share is 0.5 where 1 was meant. The same question ("which weights count") gets two answers. `others` should sum only `w > 0`, and the rescale should zero the non-positive ones.
- evidence: read
- severity: low

## TargetTable.refill writes to the caller's options object, and throws when it is frozen
- where: packages/animator/src/targetTable.ts:210-214 (rows.refill)
- scenario: `createTargetTable(Object.freeze({ axes: 4, show: paint }))`, then `animator.holdRows({ table })`. holdRows' `touch()`/`leave()` call `rows.refill()`, which does `opts.show = undefined` on the caller's object. In module (strict) code, that assignment throws `TypeError: Cannot assign to read only property 'show'`, so the hold fails from start to release. Even on an unfrozen object, a caller's options are mutated mid-call: a `show` that reads its own options sees `show` missing. refill should pass a "don't show" flag to `fill` and leave `opts` alone.
- evidence: read
- severity: low

## readTarget hands a custom `axes.add` a shared module-level scratch longer than the target's axis count
- where: packages/animator/src/target.ts:217, 306-311 (readTarget)
- scenario: one module-wide `scratch` Float64Array is grown to the largest axis count ever read and passed whole as `delta` to `axes.add(committed, d)`. Read a 16-axis target and then a 2-axis target whose custom `add` is `(v, d) => Array.from(d, (x, i) => (v[i] ?? 0) + x)` (or that loops `i < d.length`): it gets 16 entries, 14 of them stale, and answers a 16-long value. A custom `add` that reads another target (re-entrant `read()`) has its `d` overwritten in the middle of the call. `TargetAxes.add` is public API and documents only "`delta` added axis by axis", not a length or a lifetime. It should pass `d.subarray(0, n)`, or say in the doc that `delta` may be longer and is only valid during the call.
- evidence: read
- severity: low

## A stagger's handle reports its last time scale and pause after it ends, where a loop's reports 1 and unpaused
- where: packages/animator/src/stagger.ts:163-169 (CompositeHandle.timeScale / isPaused)
- scenario: `const h = animator.stagger(items, 50, f); h.setTimeScale(2);` and let it finish. `h.timeScale()` is still 2, and `h.isPaused()` is still true if it was paused when canceled. `AnimationHandle.timeScale` is documented "1 once it has finished, since the animator no longer holds an entry to read". `createLoop`'s handle (loop.ts:99-100) reads the supervisor and does answer 1. The two composites answer the same question two ways.
- evidence: read
- severity: low

## axisIndexes only refuses a name that is both an axis and a path prefix when `paths` is given, though its doc says it always does
- where: packages/animator/src/axisNames.ts:64-66 (axisIndexes)
- scenario: custom `TargetAxes` with `names: ['arm', 'arm.rotation']` and no `paths`. `target.axisIndexes(['arm'])` returns `[0, 1]` silently: `reaches` gives 'name' for 0 and 'path' for 1, but the ambiguity check is gated on `paths &&`. The doc says the call throws for "a name that is both one axis's and the start of another's path", with no condition. With `paths` given, the same names throw. So a hold with `axes: ['arm']` covers two axes or throws, depending on whether the axes object happens to carry `paths`.
- evidence: read
- severity: low

## Files read
packages/animator/src/axisNames.ts
packages/animator/src/colorArrays.ts
packages/animator/src/colorCycle.ts
packages/animator/src/colorHelpers.ts
packages/animator/src/colorInterpolate.ts
packages/animator/src/colorRegistry.ts
packages/animator/src/createHostedAnimator.ts
packages/animator/src/elementTarget.ts
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

<!-- done: 6 findings, files read: 34 -->
