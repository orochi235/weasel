- joinPaths takes its origin from the first part only, so a far part loses float32 precision (A+B): fixed 24a379cbe2
- joinPaths drops each part's `corners` and `openFill` (B): fixed 4734300ab9. **Question:** no one has ruled on what happens when the open parts disagree on `openFill`. I made the strict call: the first open part's rule wins and it warns. It is recorded in `docs/unruled.md` (4217d260dd).
- translatePath leaves an origin-free polygon moved far from 0 in raw float32, where transformPath gives it an origin (B): fixed 33cf137186
- reachToMeet in `'curvature'` mode on a straight end grows an infinite line and finds nothing (B): fixed 68f018d4c0
- splitByClosure puts corner specs one anchor off after a subpath that starts without an `M` (A+B): fixed a0cedf6e00
- simplifyAnchorsAt rotates a closed subpath so it starts on a different anchor (A+B): fixed f628bc1231
- mergeRegion reads its winding from an area that depends on `openFill`, though it treats every subpath as closed (B): fixed 4363ceb8d5
- solveSpiro forces the tangent at a point next to a coincident neighbor to +X (A): fixed 53fb6a3dc6
- schneiderFit breaks the tangent at every split, and a repeated sample pins a handle onto its anchor (A): fixed bce9380d87
- roundRectPath with 0 corner samples and circlePath with 0 segments build NaN or empty geometry (A): fixed 159afe81fd. **Question:** this needed a behavior call. I made the strict one: both throw `RangeError` instead of clamping. It is recorded in `docs/unruled.md`.
- mergeRegion leaves a ring open where three edges cross at one point, then closes it with a chord (A): fixed 6f1b4456d3. The test reproduced the failure before the fix: edges were left inside the fill.

Extra:
- growRegion has the same winding mistake as mergeRegion, taking its offset side from the `openFill`-dependent area (sweep): fixed 4363ceb8d5, in the same commit as mergeRegion's.
- fb5e35de40 shortens seven of my changeset titles to under 140 characters, which `check:changesets` requires.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, each failing before its fix and passing after: pathOriginReaders.test.ts pass (22), transform.test.ts pass (8), simplifyAnchors.test.ts pass (8), splitByClosure.test.ts pass (5), spiro.test.ts pass (9), schneiderFit.test.ts pass (13), markers.test.ts pass (10), reachPath.test.ts pass (15), mergeRegion.test.ts pass (10), growRegion.test.ts pass (10)
- Neighbors run unchanged: simplifyAnchors.property.test.ts pass, spiroG4.test.ts pass, spiroPath.test.ts pass, bendAlongPath.test.ts pass, path-tools usePencilTool.test.tsx pass, editing insert.test.tsx pass
- `npm run check:changesets`: pass
- `npm run checks:gate`: "checks:gate: all 32 passed". That includes the root `npm run lint` and `typecheck:packages`.
- `npm run lint -w @weasel-js/geom`: **unrun**. The PreToolUse hook refused it as a suite-sized script on the controller. Only the root lint inside checks:gate covered geom. No other package's code changed.
- Tree is clean.

tally: 14 of 14 fixed, 1 extra fixed