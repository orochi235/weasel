# Audit round 75 — apps.ui-lab

## Scrolling over a spline anchor writes one undo step, and one fixed ±0.1 weight change, per wheel event
- where: apps/ui-lab/src/badge/compose/splineActions.ts:146 (splineEditorActions, `weigh.run`); apps/ui-lab/src/badge/compose/splineGeometry.ts:98 (wheelWeight)
- scenario: a trackpad scroll over a dot delivers dozens of wheel events, each with a small `deltaY`. Each one calls `now.commit(...)`, which reaches `SplineRow`'s `write`, the settled `setValue`, so each event becomes its own undo step. `wheelWeight` also ignores how big `deltaY` is and steps a full 0.1 per event, so one short flick takes the weight from 1 to the 0 or 3 clamp, and undoing it takes one Undo per event. A burst of edits to one control should be one step (the lab's undo rule), and the change should follow how far the wheel actually turned. Expected: draft each event through `draft` and commit once when the burst ends (or coalesce consecutive wheel commits on one anchor), with the step scaled by `deltaY` or quantized to notches.
- evidence: read
- severity: medium

## The JSX snippet textarea keeps showing the old snippet after the badge changes
- where: apps/ui-lab/src/badge/compose/PresetsPanel.tsx:16 (PresetsPanel, `snippet` state); same pattern in apps/ui-lab/src/badge/shapes/ShapesInstrument.tsx:49 (Gallery)
- scenario: press "Copy JSX", then load a preset or move any slider. The textarea still holds the text built at the press, next to a badge that no longer matches it, and "Copied to the clipboard." stays up too. Someone who copies from the textarea, which is what it is there for, gets JSX for the wrong badge. Expected: rebuild the shown text from the current `config` (`composeSnippet(config)` / `shapeParamsSnippet(params)`) on every render, or clear it when the config changes.
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

<!-- done: 2 findings, files read: 28 -->
