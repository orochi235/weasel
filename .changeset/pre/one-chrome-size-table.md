---
'@weasel-js/core': patch
---

Selection handles are hit-tested at the size they are painted

Handles painted at `HANDLE_BASE_PX * targetScale` and hit-tested at the bare
constant, and neither `buildAffordanceAt` call site passed the option that
would have scaled it. A coarse pointer got a bigger picture and exactly the
same 8px grab zone it had on a mouse — the touch forgiveness the coarse profile
exists to provide never reached the hit-test. The slops debug overlay was a
third unscaled copy, so it drew hit regions where they were not.

`core/device/targets.ts` now holds one base table and one accessor,
`targetSizesPx(targetScale)`. Paint, hit-test and the debug overlay all resolve
through it. `HANDLE_BASE_PX`, `ANCHOR_HIT_BASE_PX` and
`ROTATION_HANDLE_BASE_PX` keep their names and values and now read off the
table; the internal `HANDLE_HIT_RADIUS` and `ANCHOR_HIT_RADIUS` are gone.

`buildAffordanceAt` and `createSlopsDebugLayer` take an optional `targetScale`.
`selectTool.handleHitRadius` now actually reaches the hit-test — it previously
reached nothing.

`useRotateTool`'s `handleHitRadius` option is **removed**. The rotation
affordance is an annulus with a band thickness and no point radius, so the
option could only ever have been a second name for `rotationHandleDistance`,
which is live and now defaults from the same table.

Known gap: `CanvasView` is a second `buildAffordanceAt` call site that reads no
device profile, so a nested view still hit-tests at the fine-pointer size.
