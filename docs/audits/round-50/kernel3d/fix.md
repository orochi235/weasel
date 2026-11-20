The pick index keeping deleted nodes' exact boxes (A+B): fixed fcb8f97fc2
The 3D marquee ignoring the asking view's `viewId` (A+B): fixed f21ae394fd
`camera.pinchDolly` subtracting the pane origin from a centroid that is already view-local (A): fixed 21a486019f. This needed a behavior call nobody had made, so I made it and recorded it in `docs/unruled.md`: the camera dep's `origin` now applies only to the wheel. A host that draws its 3D pane as a sub-rect of a plain canvas, with no `<CanvasView>`, would now get a pinch anchored off by that origin.
The line pass dropping a segment that straddles the near plane (A): fixed d7d3e6f97d. The segment is now clipped where it crosses the near plane, and a head whose tip is past it is not drawn. I rewrote the browser test that pinned the old dropping. That test fails on the frozen shader and passes on the new one.
The pick index boxing a node with its stored data instead of the data its override shows (A): fixed 6aba28dd5d
An unbounded box giving a shared alignment plane a NaN locus (B): fixed 48efaf3b13
A level drag under a tilted `up` overwriting one world axis (B): fixed 37f376c683

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `packages/kernel3d/src/pickIndex.test.ts`: pass (12)
  - `packages/kernel3d/src/deps.test.ts`: pass (38)
  - `packages/kernel3d/src/tools.test.ts`: pass (21)
  - `packages/kernel3d/src/screenPose.test.ts` (new): pass (2)
  - `packages/kernel3d/src/snap/sources.test.ts`: pass (5)
- Also run: `tools.pbt`, `pinchDolly.integration`, `move`, `cameraUp`, `deps.pbt`, and `snap/` `sources.pbt`, `sources.shrunk`, `session3d`, `session3d.pbt`, `exactSnap`: all pass.
- `packages/kernel3d/src/lines/pass.browser.test.ts`: it did run here, under `--project=browser`: pass (4). `eyeRelative.browser.test.ts` and `logDepth.browser.test.ts`: pass (5).
- `npm run check:changesets`: pass.
- `npm run checks:gate`: 30 of 32 pass. These two fail, both in files this work did not touch (the gate's own output):
  - `check:numeric`: FAIL. `apps/draw/src/dev/audits/Treemap.module.css:119  compose .numeric from @weasel-js/theme/numeric.module.css instead  font-variant-numeric: tabular-nums`
  - `lint -w @weasel-js/labkit`: FAIL. `components/SpanStrip/SpanStrip.module.css:40  raw font-size … 1 design-token violation(s).`

  I left them unfixed because they belong to other areas, and a patch from this area touching their files could conflict with those areas' fixers. They will fail the batch gate unless someone fixes them there.
- `npm run lint -w @weasel-js/kernel3d`: kernel3d has no `lint` script. The root `npm run lint` passed inside the gate.
- The tree is clean: everything is committed, nothing is left in `.skulk/`, and the stash stack is empty. I ran one `git stash` by mistake, then applied it back by SHA and dropped it. Nothing was lost.

tally: 9 of 9 fixed, 0 extra fixed