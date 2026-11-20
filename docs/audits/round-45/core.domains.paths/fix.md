Anchor markers drawn from a stale path form (A+B): fixed fbcf7eb195

An inserted anchor between two unset widths got the stroke's current width baked in (A): fixed 6fad1ab4c2

`pathNode` dropped `place.pose.transform` (A): fixed 9337cadaea

The snap index and `ownGeometryAt` declared a partial scene type but read `scene.get` and `scene.composition` (A+B): fixed f3dfa6f1ef
- The same partial scene type was on `nodeFrameOf`, `shownNodeOf` and `storesEdits`, and on their callers: `pathNodesOf`, and path-tools' constraint links, `scenePaths` and warp. All of them now take the whole scene.
- The snap index now builds the pose frame once per rebuild instead of once per node.
- The changeset is `major` with tags `breaking fix`. A caller passing only a few of the scene's methods no longer compiles; such a call already threw at runtime on any node under a container.

`createPathLayer`'s warned set grew without bound (B): fixed 0951fb6dd4
- The set now holds only the mismatches the last draw met.
- Side effect: a node whose mismatch goes away and later comes back warns again.

Extra defects found while fixing:
- `liveAnchorMarkers` ignored the node's container frame, which `liveEditablePath` applies. It now takes the same `toWorld` argument, and `usePathEdit` passes it in. This is part of fbcf7eb195.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `editablePath.test.ts`: pass (16)
  - `anchorData.test.ts` (new): pass (2)
  - `pathNode.test.ts`: pass (5)
  - `pathSnap/pathSnapSource.test.ts`: pass (20)
  - `pathLayer.test.ts`: pass (17)
  - `nodeFrame.test.ts`: pass (4)
  - path-tools `constraintLinks.test.tsx`: pass (11)
  - path-tools `constraintLinks.frames.test.ts`: pass (1)
  - path-tools `warpActions.test.ts`: pass (15)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass ("OK — 2031 changeset(s)")
- `npm run lint -w @weasel-js/core` and `npm run lint -w @weasel-js/path-tools`: not run. Neither package has a `lint` script ("Missing script"). Instead:
  - root `npm run lint` passed inside the gate
  - `npx eslint` on every changed file: pass (exit 0)
  - `npm run typecheck:packages -- core path-tools`: pass (both ok)
- No browser tests were touched.
- The tree is clean, and `.skulk/` was not touched.