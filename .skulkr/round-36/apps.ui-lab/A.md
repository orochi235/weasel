I couldn't write `.skulk/out/findings.md` because permission was denied, so the full document is below.

## Effect cards' sliders write one undo step per move: EffectBody's ControlPanel has no draftConfig
- where: apps/ui-lab/src/badge/compose/EffectsRow.tsx:45 (EffectBody)
- scenario: open a card in the Compose lab (whose instrument sets `undo: {}`) and drag its `count` slider from 44 to 80. `ControlPanel` without `draftConfig` makes "a slider write as it moves" (packages/labkit/src/controls/ControlPanel.tsx:40-46), so every move calls `setConfig`, then `onChange`, then the row's `ctx.setValue`, and each of those is a committed edit. One drag leaves dozens of undo steps. It should draft through `ctx.drafts.setValue` and commit once on release, which is what SplineRow does for anchor drags. `effectsRenderer` never passes `ctx.drafts` down to `EffectsEditor` at all.
- evidence: read
- severity: medium

## SplineRow's Anchors slider commits on every input tick instead of drafting
- where: apps/ui-lab/src/badge/compose/SplineRow.tsx:39 (SplineRow)
- scenario: drag the Anchors slider from 5 to 12. `onInput` calls `write`, which is `setValue`, a commit, for each intermediate count, so the drag pushes about 7 undo steps. The same row's anchor drag goes through `draft` (`drafts?.setValue`) so its release settles one step (comment at line 24). One row answers the live-edit question two ways. `onInput` should use `draft`.
- evidence: read
- severity: low

## Shapes lab params drift from the shapes' real defaults and params, so the gallery and "Copy changed params" are wrong
- where: apps/ui-lab/src/badge/shapeParams.ts:34-38, 64-70, 81-86 (SHAPE_PARAMS)
- scenario: SHAPE_PARAMS says it is "at the defaults the shape draws with", but:
  - **ribbon** `taperWidth` defaults to 12 here and to 8 in `packages/ui/src/components/Badge/shapes/Ribbon.tsx:14`. The gallery draws ribbon at 12, unlike a bare `<Badge shape="ribbon">`. Setting it to the real default of 8 makes `shapeParamsSnippet` report `ribbon: { taperWidth: 8 }` as a change.
  - **cloud** offers `padding` and `roundness`, which `BadgeCloudShapeParams` doesn't have (`shapes/Cloud.tsx:4-10`), so those sliders do nothing. Its real `erosion` (default 0.2) has no control at all.
  - **plaque** is missing `sheenIntensity` (`shapes/Plaque.tsx:17`), so that param can't be edited.
- evidence: read
- severity: medium

## Copy JSX leaves out padding, so the snippet doesn't reproduce the stage's badge
- where: apps/ui-lab/src/badge/compose/snippet.ts:13-31 (composeSnippet)
- scenario: the Preview always passes `padding={composedPadding(config.padding)}` (ComposeInstrument.tsx:45), which defaults to `1px 6px 1px 6px` and can be edited in the Padding section. `composeSnippet` never writes `padding`. Set top to 10, press Copy JSX, paste it: the badge comes out at Badge's own CSS padding, not the one on the stage. The doc says it "reproduces the lab's badge".
- evidence: read
- severity: medium

## Compose's effect params omit params the effects take, despite "every param on the panel"
- where: apps/ui-lab/src/badge/effectParams.ts:7-15, 69-80, 81-114 (EFFECT_PARAMS)
- scenario: spikes has no `cornerCompensation` (Badge effects/Spikes.tsx:30). The 'sun' preset sets it to 0 and the panel can't show it or change it back. sunbeams has no `color` (Sunbeams.tsx:40), and aqua and metal have no `accent` (Aqua.tsx:46, Metal.tsx:38). So the ComposeInstrument doc's "every param on the panel" doesn't hold, and those looks can't be composed in the lab.
- evidence: read
- severity: low

## Copy JSX writes the label unescaped, so a label with `{`, `}` or `<` gives invalid JSX
- where: apps/ui-lab/src/badge/compose/snippet.ts:30 (composeSnippet)
- scenario: set the Label to `a{b}` or `<NEW>`. The snippet ends `>a{b}</Badge>`, which evaluates `b`, or `><NEW></Badge>`, a parse error. The label should be written as `{${JSON.stringify(label)}}` when it holds a JSX-special character.
- evidence: read
- severity: low

## A horizontal wheel over a spline anchor increases its weight
- where: apps/ui-lab/src/badge/compose/splineGeometry.ts:93-95 (wheelWeight), splineActions.ts:143
- scenario: a trackpad sideways swipe, or shift-wheel on some platforms, over an anchor dot gives `deltaY === 0`. `wheelWeight` treats any `deltaY` that isn't positive as "scroll up" and adds 0.1, so a horizontal scroll raises the weight once per event. A zero `deltaY` should leave the weight alone.
- evidence: read
- severity: low

## Files read
apps/ui-lab/src/App.tsx
apps/ui-lab/src/badge/baseParams.ts
apps/ui-lab/src/badge/compose/ComposeInstrument.tsx
apps/ui-lab/src/badge/compose/EffectsRow.tsx
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
apps/ui-lab/src/badge/octants/OctantsInstrument.tsx
apps/ui-lab/src/badge/params.ts
apps/ui-lab/src/badge/shapeParams.ts
apps/ui-lab/src/badge/shapes/ShapesInstrument.tsx
apps/ui-lab/src/badge/shapes/shapesConfig.ts
apps/ui-lab/src/labTestSetup.ts
apps/ui-lab/src/main.tsx
apps/ui-lab/vite.config.ts

<!-- done: 7 findings, files read: 23 -->