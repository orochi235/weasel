fixed 1ed6ba02a9 | **A from-center polygon or star drawn by a level drag commits nothing** (A). The commit check now tests the extent `insertPreviewExtent` resolves, which is the shape the preview draws, instead of the drag's box.

fixed 948a869383, cbd79a8848 | **The container is picked at the raw press for snap and copies, but at `ends.start` for the commit** (A). In 948a869383 a from-center line's `ends.start` is its center. In cbd79a8848 one site picks the container and Space carries it with the shape; the snap reopens in the new container's scope, the preview copies follow it, and the new `InsertEnds.site` tells the dep where to pick. A click-place uses the raw click. This is my own call, recorded in `docs/unruled.md`.

fixed 0665faf66b | **A behavior-shaped start isn't the Shift pivot, and Space drops the behavior's shaping** (A). The end re-snaps about a start a behavior moved. A carry keeps `onStart`'s shift unless a snap target holds the start. `SpanSnap.anchor` now returns whether it moved the anchor.

fixed 54c1228ab5 | **A click-place that throws leaves the selection cleared and the snap session open** (A+B). Both are now restored and closed in `finally` blocks.

fixed 2e820ff323 | **Polygon and star defaults are written out twice** (A). They are now read from `SHAPE_DEFAULTS`. This is a deduplication with no behavior change, so no test can fail before it.

fixed aa260fa358 | **A click ignores rebound snap keys** (B). The dispatcher now puts an immediate action's resolved `roles` in its params, and `placeAction` reads them. The fix is in routing, so every immediate action that declares roles gets them.

fixed f9766979ac | **A click builds a built-in kind's extras differently from a drag** (B). A click-place now builds them through `insertShape`, as a drag from the click's center to the size's corner would. Custom kinds now get `originMode: 'center'`, as a centered drag's do. This is my own call, recorded in `docs/unruled.md` (50f8f42243).

fixed d060fc2cbe | **The preview's `lands` box is wrong inside a rotated or scaled parent** (B). Both poses now go through the container's frame before the difference is taken.

Extra defect found while fixing: kernel3d reads a centered drag's `ends.start` as the center, but a from-center line handed over its mirrored far end, so kernel3d placed the line's other end wrongly (sweep). Fixed in the same commit, 948a869383.

Checks, verbatim:
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run check:changesets`: "[changesets] OK — 2242 changeset(s)."
- `npm run typecheck:packages -- editing core routing measure`: ok for each
- `npm run lint -w @weasel-js/{editing,core,routing}`: "Missing script: "lint"" for all three; none of these packages has its own lint script. The root `npm run lint` passed inside the gate (32/32).
- Each touched test file alone with `--maxWorkers=1`:
  - `insert.behaviorStart.test.ts` 2 passed
  - `insert.ends.test.ts` 3 passed
  - `insert.extent.test.ts` 3 passed
  - `insert.pages.test.tsx` 6 passed
  - `placeAction.test.ts` 17 passed
  - `deps/insert.quantizeFrame.test.tsx` 1 passed
  - `dispatcher.modifierRoles.test.ts` 8 passed
- No browser tests were touched. The tree is clean.