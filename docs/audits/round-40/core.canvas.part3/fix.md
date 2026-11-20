All four distinct findings were checked against the code. Three were real and are fixed, one in two places. The fourth doesn't happen as written, but checking it turned up a related cull bug in `<SceneCanvas>`, which is also fixed. All four commits sit on the frozen tree and the tree is clean.

- **claimsAbove counts slot layers that paint under the views** (A+B): fixed c893e17dd2
- **useHostAnchor never follows a host that mounts late or is replaced** (A+B): fixed e2d82aa4cb
- **one dispose removes a layer two owners registered** (A): fixed 0786aaea7e. Registering a layer again now also moves it to the top of hit order.
- **headless cull skips a `dependsOn` node by its stored pose box** (B): not a defect. A node with `dependsOn` and `derivePath` is drawn by `kit:derived`, which has no `bounds`, so `paintMissesView` never culls it. A `dependsOn` node without `derivePath` has no derived path to draw. A test in `derivedPathCull.test.ts` now pins this.

Extra defect, found while checking that last one:

- **`<SceneCanvas>` scene slot culls a path node by its pose box instead of its pose override's `path`** (sweep): fixed a2625b95e8. The headless view got this fix in 0bb71da607, but the slot in `sceneSlotWiring.ts` never did. Both now share `withOverridePathBounds`, which also carries the path into the slot's `toPose` box.

Each fix has its own `patch` changeset tagged `fix`. No behavior call was needed, so `docs/unruled.md` is unchanged.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, all pass:
  - `Canvas.viewRegistry.test.tsx`: 5 passed
  - `useHostAnchor.test.tsx`: 2 passed
  - `useExtraLayers.test.tsx` (new): 2 passed
  - `derivedPathCull.test.ts` (new): 3 passed
  - `overridePath.test.ts`: 13 passed
  - `SceneCanvas.slotLayerHits.test.tsx`: 5 passed
  - `SceneCanvas.contributions.test.tsx`: 5 passed
  - `SceneViewCanvas.test.tsx`: 17 passed
  - `CanvasView.hitAt.test.tsx`: 1 passed
- `useHostAnchor.browser.test.tsx` was not run: it needs a real browser.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `check:changesets` because three titles were over 140 characters. I shortened them and folded each into its own fix commit before the rerun.
- `npm run lint -w @weasel-js/core`: not run. That package has no `lint` script, only `test`, `build` and `typecheck`. I ran `npx eslint` on the changed files instead; exit 0.