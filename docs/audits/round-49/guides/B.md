# Audit round 49 — area `guides`

Reviewed at HEAD `d057251407` (the brief's frozen commit `2f3b11aab7` is not in this clone; `packages/guides` has no working-tree changes).

## cachedPerScene keeps target boxes measured at an old zoom, so alignment and spacing snap to stale ink boxes after a zoom
- where: packages/guides/src/sources/targets.ts:39 (cachedPerScene)
- scenario: The cache key is scene, scene version and the excluded ids. `q.drawnBox` comes from the host's `drawnBoxes` dep, and `<SceneCanvas>`'s (`packages/core/src/canvas/inkBoxes.ts:20-26`) measures ink at `view.scale`, so a hairline or non-scaling stroke's box changes with zoom. Steps: move node A, zoom to 8×, then move A again with the scene unchanged. The key matches, so `alignmentSnapSource` and `spacingSnapSource` reuse lines and gaps measured at the old zoom, while the subject's own `q.box` is measured at the new one. Edges then miss their snap lines by the stroke-extent difference, and equal-gap offers show the wrong sizes. The same staleness happens when `boundsIncludeStroke` flips, and when a later session has a different `plane`. The key should also cover the measuring function or the view scale, or the cache should be held per session.
- evidence: read
- severity: medium

## The Alt-hover distance readout measures pose boxes while spacing snap measures stroke-included ink boxes, so one gap gets two values
- where: packages/guides/src/spacingHints/distanceReadout.ts:98-101 (createDistanceReadoutContribution run)
- scenario: The readout measures `from` and `to` with `worldUnionOf` / `worldBoundsOf`, which is `visualBoundsViaDescriptor`, the pose box with no ink. `spacingSnapSource`, shipped in the same `createSpacingHintsPreset`, measures with `q.drawnBox`, the box "stroke included" that the canvas's `drawnBoxes` dep sources. Take two rects with a 4px stroke, 20 world units apart as poses. A move snaps them to an equal gap, and its `gap` mark is labeled with the ink-to-ink distance, 16. Holding Alt over the neighbor then reads the same gap as 20. The question "how far apart are these shapes" is answered by two definitions in one preset. The readout should measure through the `drawnBoxes` dep, as snap does.
- evidence: read
- severity: medium

## Two spacing-hint presets on one canvas collide on the distance readout, though the `id` option promises they can share it
- where: packages/guides/src/spacingHints/preset.ts:51 (createSpacingHintsPreset)
- scenario: The `id` doc says that when an id is given, the snap sources become `<id>.spacing` and `<id>.alignment` "so two presets can share a canvas". The readout contribution is built from `opts.readout` and `color` only, so both presets install a contribution with id `distanceReadout`. Each has an action `distanceReadout.measure` and bindings `distanceReadout.show` / `.hide` / `.leave`. Example: `createSpacingHintsPreset({ id: 'a' })` and `createSpacingHintsPreset({ id: 'b', readout: { modifier: 'shift' } })`. The contribution, action and binding ids are duplicated, and `dynamicActionId('distanceReadout.measure')` resolves both presets' bindings to one action. Holding Alt then also matches the Shift preset's `hide` binding, because Shift is not held, so the two presets drive one readout with opposite `show` params. The preset should give the readout `` `${opts.id}.readout` `` when an id is given, as it does for the sources.
- evidence: read
- severity: low

## The rulers' hit layer picks a spanned guide anywhere along its infinite line, though the guides layer draws it as a segment
- where: packages/guides/src/rulers/hit.ts:31-40 (guideAt)
- scenario: `Guide.span` limits a guide's drawn extent, and `createGuidesLayer` defaults to `extent: 'span'`. `guideAt` tests only the distance across the line. Take a guide `{ axis: 'x', offset: 100, span: { min: 0, max: 50 } }` in the `GuideStore` the rulers read. A press at world (101, 400), on empty canvas 350 units past the segment's end, returns it. The layer claims the press as `exclusive` with a `col-resize` cursor, so the active tool never sees it and the drag moves an invisible stretch of guide. `guideAt` should skip a press whose along-line coordinate is outside `span`.
- evidence: read
- severity: low

## Detaching the rulers leaves view, pointer and draft in their state, so layout() keeps describing a canvas that is gone
- where: packages/guides/src/rulers/createRulers.ts:119-126 (contribution.attach teardown)
- scenario: The teardown only nulls `api`. `state.view`, `width`/`height`, `pointer` and `draft` stay as they were, and no change is emitted. When the canvas unmounts while the rulers chrome stays mounted (or the instance is re-attached to a new canvas), `layout()` still returns ticks for the old view and size, and the pointer marker stays where it was, until the next canvas paints. If teardown runs mid-drag, the draft guide also stays in `state.draft`, and `settled()` keeps hiding that guide from the guides layer. Teardown should reset to the initial state through `set(...)`, which notifies subscribers.
- evidence: read
- severity: low

## The test helper moveBy throws when given a scene without ids
- where: packages/guides/src/sources/testing/session.ts:76-81 (moveBy)
- scenario: When `opts.scene` is passed, `own` is `null`. `ids: opts.ids ?? own!.ids` then dereferences `null` whenever the caller passes a scene but no `ids`, and fails with a TypeError rather than running a move with no subject. Its doc only says the default subject applies "with no `scene`". The helper should fall back to `undefined` ids, or say ids are required alongside a scene.
- evidence: read
- severity: low

## The rulers' and distance readout's `leave` bindings set no `mods`, so leaving the canvas with a key held never clears them; the readout's own Alt is such a key
- where: packages/guides/src/spacingHints/distanceReadout.ts:112 (bindings); packages/guides/src/rulers/createRulers.ts:103 (bindings)
- scenario: `matchSpec`'s `hover` case (`packages/gestures/src/ui/match.ts:273-280`) applies `matchModifiers` before the leave test, and a spec with no `mods` matches only an unmodified input. The readout shows only while Alt is held. When the user holds Alt over a shape and moves the pointer off the canvas, the leave event carries `alt: true`, so `distanceReadout.leave` does not match. `.show` and `.hide` do not match an off-surface event either. Nothing runs, and the distance marks stay drawn over the canvas until the pointer comes back. In the rulers, leaving with Shift, Alt or Cmd held skips `rulers.leave`, so `pointer` and the frame stay where the pointer left, and the ruler marker stays drawn off a pointer that is gone. The hover bindings beside them already use `ANY_MODS` (loupe's leave binding does too, at `packages/loupe/src/actions.ts:88`), and both leave specs need it.
- evidence: read
- severity: medium

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

<!-- done: 7 findings, files read: 23 -->
