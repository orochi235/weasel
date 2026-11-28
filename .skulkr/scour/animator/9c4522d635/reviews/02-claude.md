# Findings: animator

## toSkinPolygon stores a rect's corners as absolute Float32 coords with no origin, losing precision far from the origin
- where: packages/animator/src/rig/skin.ts:40 (toSkinPolygon)
- scenario: a rect path at `x = 10_000_000.3, width = 1.25` is turned into a polygon whose `coords` are a `Float32Array` of world values with no `origin`. Float32 spacing at 1e7 is 1, so the corners round to whole units: the width comes out 1 or 2 instead of 1.25. `skinPath` and `autoSkin` then work from the rounded corners, so the skinned rect jumps or shears near the far origin. The rect's own fields are float64, and `skinPath` itself keeps precision through `coordsFrom(rest.origin, …)`, so this is the one lossy step. It should build the path relative to an origin (`polygonPathFrom`, or `coordsFrom` with an origin taken from the rect).
- evidence: read (geom `worldCoords` and `coordsFrom` in packages/geom/src/paths/pathOrigin.ts)
- severity: medium
- fix: packages/animator/src/rig/skin.ts
- size: function
- cause: absolute Float32 coords, no origin
- confidence: sure

## tweenVertexColors and staggerVertexColors read the caller's from/to arrays every frame but commit a copy taken at the start
- where: packages/animator/src/colorHelpers.ts:93 (tweenVertexColors), packages/animator/src/colorHelpers.ts:181 (staggerVertexColors colorsAt)
- scenario: `tweenColors` gives the tween `from: opts.from.slice(), to: opts.to.slice()`, so the target commits the start-time copy of `to`. The `interpolate` it passes ignores its own arguments, though, and calls `interp(opts.from, opts.to, t)` (or `colorsAt`, which closes over `opts.from`/`opts.to`) on the caller's live arrays. A caller who reuses or edits the array in place mid-tween (the registry's own docs describe in-place editing as normal) gets a path that follows the edited colors. When the tween ends it snaps to the committed copy. Frames and destination disagree.
- evidence: read
- severity: low
- fix: packages/animator/src/colorHelpers.ts
- size: line
- cause: closure over the caller's arrays rather than the copies
- confidence: sure

## An animation started on a hosted animator after dispose() stays registered forever
- where: packages/animator/src/createHostedAnimator.ts:52 (createHostedAnimator dispose/tick)
- scenario: after `hosted.dispose()`, `hosted.animator.tween({...})` still registers through `core.api`. `requestFrame` is suppressed and `tick`/`follow` return early on `disposed`, so the animation never ticks and never reaches the tripwire that would retire it. `animator.isActive()` stays true, `onDone` never runs, and a `keepAlive` or cycle holds its entry for good. `dispose` should leave the animator refusing or immediately retiring new work, not silently parking it.
- evidence: read (tripwire is only consulted inside a tick: engine/tweenAnimation.ts:55, engine/frame.ts:75)
- severity: low
- fix: packages/animator/src/createHostedAnimator.ts
- size: function
- cause: ticks gated on `disposed` while registration is not
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

<!-- done: 3 findings, files read: 34 -->
