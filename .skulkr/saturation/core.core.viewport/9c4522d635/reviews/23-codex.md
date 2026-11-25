# Review saturation for `core.core.viewport`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 23 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

This ledger carries forward V1–V13 from the [original viewport report](viewport-review-saturation-codex.md), which contains their locations, reproductions and evidence. The original pass 10 was verification and is excluded from this search ledger. The last two rows are fresh searches. The original run also verified 251 scoped tests.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | View invariants and anchored wheel zoom | 1 | 1 | 0 |
| 2 | World extents, clamping and fit contracts | 2 | 3 | 0 |
| 3 | Client projection and canvas measurement | 1 | 4 | 0 |
| 4 | Parallax and signed pick slop | 2 | 6 | 0 |
| 5 | Release velocity and coast boundaries | 2 | 8 | 0 |
| 6 | Interpolation, endpoints and scale ratios | 1 | 9 | 0 |
| 7 | Animator lifecycle and replacement | 2 | 11 | 0 |
| 8 | Overlay projection and freshness | 2 | 13 | 0 |
| 9 | Exported contracts, test coverage and callers | 0 | 13 | 1 |
| 10 | Camera cancellation and overlapping additive animation writes | 0 | 13 | 2 |
| 11 | Fit wrapper behavior, wheel routing and coordinate adapters | 0 | 13 | 3 |

Stopped after three consecutive passes with zero new defects.

No additional defects beyond V1–V13.

Source and tests were left untouched.

---

# Ten review passes on `core.core.viewport`

