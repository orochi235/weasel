# Findings: animator

## A loop whose pass ends without `onDone` stays registered forever, holding `isActive` and the frame loop
- where: packages/animator/src/loop.ts:73 (createLoop `next`), packages/animator/src/loop.ts:124 (createTweenLoop factory)
- scenario: the loop only advances when the pass's handle calls `next` from `onDone`. A pass that is canceled (its own `cancelKey` claimed by another animation, `animator.cancel(childHandle)`), or retired for a throw (a `tweenLoop`'s `onTick` throwing — `onCancel` runs "in place of `onDone`" per `TweenOptions.onCancel`, and createTweenLoop passes no `onCancel`), never calls `next`. The loop's supervisor entry stays in the table: its tick returns false every frame, so `animator.isActive()` / `isActive(key)` stay true and the frame loop runs for good, and the loop's `onDone` never comes. `createStagger` already guards against this with `watchCompletion(child.id, …)`; `createLoop` has no equivalent. Should: notice the pass left without `next` (watch its completion) and end or cancel the loop.
- evidence: read
- severity: medium
- fix: packages/animator/src/loop.ts, packages/animator/src/engine/animatorApi.ts (pass `watchCompletion` to createLoop)
- size: function
- cause: loop advances only through the child's `onDone`, no completion watch
- confidence: likely

## A hosted animator takes animations after `dispose` that never tick and never end
- where: packages/animator/src/createHostedAnimator.ts:54 (dispose), :63
- scenario: after `hosted.dispose()`, `hosted.animator.tween({ ... })` (or `keepAlive`, `loop`, a hold) still registers in the core's table; `requestFrame` is gated off and `tick`/`follow` return early, so the entry is never ticked, never finished, and its `onDone` never runs. `animator.isActive()` answers true for good and a color/trim target it moved stays owned. The doc promises only "a frame after this does nothing"; a disposed animator should refuse new work (throw) or cancel it at once.
- evidence: read
- severity: low
- fix: packages/animator/src/createHostedAnimator.ts, packages/animator/src/engine/core.ts
- size: function
- cause: dispose gates frames, not registration
- confidence: likely

## `setJointWeights` with a NaN weight turns every other joint's weight on that point to NaN
- where: packages/animator/src/rig/weightEdits.ts:25 (setJointWeights)
- scenario: `weights` maps point 3 to `NaN` (a brush computed with a zero-size radius divide, or a caller's bad input). `Math.min(1, Math.max(0, NaN))` is NaN, so the clamp the doc promises ("clamped to 0..1") does not hold; with other joints on the point, `next[name][i] *= (1 - NaN) / others` writes NaN into each of them and `own[i] = NaN`. Point 3 then has no positive weight and stops following any joint, silently. Should: treat a non-finite weight as 0 (or skip it), as the function already does for the other joints' NaN weights.
- evidence: read
- severity: low
- size: line
- cause: clamp via min/max passes NaN through
- confidence: sure

## Rig matrices are Float32, so joints and skinned points far from the origin lose precision
- where: packages/animator/src/rig/resolveSkeleton.ts:20 (toMat3)
- scenario: `toMat3` builds a `Float32Array` and `mat3.multiply` composes in it, so a skeleton placed at x ≈ 1e5 resolves its joints to the nearest ~0.008 units. `skinPath` (skin.ts:66) bends points through those motions, so a skinned path there jitters by that much frame to frame; `moveJoint`/`addJoint` (skeletonEdits.ts:34) store a joint's bind from a Float32 inverse, so each edit far out shifts the joint by up to that error. Solving in Float64 (and casting to the GL type only at upload) would keep it exact.
- evidence: read
- severity: low
- fix: packages/animator/src/rig/resolveSkeleton.ts, packages/animator/src/rig/skin.ts, packages/animator/src/rig/skeletonEdits.ts, packages/animator/src/rig/solveIk.ts
- size: design
- cause: Float32 GlMat3 used for CPU-side rig math
- confidence: likely

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

<!-- done: 4 findings, files read: 34 -->
