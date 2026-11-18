<!-- done: 7 findings, files read: 28 -->

I couldn't write `.skulk/out/findings.md` because permission was denied, so here is the whole document:

# Audit round 36 — apps.ui-lab findings

## A spline base in quadrant mode is drawn with a different end radius than the editor shows
- where: apps/ui-lab/src/badge/compose/splineAnchors.ts:33 (readAnchors), also withAnchorCount at :43
- scenario: In quadrant mode the base forces the last anchor's `r` and `w` to equal anchor 0's (packages/ui/src/components/Badge/bases/OctantSpline.tsx:81, extractAnchorPairs). The lab copies an end only when that end is edited (`withAnchor`). Two cases go wrong. Switch `octant-spline` from the default octant mode to `quadrant`: the editor's last dot and its curve end at r4 = 46, but the badge ends at r0 = 48. Or raise the anchor count from 5 to 6: the new last slot reads r5 = 42 from the defaults, while the badge draws 48. In both cases the editor's dots and curve no longer match the rendered badge until someone drags an end anchor.
- evidence: read
- severity: medium

## The cloud shape's `padding` and `roundness` sliders do nothing, and its `erosion` param has no control
- where: apps/ui-lab/src/badge/shapeParams.ts:66 (SHAPE_PARAMS.cloud)
- scenario: On the Shapes page, select `cloud` and drag `padding` or `roundness`: the badge does not change. `Cloud` (packages/ui/src/components/Badge/shapes/Cloud.tsx) reads only `bumpWidth`, `puffiness`, `erosion` and `irregularity`. `erosion`, which the shape does read (default 0.2), has no row, so it can't be tuned. "Copy changed params" also reports `padding`/`roundness` as new defaults, for fields the shape doesn't have.
- evidence: read
- severity: medium

## The ribbon shape's lab default `taperWidth` is 12, but the shape draws with 8
- where: apps/ui-lab/src/badge/shapeParams.ts:40 (SHAPE_PARAMS.ribbon)
- scenario: `SHAPE_PARAMS` says it holds "the defaults the shape draws with", but `Ribbon`'s DEFAULTS has `taperWidth: 8` (shapes/Ribbon.tsx:14). The gallery passes every value through `badgeParams`, so an untouched ribbon renders at 12, not the way `<Badge shape="ribbon">` renders. "Copy changed params" therefore stays silent about a 12 that really differs from the shape, and reports `taperWidth: 8`, the shape's true default, as a change.
- evidence: read
- severity: medium

## "Copy JSX" leaves out the padding, so the snippet doesn't reproduce the badge on the stage
- where: apps/ui-lab/src/badge/compose/snippet.ts:13 (composeSnippet)
- scenario: The stage always passes `padding={composedPadding(config.padding)}` (ComposeInstrument.tsx:45), so even the defaults give `1px 6px 1px 6px`. `composeSnippet` takes only `shape` and `look` and never writes `padding`. A pasted snippet falls back to Badge's own CSS padding and comes out a different size from the stage, for every config, including the defaults. Separately, `look.label` is written raw between the tags, so a label containing `{` or `<` produces invalid JSX.
- evidence: read
- severity: medium

## Spikes' `cornerCompensation` has no control, so a new spikes effect can't change it and the "sun" preset's value is hidden
- where: apps/ui-lab/src/badge/effectParams.ts:7 (EFFECT_PARAMS.spikes)
- scenario: `Spikes` reads `cornerCompensation` (default 1; effects/Spikes.tsx:19,30), and the "sun" preset sets it to 0. `EFFECT_PARAMS.spikes` has no row for it. An effect added from "Add effect…" therefore can't change it, a loaded "sun" card shows no control for its distinctive 0, and switching the card's type away and back silently resets it to 1 (`setEffectType` → `effectDefaults`). The same gap exists in SHAPE_PARAMS.plaque, which has no row for the shape's `sheenIntensity` (shapes/Plaque.tsx:17).
- evidence: read
- severity: low

## The spline editor's hit radius is smaller than the dots it draws
- where: apps/ui-lab/src/badge/compose/splineActions.ts:17 (HIT_RADIUS), drawn at OctantSplineEditor.tsx:101
- scenario: A dot is drawn with radius `1.5 + w * 0.7` plus a 0.35 half-stroke, which comes to about 3.95 at w = 3. `anchorAt` only takes presses within 3. On any dot weighted above about 2.1, a press on its visible outer ring starts no drag. An Alt-click there inserts a new anchor instead of hitting the dot. Scrolling there passes through instead of changing the weight.
- evidence: read
- severity: low

## Slider edits inside the effects and spline rows ignore the leaf's drafts
- where: apps/ui-lab/src/badge/compose/EffectsRow.tsx:45 (EffectBody: no `draftConfig`), SplineRow.tsx:43 (Anchors `onInput` → `write`)
- scenario: Both leaves are handed `ctx.drafts`, and the anchor drag in the same SplineRow uses it, but these paths don't. Dragging an effect card's slider or the Anchors slider sends every move through `setValue`. A drag with pauses longer than labkit's 500 ms coalescing gap becomes several undo steps, where the panel's other sliders and the anchor drag beside them settle as one step from first draft to release (the unruled.md 2026-11-12 entry). The SplineRow also passes `disabled` to the Anchors slider but not to `OctantSplineEditor`, so the curve can still be edited while its row is disabled.
- evidence: read
- severity: low

## Files read
apps/ui-lab/src/App.tsx
apps/ui-lab/src/app.css
apps/ui-lab/src/badge/baseParams.ts
apps/ui-lab/src/badge/compose/Compose.module.css
apps/ui-lab/src/badge/compose/ComposeInstrument.tsx
apps/ui-lab/src/badge/compose/EffectsRow.tsx
apps/ui-lab/src/badge/compose/OctantSplineEditor.module.css
apps/ui-lab/src/badge/compose/OctantSplineEditor.tsx
apps/ui-lab/src/badge/compose/PresetsPanel.tsx
apps/ui-lab/src/badge/compose/SplineRow.tsx
apps/ui-lab/src/badge/compose/composeConfig.ts
apps/ui-lab/src/badge/compose/presets.ts
apps/ui-lab/src/badge/compose/snippet.ts
apps/ui-lab/src/badge/compose/splineActions.ts
apps/ui-lab/src/badge/compose/splineAnchors.ts
apps/ui-lab/src/badge/compose/splineGeometry.ts
apps/ui-lab/src/badge/effectParams.ts
apps/ui-lab/src/badge/effects.ts
apps/ui-lab/src/badge/octants/Octants.module.css
apps/ui-lab/src/badge/octants/OctantsInstrument.tsx
apps/ui-lab/src/badge/params.ts
apps/ui-lab/src/badge/shapeParams.ts
apps/ui-lab/src/badge/shapes/Shapes.module.css
apps/ui-lab/src/badge/shapes/ShapesInstrument.tsx
apps/ui-lab/src/badge/shapes/shapesConfig.ts
apps/ui-lab/src/labTestSetup.ts
apps/ui-lab/src/main.tsx
apps/ui-lab/vite.config.ts

<!-- done: 7 findings, files read: 28 -->