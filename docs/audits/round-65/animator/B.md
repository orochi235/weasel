## cycleVertexColors with `direction: -1` plays its easing curve backward, so ease-in turns into ease-out
- where: packages/animator/src/colorCycle.ts:54 (cycleVertexColors, override)
- scenario: `cycleVertexColors(animator, { id, channel, msPerCycle: 1000, direction: -1, easing: t => t * t })` on 4 anchors. At tMs = 250, `raw = -1`, `cycles = -0.25`, `floor = -1`, `cycleFrac = 0.75`, `easing(0.75) = 0.5625`, `easedRaw = -1.75`: the colors have turned 1.75 anchors in the first quarter. With `direction: 1` at the same time they have turned 0.25 anchors (`easing(0.25) = 0.0625`). The negative direction is folded into `raw` before the cycle fraction is taken, so each backward cycle runs the eased curve from its far end: the motion starts fast and slows down. Expected: the same easing shapes every cycle in either direction, and only the sense of rotation flips. Taking the fraction from `|tMs / msPerCycle|` and applying `direction` to the eased phase would give that.
- evidence: read (arithmetic worked by hand from the code)
- severity: low

## setJointWeights counts negative and NaN weights when it rescales the other joints, which skinPath and jointShares ignore
- where: packages/animator/src/rig/weightEdits.ts:26 (setJointWeights)
- scenario: skin `{ a: [0.5], b: [-0.2] }`, `setJointWeights(skin, 1, 'c', new Map([[0, 0.5]]))`. `others = 0.5 + -0.2 = 0.3`, so `a` is scaled by `0.5 / 0.3` to 0.833 and `c` is set to 0.5. Then `b` is dropped because it has no positive weight. `skinPath` and `jointShares` count only weights above 0 (as the comment in `jointShares` says), so `c`'s share comes out as `0.5 / 1.333 = 0.375`, not 0.5, and the point does not "still sum to 1" the way the docs promise. With `b: [NaN]`, `others` is NaN, so the `others > 0` branch is skipped: `c` becomes 1, `a` keeps 0.5, and `c`'s share is 0.667. The brush (`brushWeights` against `jointShares`) then misses on every stroke over such points. The sum should take only `w > 0`, as the other two functions do, and the non-positive weights should be zeroed.
- evidence: read
- severity: low

## A target table's `refill` writes `undefined` into the caller's options object, and throws when that object is frozen
- where: packages/animator/src/targetTable.ts:210 (createTargetTable, rows.refill)
- scenario: `const table = createTargetTable(Object.freeze({ axes: 2, show: paint }))`, then `animator.holdRows({ table })` and `handle.touch()` (or `release()`). `startHoldRows`' touch/leave call `rows.refill()`, which runs `opts.show = undefined` on the caller's frozen object. In module (strict) code that throws `TypeError: Cannot assign to read only property 'show'`, so `touch()` and `release()` fail. An unfrozen object shared with other code also has its `show` swapped out during the fill. The table should keep its own copy of `show` (or pass a "no show" flag into `fill`) rather than mutate `opts`.
- evidence: read
- severity: low

## createTargetTable throws an unexplained RangeError for a capacity that is not a whole number
- where: packages/animator/src/targetTable.ts:162 (createTargetTable)
- scenario: `createTargetTable({ axes: 3, capacity: 2.5 })` runs `new Float64Array(7.5)`, which throws `RangeError: Invalid typed array length: 7.5`. With `axes: 2` the first array works (length 5), but `new Int32Array(committed.length / n)` (2.5) on line 175 throws the same error. `capacity` is documented only as a starting size ("The table grows past it"), so a fractional value, such as one computed from a count divided by something, should be rounded up or refused with a message naming `capacity`, as `axes` is on line 161.
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

<!-- done: 4 findings, files read: 34 -->
