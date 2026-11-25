- Node moved into a wide container with its box unchanged is never put into the child BVH (A+B): fixed 3400d9caa3
- `RasterSession.renderIds` drops the plan's `screen` at `pixelRatio` ≠ 1 (A+B): fixed 07e30bfead
- Visibility-index cache grows by one entry per `paintBounds`/`toPose` identity, with no bound (A+B): fixed 5c08f41158 (it now keeps the four most recently used pairs per scene)
- A paste onto a page keeps the copied layer instead of the page's (A+B): fixed c01fd859c6
- `geometryGenerationOf` can return a value it returned before (B): fixed c86e4f8ce3 (it is now a counter that only goes up, bumped whenever the painter set or any painter's generation changes; added `nodeOutline.ts` to `scripts/check-part-caches.allow.mjs` with the reason)
- `reportCommandLosses` ignores group effect programs that have no GLSL source (B): fixed b28ecb731e
- `affineImage` drops the `BOX_ALL` answer for a non-finite copy image, so it gets unioned as the box at the origin (B): fixed 29c8b882b7 (public `BoxImage` may now return `BoxKind`, so that changeset is `minor`)

No extra defects found.

Checks:
- Touched test files, one at a time with `--maxWorkers=1`: `nodeOutline.test.ts` 9 passed, `reach/reachTree.test.ts` (new) 2 passed, `reach/sceneVisibility.test.ts` 15 passed, `renderDiagnostics.test.ts` 2 passed, `renderSceneToPixels.test.ts` 26 passed, `sceneClipboard.test.ts` 3 passed. Each new test was seen failing before its fix.
- Related tests that weren't touched: `sceneAdapter.clipboard.frame`, `sceneAdapter.pasteDescriptor`, `sceneAdapter`, `sceneAdapter.clipboard.landing`, the three `pickIndex` files, and the `pathSnap` tests all pass.
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run check:changesets`: "[changesets] OK — 3094 changeset(s)."
- `npm run lint -w @weasel-js/core`: fail, because `@weasel-js/core` has no `lint` script. Instead I ran `npx eslint` on every changed `.ts` file, which passed with exit 0.

tally: 7 of 7 fixed, 0 extra fixed