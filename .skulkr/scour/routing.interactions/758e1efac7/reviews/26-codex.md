# routing.interactions review saturation

Snapshot: 758e1efac7f7b00b7fbbcf6a13741249d6c3640f

Scope is the 14 files in `/private/tmp/skulkr-saturation/lists/routing.interactions.txt`. The checkout matched the snapshot and had no in-scope changes. Adjacent callers, tests, and contracts informed the review. All findings are located in scoped files.

## Pass ledger

The passes shared context. Counts are deduplicated by root cause.

| Pass | Focus | New | Cumulative | Consecutive zero-new passes |
| --- | --- | ---: | ---: | ---: |
| 1 | Public contracts, dispatcher release path, and cancellation from callbacks | 3 | 3 | 0 |
| 2 | Carry hit testing, scroll coordinate frames, and iframe realms | 3 | 6 | 0 |
| 3 | Click propagation and listener order, including the reorder-list caller | 1 | 7 | 0 |
| 4 | Sweep sample boundaries and short intersections with ordinary-sized items | 1 | 8 | 0 |
| 5 | Key matching, reserved chord modifier folding, and scratch-store ownership | 0 | 8 | 1 |
| 6 | Pointer identity, capture loss, blur, and missed-release policy across callers | 0 | 8 | 2 |
| 7 | Nested surface precedence, unavailable hit testing, and nonfinite sweep input | 0 | 8 | 3 |

## Findings index

| ID | Finding | Severity | Evidence |
| --- | --- | --- | --- |
| RI-01 | Sweep skips items reached between the last move and release | Medium | Source trace and callback probe |
| RI-02 | Threshold drag delivers a move after cancellation from onStart | Medium | Callback probe |
| RI-03 | Carry enters a new surface after canceling during leave | Medium | Callback probe |
| RI-04 | Carry rejects visible descendants outside the surface box | Medium | Source trace |
| RI-05 | A viewport-sticky handle acquires a false scroll delta | Medium | Source trace and geometry probe |
| RI-06 | Handle drag loses coordinate corrections for iframe elements | Medium | Source trace |
| RI-07 | Click guard lets later capture listeners on its own target fire | Low | EventTarget probe |
| RI-08 | A sweep can miss a crossed item between two samples | Low | Source trace and exact coordinates |

## RI-01 — Sweep skips items reached between the last move and release

- where: `packages/routing/src/interactions/sweep/sweep.ts:147` (`createSweepAction`)
- scenario: Put A at x < 10 and B at x ≥ 10 on the sweep path. Press at x = 0, open the drag at x = 5, report a final move at x = 7, then release at x = 15. The dispatcher receives the release point and ends the handle with commit. The sweep reports A and commit, leaving B untouched. It should traverse to the release point before committing, so B is entered.
- evidence: probed the source action with deterministic hit testing and observed `A, commit`. The recognizer dispatches pointerup at the release coordinates, and `dispatcher/gestureRun.ts:161` ends the action on that event.
- severity: medium

## RI-02 — Threshold drag delivers a move after cancellation from onStart

- where: `packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:77` (`startThresholdDrag`)
- scenario: Keep the returned handle. In `onStart`, call `handle.cancel()` after discovering the item can no longer be dragged. The move that crossed the threshold invokes `onStart`, then `onCancel`, then `onMove`. That final move can recreate a preview which cancellation just cleared. Cancelling the handle should prevent delivery of that move.
- evidence: probed the threshold callback sequence with a synchronous session cancel double and observed `start, cancel, move`. The real session also calls its cancellation callback synchronously after teardown.
- severity: medium

## RI-03 — Carry enters a new surface after canceling during leave

- where: `packages/routing/src/interactions/carry/carry.ts:124` (`startCarry`, `step`)
- scenario: Start over A, then move onto B. Have A's leave callback cancel the carry, for example when leaving invalidates the source item. The source receives cancellation, then B still receives enter and the source receives move. B can start an ongoing action that will receive neither drop nor leave because the session is already closed. After cancel, neither B's enter nor the source move should fire.
- evidence: probed the carry with deterministic hit testing and a synchronous session cancel double. Observed `A leave, source cancel, B enter, source move`.
- severity: medium

## RI-04 — Carry rejects visible descendants outside the surface box

