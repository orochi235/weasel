Polygon/star on a flipped pose took a negative radius and overflowed its box (A+B): fixed 91eff199c1

`hasStroke` said "no stroke" for a painted stroke with no width, which every painter draws 1 wide (A+B): fixed 316974861b

`kit:path` cull bounds ignored a pose override's path (A+B): fixed 7f88e140c6. The painter's `bounds` now measures `ctx.derivedPath`, or returns null for a path in parts. The real gap was the scene view's cull, which never passed that path on. It now does, through a new `withOverridePathBounds` in `canvas/derivedPath.ts`, and `PaintBoundsFn` and `defaultPaintBounds` both accept `derivedPath`. Reproduced with a node whose stored pose is off screen and whose override path is on screen.

`kit:path-pose` drawnBounds dropped the fill when the stroke covers only part of the outline (trim, dash or inner stroke) (B): fixed 1bc3ceb868. `drawnBoundsOf` already hid this by unioning the pose box, but the exported `findShapeDrawnBounds` returned the narrow box.

`kit:derived` drawnBounds ignored the fill, so a fill-only, inner-stroked or trimmed path got a box that left the fill out (B): fixed d68d612c08. Each painted part now adds its outline's own box. `drawnBoundsOf`'s `derivedBoundsOf` already unioned the path box, so only direct `findShapeDrawnBounds` callers saw this, including `kit:path` with a `derivedPath`.

Extra defects found: none.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `nodeShapes/shapePainter.test.ts` (new): pass, 2/2
  - `nodeShapes/nodePaint.test.ts`: pass, 4/4
  - `nodeShapes/pathPosePainter.test.ts`: pass, 5/5
  - `nodeShapes/derivedPainter.parts.test.ts`: pass, 7/7
  - `canvas/overridePath.test.ts`: pass, 13/13
- Also run and passing: `NodeShape.bounds`, `NodeShape`, `NodeShape.ink`, `NodeShape.trim`, `paintCull.pbt`, `paintCull.shrunk`, `inheritedPaints`, `derivedPath`, `buildSceneLayer.cull`, `drawnBounds`, `shapeBounds.pbt`, `shapeBounds.shrunk`, `strokedBounds`.
- `npm run typecheck:packages -- core`: pass ("1/1 core ok")
- eslint on the changed `.ts` files: pass (exit 0)
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1828 changeset(s).")
- Tree: clean apart from `.skulk/`. Each fix has its own commit and changeset.