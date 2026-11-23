# Audit round 75 — apps.ui-lab

## The spline editor's "cardinal (s = 0)" ray label runs past the view box and is clipped
- where: apps/ui-lab/src/badge/compose/OctantSplineEditor.tsx:83 (Grid)
- scenario: the label is placed at x = 76 at font size 3; 16 characters at ~0.55em is ~26 units, so it spans x 76…~102, but both view boxes (`-8 -80 90 90`, `-8 -82 90 92`) end at x = 82 and the root `<svg>` clips overflow. The user sees "cardi…" cut off at the right edge in both modes. It should sit inside the box, e.g. anchored `end` or placed below the ray.
- evidence: read
- severity: low

## The Compose "Badge JSX" textarea keeps showing the snippet from the last Copy after the badge changes
- where: apps/ui-lab/src/badge/compose/PresetsPanel.tsx:16-31 (PresetsPanel)
- scenario: press Copy JSX, then load a preset or edit any param. The textarea labeled "Badge JSX" and the "Copied to the clipboard." status both stay up, still showing the old badge's JSX, because `snippet` is set only in `copy`. Someone who reads or copies the textarea gets JSX for a badge that is no longer on the stage. The snippet should be derived from `config` while it is shown, or cleared when `config` changes. The Shapes gallery's "Changed params" textarea (ShapesInstrument.tsx:49-60) has the same staleness.
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