- where: `packages/routing/src/interactions/carry/carry.ts:84` (`surfaceAt`)
- scenario: Put a positioned child on a carry surface with `overflow: visible`, extending beyond the surface border box. Release over the exposed part of the child. Even when document hit testing returns that child and the surface contains it, the rectangle prefilter rejects the surface before using that information. A visible and uncovered descendant should route to its containing carry surface.
- evidence: read. For a surface spanning x = 0–100 and a child spanning x = 90–120, x = 110 fails the first check despite the contained hit. The adjacent sweep helper accepts a contained hit without that rectangle gate.
- severity: medium

## RI-05 — A viewport-sticky handle acquires a false scroll delta

- where: `packages/routing/src/interactions/handleDrag/handleDrag.ts:121` (`stickyScrollerOf`)
- scenario: With the standards-mode document as the scroller, begin a drag in a header already stuck at `top: 0`. Scroll the page down 30 CSS pixels while the pointer stays still, then report another move. The sticky header is still at client y = 0, but the root element's border-box top moved by −30. The difference used by the helper drops by 30 and the reported handle-local y also drops by 30 at scale 1. A pointer and header that stay fixed in the same client positions should retain the same local y.
- evidence: read the root branch and local conversion. A source probe with document and sticky rects modeling the scroll produced a −30 correction for the stationary header.
- severity: medium

## RI-06 — Handle drag loses coordinate corrections for iframe elements

- where: `packages/routing/src/interactions/handleDrag/handleDrag.ts:106` and `:141` (`scrollerOf`, `defaultRectEl`)
- scenario: Render a handle into a same-origin iframe through a portal from the parent app. The hook runs in the parent's realm, so an iframe SVG handle fails the ambient `instanceof SVGElement` test and reports coordinates relative to its own box instead of its owning SVG. An iframe HTML scroller also fails the ambient `instanceof HTMLElement` test. If that scroller is shown at 2× scale, scrolling it by 10 CSS pixels is treated as 10 client pixels instead of 20. Frame-local elements should get the same SVG default and scale correction as elements in the app's own document.
- evidence: read. Both checks use ambient DOM constructors while the rest of the scroll walk already gets the view from the element's owner document.
- severity: medium

## RI-07 — Click guard lets later capture listeners on its own target fire

- where: `packages/routing/src/interactions/pointerSession/swallowClick.ts:14` (`swallowClick`)
- scenario: Arm the guard on a container, then add another capture listener on that same container before the next click. The guard stops the click from reaching descendants, but the later listener on the container still runs and can process the press a second time. The documented listener suppression should include later listeners on the guard's own target, including when `keepDefault` preserves the native action.
- evidence: probed the source against Node's EventTarget and observed one call to the later capture listener.
- severity: low

## RI-08 — A sweep can miss a crossed item between two samples

- where: `packages/routing/src/interactions/sweep/sweep.ts:138` (`createSweepAction`, `travel`)
- scenario: Put an ordinary 20 × 20 sweep item at x = 10–30 and y = 0–20. Sweep from (7, 16.5) to (13, 22.5). The segment passes through the item for x = 10–10.5. Its length gives three steps, with sampled x values of 9, 11, and 13. The crossed item gets no enter. The documented fast-sweep behavior promises the item is reached.
- evidence: read and calculated from the interpolation formula. The motion is about 8.49 CSS pixels, within the normal sampling regime.
- severity: low

## Stop reason

Stopped after pass 7, the third consecutive completed pass with zero new findings. Runtime evidence consists of targeted source probes with controlled inputs. Browser scenarios were traced from source.

## Files read

packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/carry/index.ts
packages/routing/src/interactions/elementAt.ts
packages/routing/src/interactions/handleDrag/handleDrag.ts
packages/routing/src/interactions/keyHelpers.ts
packages/routing/src/interactions/pointerSession/index.ts
packages/routing/src/interactions/pointerSession/pointerSession.ts
packages/routing/src/interactions/pointerSession/swallowClick.ts
packages/routing/src/interactions/scratchKey.ts
packages/routing/src/interactions/sweep/index.ts
packages/routing/src/interactions/sweep/sweep.ts
packages/routing/src/interactions/thresholdDrag/index.ts
packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts

<!-- done: 8 findings, files read: 14 -->
