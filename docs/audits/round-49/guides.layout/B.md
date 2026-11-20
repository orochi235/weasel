# Audit round 49 — guides.layout — blind reviewer findings

## tileGrid offers empty cells as drop targets, then childPoses compacts the dropped child out of them
- where: packages/guides/src/layout/strategies/tileGrid.ts:237 (getDropTargets / offeredCells) against tileGrid.ts:227 (childPoses → packTiles) and tileGrid.ts:260 (arrive)
- scenario: `tileGrid({ cols: 3, rows: 3 })` holding a, b, c in cells 0–2. Drag `a` from inside onto empty cell 8: `offeredCells` offers every cell for an inside drag, the preview (`reflowPoses`, empty map) shows `a` in cell 8, and `commitDrop` writes `a` there. The edit poses a child of the container, so the layout pass (`changed` includes "one of whose children was posed", core/scene/arrivalTypes.ts:8) runs `childPoses`, which `packTiles` compacts by cell order: `a` lands in cell 2, not 8. A drop from outside onto empty cell 8 goes through `arrive` instead, which keeps the child in cell 8 (no compaction) — until the next edit to any sibling runs `childPoses` and moves it to cell 3. So the same question (does a child keep a non-compact cell?) is answered "yes" by `arrive` and the drop targets and "no" by `childPoses`, and the offered target is not where the drop rests. Either the empty cells past the compacted run should not be offered (or should map to the end of the run), or `childPoses` should not compact.
- evidence: read
- severity: medium

## pack's `'grow'` overflow never resizes on a drop that reorders, or on a width change
- where: packages/guides/src/layout/strategies/pack.ts:97 (resize) via sequence.ts:124 (childPoses) and sequence.ts:143 (commitDrop)
- scenario: `pack({ overflow: 'grow' })` resizes only through `sequenceLayout`'s `arranged`, which is reached from `arrive` and `depart` alone. A same-container drop goes `commitDrop` → layout pass `childPoses`, neither of which calls `resize`. Container 100 wide holding A (60×10), B (60×50), C (40×50) in order A,B,C: shelves are [A] [B,C], height 60, container grown to 60. Drag C before B: `place` (never null under `'grow'`) offers that index, the drop lands, shelves become [A,C] [B], height 100 — but the container stays 60, so B hangs 40 units below its bottom. Same when the container is resized narrower: `childPoses` reflows onto more shelves at the same height. Expected: the container height follows its content, as the `'grow'` doc says.
- evidence: read
- severity: medium

## tileGrid takes `cols`/`rows` unvalidated: 0 writes NaN poses, a fraction lays cells off-grid
- where: packages/guides/src/layout/strategies/tileGrid.ts:201 (tileGrid), packages/guides/src/layout/strategies/tileCells.ts:49 (tileGridOf / rectAt)
- scenario: `tileGrid({ cols: 0, rows: 2 })` (e.g. a cols field bound to a number input cleared to 0): `perLine` is 0, so `rectAt(i)` computes `i % 0` = NaN and `cw = w / 0`; `childPoses` writes `{ x: NaN, … }` into every child. Under `'grow'`/`'scroll'`, `linesFor` is `ceil(n/0)` = Infinity, `cells` is NaN, and `offeredCells` pushes the NaN index as a target. `cols: 2.5` gives `perLine` 2.5, so `rectAt(2)` is column 2 of a 2.5-column pitch (overrunning the container) and `rectAt(3)` is a half-column offset. `gridSlots` answers the same question by flooring and offering no cells under one (arrangements.ts:61–65, ruled in docs/unruled.md 2026-11-11); `tileGrid` should do the same.
- evidence: read
- severity: medium

## slots: a drop from outside can swap two existing children, because `arrive` reads them against the pre-drop slot count
- where: packages/guides/src/layout/strategies/sequence.ts:165 (arrive) with slots.ts:60 (order)
- scenario: `slots({ arrangement: rowSlots() })`, container x 0, width 120, children `z` centered at 30 and `y` at 90 (slots for 2: 30, 90). Drag `X` in from another container and drop on index 2: `commitDrop` shifts the siblings to the 3-slot arrangement (20, 60, 100), so `z`→20, `y`→60, `X`→100. The layout pass then calls `arrive` (types.ts:200, "A drag onto the container arrives here too, after `commitDrop` has placed it"), which orders `held` with `count = held.length` = 2, i.e. against slots 30 and 90. `z` (20) is nearest slot 0; `y` (60) is exactly 30 from both and the strict `<` in `nearestSlot` gives it slot 0 too; the id tie-break then puts `y` before `z`. `place` writes `y`→20, `z`→60: the two children that were not dragged trade places. Expected: `z`, `y`, `X` as previewed. The held children were already arranged for `held.length + arrivals.size` slots on the drag route, but for `held.length` on the insert route; `arrive` assumes only the latter. Any arrangement where two n+1 positions fall nearest one n-slot does the same (rings, grids).
- evidence: read (worked by hand from the code)
- severity: medium

## quadtree's `maxDepth` is unbounded, and its free-cell scan is 4^depth per child
- where: packages/guides/src/layout/strategies/quadtree.ts:79 (freeCells), :127 (depthOf), :55 (overlaps)
- scenario: `quadtree({ maxDepth: 8 })` with 100 point-sized children (size 0 → every child at depth 8): `assign` calls `freeCell` per child, each enumerating 4^8 = 65,536 cells and testing each against up to 100 taken cells — ~650M overlap tests per `childPoses`, which runs on every edit, and again in `getDropTargets` per pointer move. The tab hangs. Past `maxDepth` 31, `2 ** depth` overflows the `>>` in `overlaps` (shift taken mod 32) and the loop in `freeCells` never finishes. Nothing clamps `maxDepth` or documents a ceiling; other loop-driving options in this package are clamped (`snapPoint`'s 129 × 129, unruled.md 2026-11-09).
- evidence: read
- severity: medium

## Files read
packages/guides/src/layout/perContainer.ts
packages/guides/src/layout/snaps.ts
packages/guides/src/layout/strategies/arrangements.ts
packages/guides/src/layout/strategies/freeform.ts
packages/guides/src/layout/strategies/index.ts
packages/guides/src/layout/strategies/pack.ts
packages/guides/src/layout/strategies/quadtree.ts
packages/guides/src/layout/strategies/sequence.ts
packages/guides/src/layout/strategies/slots.ts
packages/guides/src/layout/strategies/snapPoint.ts
packages/guides/src/layout/strategies/testing/moveLayoutStubs.ts
packages/guides/src/layout/strategies/tileCells.ts
packages/guides/src/layout/strategies/tileGrid.ts

<!-- done: 5 findings, files read: 13 -->
