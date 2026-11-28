## A loop pass whose child finishes synchronously leaves `current` on the stale child
- where: packages/animator/src/loop.ts:83 (createLoop / next)
- scenario: a factory whose returned animation calls `next` before it returns (a child that ends at once, e.g. a nested `animator.loop(..., { count: 0, onDone: next })`, or a factory calling `next()` itself) re-enters `next`, which starts pass i+1 and sets `current` to that child; the outer `current = supervisor.starting(...)` then overwrites it with pass i's finished handle. `handle.cancel()`, `pause()` and `setTimeScale()` then reach the dead handle and the live pass runs on unaffected. If the nested call finished the loop, `current` is left holding a handle after `finish()`.
- evidence: read
- severity: low
- fix: packages/animator/src/loop.ts
- size: function
- cause: assignment after a re-entrant call
- confidence: likely

## A stagger child that has already left is counted done before it is added, and kept as a live child
- where: packages/animator/src/stagger.ts:262 (runStagger fire)
- scenario: `watchCompletion` fires at once for an id that has already left (a factory returning an empty stagger, a zero-count loop, or a handle it canceled). `noteChildDone` runs first: `running` drops to -1, and played backward (`rate() < 0`) `rewound()` finishes the whole stagger while other items are still running; then `addChild` pushes the dead handle into `children` and bumps `running` back, so later pause/scale calls go to it.
- evidence: read
- severity: low
- fix: packages/animator/src/stagger.ts
- size: function
- cause: watcher registered before the child is recorded
- confidence: likely

## Vertex-color tweens interpolate the caller's live arrays, not the snapshots they commit
- where: packages/animator/src/colorHelpers.ts:94 (tweenVertexColors), packages/animator/src/colorHelpers.ts:178 (staggerVertexColors colorsAt)
- scenario: `tweenColors` commits `opts.to.slice()` and starts from `opts.from.slice()`, but `colorsAt` reads `opts.from` / `opts.to` themselves each frame. A caller that reuses a scratch array (fills it, starts a tween, refills it for the next node) changes the path mid-flight: the shown colors are the committed snapshot plus an offset computed against the new contents, so the node jumps or ends somewhere other than the path it was given.
- evidence: read
- severity: low
- fix: packages/animator/src/colorHelpers.ts
- size: line
- cause: closure over caller-owned arrays
- confidence: sure

## Skeleton transforms are resolved in Float32, losing precision for a rig far from the origin
- where: packages/animator/src/rig/resolveSkeleton.ts:20 (toMat3)
- scenario: a rig whose root bind sits at x = 5e6 stores translations with ~0.5-unit steps; `motionsFromRest` then multiplies `world` by `inverse(rest)` in Float32, and the cancellation leaves a nonzero motion at the bind pose, so `skinPath` moves points of a rig that has not moved, and `solveIk`'s tolerance of 0.01 can never be met there.
- evidence: read
- severity: low
- fix: packages/animator/src/rig/resolveSkeleton.ts, packages/animator/src/rig/skin.ts, packages/animator/src/rig/solveIk.ts
- size: design
- cause: Float32 matrices for world-space joint transforms
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
