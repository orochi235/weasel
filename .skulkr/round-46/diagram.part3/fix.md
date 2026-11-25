- Reconnect drops the caller's `frame` when it places the fixed end (A+B): fixed 91a9397a32. The same omission was in `createEdgeEnds` (`edgeEndLayer.ts`), so the edge-end handles and the routes they read were also off the frame. Fixed in the same commit.
- Stencil rows are measured at 16px but drawn at `font` (A): fixed 5fca39d88b. `diagramScene`'s measure wrapper moved into a shared `measureInFace` (`faceMeasure.ts`), and the stencil path now uses it too.
- Remove waypoint ignores locked and hidden edges and throws on commit (A+B): fixed 30160e822a. It now applies the same `offersPorts` and `isLocked` gate as the handle layer, on both the press path and the point path.
- Reset route is enabled with a locked edge selected and throws mid-batch (A+B): fixed d2ae44b135. It now reports `ActionDisabledReason.Locked`, as `routerPlan` does, and `run` does nothing in that case.
- waypointFollower rewrites a locked connector, so the whole move is refused (B): fixed 46964df741.
- `reorderTargetOf` hangs when cluster boxes hold each other through `dependsOn` (B): fixed 379748ee33. Before the fix the test hung until a 60 s timeout killed it.
- `createDiagramNodes` gives kind traits to edges, labels and lanes (B): fixed a85c72366e. A node whose own trait takes no ports now gets nothing from its kind. The docstring now says `{ ports: [] }` is how a node opts out.
- The outline polyline joins separate subpaths, so ports can land in the gap between pieces (A): fixed 4e84ad5149. A new export, `outlineRings`, returns one closed ring per subpath, and `rayHit` now accepts rings. `portsOnOutline` and `portsOf` cast against those rings. This change has two changesets: a `patch` fix, and a `minor` for the new API (`outlineRings`). Single-subpath shapes get the same `outlinePolyline` output as before.

No extra defects found beyond the `edgeEndLayer.ts` sibling above. No call needed an entry in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file: `reconnect.test.ts` 20 passed, `stencil.test.ts` 16 passed, `waypointAction.test.ts` 22 passed, `waypoint.scene.test.ts` 7 passed, `reorderModel.test.ts` 8 passed, `trait.test.ts` 5 passed, `onOutline.test.ts` 18 passed. I also ran these untouched neighbors: `ports.test.ts` 28 passed, `ports.pbt.test.ts` 2 passed, `effect/glyphs.test.ts` 12 passed, `contribution.test.ts` 12 passed, and the 9 `fromData*.test.ts*` files 82 passed. Each new test failed with its fix reverted.
- `npm run checks:gate`: the first run failed typecheck with TS18048 (`deps` possibly undefined in the Reset route `enabled`). After fixing that into its commit: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/diagram`: the package has no `lint` script ("Missing script: lint"). Instead I ran eslint on every changed file (exit 0) and `check:size` ("no file or function grew past its cap").
- `npm run check:changesets`: "OK — 2035 changeset(s)".
- No browser tests were touched. The tree is clean apart from `.skulk/`.