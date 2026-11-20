Note: the brief names frozen commit 2f3b11aab7ae249a1690ff9a4409dbdf440e5222, which this checkout does not hold
(`git cat-file` reports a bad object). HEAD is d057251407; `packages/guides` has no working-tree changes, so the
files were read as they stand at HEAD.

## The alignment and spacing sources' target cache ignores the zoom and stroke setting the drawn boxes depend on
- where: packages/guides/src/sources/targets.ts:39 (cachedPerScene)
- scenario: `cachedPerScene` keys its derived lines and gaps on scene identity, `getVersion()` and `exclude` only. It
  lives in the source, so it outlives each snap session. But `q.drawnBox` comes from the `drawnBoxes` dep. Its default,
  `inkBoxes` (packages/core/src/canvas/inkBoxes.ts:20-26), measures with `view.scale` and `boundsIncludeStroke`, so a
  screen-constant stroke's ink box changes with zoom. Take siblings with a 10 px screen-constant stroke. Place a guide
  off a ruler at zoom 1; guide ops don't touch the scene, so the version stays put and `exclude` is `[]`. Zoom to 0.1
  and place another. Alignment (pointer probes) still offers lines from boxes padded by 5 world units instead of 50,
  and its marks run to stale extents. A cancelled move followed by a zoom and a second move of the same node does the
  same, and so does a wheel zoom in the middle of a drag. Spacing offers and gap values are stale in the same way, and
  so is any toggle of `boundsIncludeStroke` between gestures. The key should also cover what the boxes are measured
  through: the view scale and the `drawnBox` function, or the cache should be per session.
- evidence: read
- severity: medium

## Two spacing-hints presets given ids still both add a `distanceReadout` contribution, so the canvas throws
- where: packages/guides/src/spacingHints/preset.ts:51 (createSpacingHintsPreset)
- scenario: The `id` option says "Given, its snap sources are `<id>.spacing` and `<id>.alignment`, so two presets can
  share a canvas". But the readout contribution is built from `{ ...opts.readout, ...color }`, which never uses the
  preset's id. So two presets `createSpacingHintsPreset({ id: 'a' })` and `createSpacingHintsPreset({ id: 'b' })`
  both contribute `id: 'distanceReadout'`, both with action `distanceReadout.measure`. `mergeContributions` throws on
  a duplicate entry id (packages/core/src/canvas/surfaceContribution.ts:88-93). Even where nothing throws, two readouts
  would answer for one hover. The fix is to name the readout `<id>.readout` (or similar) when `opts.id` is given and
  `opts.readout.id` is not.
- evidence: read
- severity: medium

## The Alt-hover distance readout measures pose boxes while the spacing snap it accompanies measures ink boxes
- where: packages/guides/src/spacingHints/distanceReadout.ts:98-101 (createDistanceReadoutContribution's run)
- scenario: The readout measures `from`/`to` with `worldUnionOf`/`worldBoundsOf`
  (`visualBoundsViaDescriptor` of the world pose: no stroke, and no `drawnBoxes` dep). The preset's
  `spacingSnapSource` measures `q.drawnBox`, with the stroke included by default. Take two rects with 4-unit strokes.
  A move snaps the second so the ink gap equals a reference gap the spacing marks label `20`. Alt-hover from one to
  the other then reads `24`, the pose-box gap. One preset gives two answers for the same distance. The readout should
  measure through the canvas's `drawnBoxes` dep (with `boundsIncludeStroke`), as snapping does.
- evidence: read
- severity: medium

## A guide with a `span` is hit along the whole canvas, though it is drawn only over its span
- where: packages/guides/src/rulers/hit.ts:31-40 (guideAt)
- scenario: `Guide.span` is "the stretch of the line worth drawing", and `createGuidesLayer` draws a spanned guide only
  across it. `guideAt` tests only the distance across the line (`s.x - on.x` for an `'x'` guide) and never checks the
  cross-axis position against `span`. A `GuideStore` holding `{ axis: 'x', offset: 100, span: { min: 0, max: 50 } }`
  therefore claims, exclusively, every press within 4 px of x = 100 anywhere down the canvas, including at y = 900, far
  below where the line ends. That press then moves a guide the user can't see under the pointer, instead of reaching
  the tool or the shape there. The check should skip a guide whose span (carried to screen) misses `s` on the cross
  axis.
- evidence: read
- severity: low

## Files read
packages/guides/src/index.ts
packages/guides/src/pbt.fixture.ts
packages/guides/src/rulers/actions.ts
packages/guides/src/rulers/createRulers.ts
packages/guides/src/rulers/hit.ts
packages/guides/src/rulers/index.ts
packages/guides/src/rulers/layout.ts
packages/guides/src/rulers/reading.ts
packages/guides/src/rulers/settings.ts
packages/guides/src/rulers/ticks.ts
packages/guides/src/sources/alignment.ts
packages/guides/src/sources/grid.ts
packages/guides/src/sources/guides.ts
packages/guides/src/sources/index.ts
packages/guides/src/sources/lines.ts
packages/guides/src/sources/spacing.ts
packages/guides/src/sources/targets.ts
packages/guides/src/sources/testing/session.ts
packages/guides/src/spacingHints/distance.ts
packages/guides/src/spacingHints/distanceReadout.ts
packages/guides/src/spacingHints/index.ts
packages/guides/src/spacingHints/preset.ts
packages/guides/src/strategies/onPlane.ts

<!-- done: 4 findings, files read: 23 -->