Reviewed on 2026-11-25 at Weasel commit `9c4522d63555ec5f264441bcef4cd6a1917eac02`. The scope is the 23 production files listed for `core.core.viewport` in [the audit partition](docs/audits/partition.json#L1856). Adjacent tests, public exports, and callers were used to check contracts and reachability. The passes were sequential and context-sharing. The count tracks newly recorded defects, so it does not support a capture–recapture estimate. The companion report supplied the yield-table and defect-index format. Findings below have their own evidence.

## Yield per review

| Pass | Focus | New | Distinct | Findings first recorded |
|---:|---|---:|---:|---|
| 1 | View invariants, anchored zoom, wheel reduction, default zoom bounds | 1 | 1 | V1 |
| 2 | Visible world extents, bounds clamping, fit modes, initial fit and reset | 2 | 3 | V2, V3 |
| 3 | Client and world projection, legacy transforms, canvas measurement and DPR | 1 | 4 | V4 |
| 4 | Parallax and inverse plane maps, pick slop under signed scales | 2 | 6 | V5, V6 |
| 5 | Velocity window, drag release, decay boundaries and visibility | 2 | 8 | V7, V8 |
| 6 | Camera interpolation, fixed-anchor law, endpoints and scale ratios | 1 | 9 | V9 |
| 7 | Animation lifecycle, shared animator ownership and replacement | 2 | 11 | V10, V11 |
| 8 | Live overlay projections, composed pose, inverse fallback and snapshot freshness | 2 | 13 | V12, V13 |
| 9 | Unit and property-test coverage, exported contracts and caller checks | 0 | 13 | Narrowed V5 and V6 to their triggering inputs and checked V7 against the existing drag action |
| 10 | Numeric probes, deduplication and scoped test verification | 0 | 13 | Confirmed V1–V5, V7 and V9 against the production modules |

## Distinct defects

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| V1 | Wheel zoom-in can jump to minimum representable zoom with an unbounded maximum | [zoomAt.ts](packages/core/src/core/viewport/zoomAt.ts#L16) | 1 | Low | Executed |
| V2 | Fit can return a non-finite camera position from finite bounds and host dimensions | [fitViewToBounds.ts](packages/core/src/core/viewport/fitViewToBounds.ts#L100) | 2 | Low | Executed |
| V3 | An overflowing visible span can install a non-finite position after canvas view normalization | [clampView.ts](packages/core/src/core/viewport/clampView.ts#L28) | 2 | Low | Executed primitive, caller traced |
| V4 | A representable node width disappears from the client rect far from the world origin | [sceneNodeClientRect.ts](packages/core/src/core/viewport/sceneNodeClientRect.ts#L35) | 3 | Low | Executed |
| V5 | A leading parallax zoom collapses the plane to the zoom floor at an ordinary camera zoom | [parallax.ts](packages/core/src/core/viewport/parallax.ts#L52) | 4 | Medium | Executed |
| V6 | A flipped scalar scale gives incorrect world-unit pick widening | [screenSlop.ts](packages/core/src/core/viewport/screenSlop.ts#L44) | 4 | Low | Boundary arithmetic |
| V7 | A recent movement loses all release velocity when its preceding sample is just outside the window | [createVelocityTracker.ts](packages/core/src/core/viewport/createVelocityTracker.ts#L20) | 5 | Low | Executed |
| V8 | A coast's internal boundary position can diverge from the camera it moves | [useDecayLoop.ts](packages/core/src/core/viewport/useDecayLoop.ts#L94) | 5 | Medium | Caller traced |
| V9 | A large, finite zoom-out ratio corrupts the entire interpolation axis | [interpolateView.ts](packages/core/src/core/viewport/interpolateView.ts#L15) | 6 | Medium | Executed |
| V10 | A shared animator keeps writing after the camera animation hook unmounts | [useViewAnimation.ts](packages/core/src/core/viewport/useViewAnimation.ts#L103) | 7 | Medium | Lifecycle traced |
| V11 | Switching animators strands the previous tween on its original animator | [useViewAnimation.ts](packages/core/src/core/viewport/useViewAnimation.ts#L160) | 7 | Medium | Lifecycle traced |
| V12 | Overlay marks an infinite live scale invertible and can replace its last valid mapping | [useNodeOverlayFrame.ts](packages/core/src/core/viewport/useNodeOverlayFrame.ts#L139) | 8 | Low | Predicate traced |
| V13 | An overlay's published box can go stale while its projection follows live edits | [useNodeOverlayFrame.ts](packages/core/src/core/viewport/useNodeOverlayFrame.ts#L77) | 8 | Medium | Data flow traced |

## Reproductions and impact

- **V1.** Start at unit scales and call `wheelZoom(view, { x: 0, y: 0 }, -1e6, { max: Infinity })`. The wheel multiplier overflows, the clamp passes through infinity, and normalization returns `1e-9` on both axes. A finite maximum intercepts the overflow.
- **V2.** Fit bounds `{ x: -Number.MAX_VALUE, y: 0, width: 1, height: 1 }` into `{ width: Number.MAX_VALUE, height: 100 }` from the unit view. The fit returns `x: -Infinity` at scale 8. The bounds pass `hasExtent`, and the final center subtraction overflows. This affects the exported fit primitive. Animation normalizes the resulting invalid position to zero.
- **V3.** With a view at the origin, x scale `1e-9`, bounds of width 1, and host width `Number.MAX_VALUE`, the x span is infinite and clamping yields `x: -Infinity`. The flipped-axis centering expression can yield `NaN` from opposing infinite terms. The canvas write path normalizes the input ahead of clamping and publishes the result directly. [Canvas view write path](packages/core/src/canvas/useCanvasView.ts#L109)
- **V4.** Use `bounds.x = view.x = 2 ** 54`, a node width of 1, and unit zoom. The rect comes back with width 0 at client x=0 because `bounds.x + bounds.width` already rounded to `bounds.x` before projection. The projected start and separately scaled extent would still be representable. The existing large-origin test exercises cancellation with a representable far endpoint.
- **V5.** Set the camera's x scale to 0.25 and the plane's `zoom` factor to 2. The plane x scale becomes `1e-9`, with a camera-to-plane x multiplier near 250 million. This makes a leading layer effectively vanish along the affected axis and makes plane-space coordinates extremely sensitive to camera-space changes. The existing test pins preservation of the scale sign at the floor, so it can pass while the layer loses useful scale.
- **V6.** `widenSlop(0, 4, -2)` returns 4 world units, which span 8 pixels at that zoom magnitude. The corresponding positive scale returns 2 world units. This affects the scalar fallback. The structured screen-slop path already keeps the width in pixels.
- **V7.** Record `(0, 0, 0)` followed by `(110, 0, 110)`, then read at time 110. The tracker returns zero even though the newest displacement represents 110 px over 110 ms. Pruning discards the timestamp needed to estimate the part of that interval inside the window. Drag release reads this tracker directly, so sparse or delayed move delivery can suppress a fling. [Drag release caller](packages/core/src/interactions/actions/defaults/viewportDragPan.ts#L142)
- **V8.** Start a decay with `initialPosition.x = 0` and `maxX = 100`, then move the camera externally to x=99 while the loop is active. At the next step the loop checks its accumulated position and the drag action adds the reported delta to the live camera. This can cross the configured limit without triggering its boundary behavior. Independent canvas bounds may clamp the actual write, which can also desynchronize the two positions. [Drag decay write](packages/core/src/interactions/actions/defaults/viewportDragPan.ts#L148)
- **V9.** Interpolate x scale from `1e9` to `1e-9` and x position from 0 to 10. `(s1 - s0) / s0` rounds to −1, so the logarithm is negative infinity. The x scale is `NaN` at t=0 and zero at t=0.5 and t=1. The x position is `NaN` at all three samples. Normalization at the view channel hides the invalid numbers while leaving the zoom path broken.
- **V10.** Mount a child using a parent-owned animator, start a camera tween, then remove only the child. The camera wrapper provides no teardown for its key. The parent animator keeps the target and channel closure alive through completion, so the old child can still produce channel writes and its completion callback. The private animator path has its own mount cleanup. [Animator cleanup](packages/animator/src/useAnimator.ts#L90)
- **V11.** Start a tween on animator A and rerender with B while A remains active. The stable runner reads the latest animator for `isAnimating`, `stop`, and the next `animate`. Those operations address B, while A still owns the old work and can write through the latest channel. This case needs two live animators and is separate from unmount cleanup.
- **V12.** Give a measured overlay a view thunk that initially returns unit scale and later returns `Infinity` on x. The reciprocal is zero, which passes the finite-reciprocal test, so the hook can cache a projection with an infinite axis. Forward projection yields infinity or `NaN`, and inverse projection collapses finite x values onto the camera origin. An ordinary normalized canvas view avoids the trigger, but the public hook accepts a caller-supplied thunk.
- **V13.** With the same scene object, change a node's dimensions or pose through an in-place scene edit and leave the overlay component otherwise idle. The retained frame's `box` stays at render-time coordinates, while `toScreen` and `toLocal` re-read the current composed pose. The resulting frame combines stale bounds with a fresh mapping until the consumer renders again. This matters for callers that use the returned box to resolve bounds-relative geometry or paint.

## Verification

The scoped Vitest run passed all 24 test files and all 251 tests using the `core` project, one worker, and cache disabled. The executed probes bundled the current TypeScript modules in memory and exercised the reported edge cases separately. The lifecycle and reactive cases are source-traced. The only deliverable from this review is this report.
