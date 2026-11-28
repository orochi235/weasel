# Findings: animator (blind reviewer)

## toSkinPolygon drops a rect's far-from-origin precision: corners go straight into a Float32Array with no `origin`
- where: packages/animator/src/rig/skin.ts:43 (toSkinPolygon)
- scenario: `autoSkin` or `skinPath` on a rect at `x = 1e7, y = 1e7, width = 0.3` → `new Float32Array([x, y, x + width, …])` rounds each corner to the nearest 1 unit, so the rect's skin points collapse (width 0.3 becomes 0 or 1) and `skinPath` returns a polygon whose corners are off by up to 0.5. Geom's polygon paths keep precision with `origin` (`worldCoords`/`coordsFrom` in `packages/geom/src/paths/pathOrigin.ts`); this path should set `origin: { x, y }` and store corners relative to it.
- evidence: read
- severity: medium
- fix: packages/animator/src/rig/skin.ts
- size: line
- cause: rect corners stored as absolute Float32 with no origin
- confidence: sure

## skinPath writes its result relative to the rest path's origin, so a rect (or origin-less polygon) far from the origin loses precision on output too
- where: packages/animator/src/rig/skin.ts:80 (skinPath)
- scenario: the moved points are computed in Float64, then `coordsFrom(rest.origin, moved)` with `rest.origin` undefined writes absolute Float32 coords; a skinned shape at 1e6–1e7 jitters by whole units frame to frame as the rig moves. Choosing an origin (e.g. the first moved point, or the rest origin when present) would keep it.
- evidence: read
- severity: low
- fix: packages/animator/src/rig/skin.ts
- size: line
- cause: no origin chosen for the output path
- confidence: sure

## The rig's joint matrices are Float32, so a skeleton far from the origin resolves, skins and solves imprecisely; solveIk cannot meet its own 0.01 tolerance there
- where: packages/animator/src/rig/resolveSkeleton.ts:22 (toMat3)
- scenario: a root joint bound at `x = 1e6` → `m[6] = t.x` stores in a Float32Array (spacing 0.0625 at 1e6). `solveIk` builds every world from these (`resolve`, `tipWorld`), so `distance()` is quantized to ~0.06: with the default `tolerance: 0.01` a reachable target reports `reached: false` after all 32 CCD sweeps. `motionsFromRest` (`world * inverse(rest)`) cancels two large Float32 translations, so `skinPath` moves points by rounding noise of the same size even at the bind pose. Should resolve in Float64 (or relative to the root).
- evidence: read
- severity: medium
- fix: packages/animator/src/rig/resolveSkeleton.ts, packages/animator/src/rig/solveIk.ts, packages/animator/src/rig/skin.ts
- size: function
- cause: Float32 matrix for absolute translations
- confidence: likely

## An animation started from a cancel callback during dispose / unmount teardown is left registered forever
- where: packages/animator/src/createHostedAnimator.ts:56 (dispose); same shape in packages/animator/src/useAnimator.ts:113 (unmount cleanup)
- scenario: a tween with `onCancel: () => animator.spring({ target, to: rest })` (a "spring back on cancel"), or a `keepAlive(onCancel)` that restarts an effect. `dispose()` calls `core.api.cancelAll()` while `disposed` is still false, so the new spring registers and commits its `to`; then `disposed = true`, `tick` becomes a no-op and `requestFrame` is suppressed. The spring never ticks or finishes: `animator.isActive()` stays true, its target stays `active`, and a color target it moves keeps its registry slot (`release` refuses an active slot). Setting `disposed` before `cancelAll`, or looping `cancelAll` until nothing is active, would close it.
- evidence: read
- severity: low
- fix: packages/animator/src/createHostedAnimator.ts, packages/animator/src/useAnimator.ts
- size: line
- cause: teardown order lets callbacks register new work
- confidence: likely

## A stagger child that finishes before `addChild` miscounts `running`, which can end a backward-playing stagger early or never
- where: packages/animator/src/stagger.ts:272 (runStagger fire)
- scenario: `watchCompletion(child.id, …)` is called before `composite.addChild(child)`. `WatchCompletion` fires at once for an id that has already left, e.g. an `each` factory returning `animator.loop(f, { count: 0 })` (finishes synchronously) or a handle already canceled. `noteChildDone` then decrements `running` to −1 before `addChild` raises it to 0, and if `supervisor.rate() < 0` at that moment `rewound()` sees `running <= 0` and finishes the whole stagger while other children are still running backward. The finished child is also pushed onto `children` after it is gone. Registering the watch after `addChild` keeps the count true.
- evidence: read
- severity: low
- size: line
- cause: watch registered before the child is counted
- confidence: likely

## `axisIndexes` returns an axis twice when a name and its path prefix are both listed, so a hold double-counts it
- where: packages/animator/src/axisNames.ts:44 (axisIndexes)
- scenario: `animator.hold({ target: rig.target, axes: ['knee', 'knee.rotation'] })` → `['knee']` pushes the knee's five axes and `'knee.rotation'` pushes its rotation index again; the result has a duplicate index. Nothing dedupes, so the hold's per-axis mask/cover arrays see that axis twice (a release commits it twice, a weighted fold may weight it twice). The same comes from `jointAxes(skeleton, ['arm', 'arm'])`. A `Set` over `out` would answer each axis once.
- evidence: read
- severity: low
- size: line
- cause: no dedupe of resolved indexes
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

<!-- done: 6 findings, files read: 34 -->
