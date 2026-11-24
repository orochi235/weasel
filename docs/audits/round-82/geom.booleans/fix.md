Cubic self-crossing not cut when the loop sits in one half of the curve (A): fixed b3f79dda46

Knife gives an untouched island's own hole to the cut piece around it (A): fixed 91e2ac978d

Knife gives an untouched island's own hole to the cut piece around it (B): duplicate of the A finding above, fixed 91e2ac978d

Large nonzero path with crossing rings falls back to nesting by containment when the cut declines (A): fixed 139fc89d58. The fallback is now `contourFaces`, the ring-based core split out of `curveFaces`.

`cyclesOf` shoelace taken on absolute coordinates, so face areas change sign far from the origin (B): fixed 7316abb87f

`groupRings` orients rings by an uncentered shoelace and loses small holes far from the origin (B): fixed 12e8117d67. The local copy is replaced by `polyline.ringSignedArea`, which recenters on the first vertex.

`curveFaces` 1024-chord cap silently ignores a fine `flattenTolerance` (B): fixed 9a101500a8. This was a strict call: it now throws a `RangeError` that names the finest tolerance it can honor. It is recorded in `docs/unruled.md`.

`polishCrossings` Newton tolerance ignores coordinate magnitude, so nothing far from the origin is polished (B): fixed bd331af1f6

Clipper's coarsest snap grid is coarser than float32, against its stated bound (B): fixed 0ef889f126. The last grid is now 2^-24 of the inputs' size.

Extra defects:
- The booleans had two copies of `clockwiseFirst`, in `curveBoolean.ts` and `curveFaces.ts` (sweep): fixed 1b1acac54e. Both now use one copy in `contourSegments.ts`.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `curveEdges.test.ts`: pass (1)
  - `splitBySegment.test.ts`: pass (60)
  - `adapter.test.ts`: pass (16)
  - `pathFaceArrangement.test.ts`: pass (15)
  - `clipper.test.ts`: pass (1)
- The whole `packages/geom/src/booleans/` directory: pass (244)
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w packages/geom`: not run, because the package has no `lint` script. eslint on every changed `.ts` file instead: pass
- `npm run check:changesets`: pass (OK, and none of the warnings are from my changesets)

tally: 9 of 9 fixed, 1 extra fixed