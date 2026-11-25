# Audit round 70 — apps.site.demos.part3

## LevelOfDetailDemo stores its cards in world coordinates under a rigid group frame, so every container but the first draws its cards at twice its offset
- where: apps/site/demos/LevelOfDetailDemo.tsx:23-30 (diagram)
- scenario: `useScene` builds through `createScene`, whose default composition is `RIGID_POSE_COMPOSITION` (packages/core/src/core/scene/scene.ts:205), and `initial` poses are stored as given — local to the parent (only pre-v3 snapshots get `localizeWorldPoses`, serialization.ts:156-157). Every node defines a frame unless it is an envelope (`definesFrame`, effectivePose.ts:370), and these groups have no `derivePose`. The title, card and label poses are written as `x + 10`, `cx = x + 10 + …`, i.e. world positions, under a group posed at `(x, y)`. So group `g0-1` at x=220 draws its title at world x≈450, group `g2-3` at (660, 440) draws its cards near (1330, 890): the cards leave their containers and pile up off to the lower right, and the "zoom out until a container collapses to its box" story the hint describes no longer matches what is drawn. Child poses should be `{ x: 10, y: 8, … }` relative to the group (as LayoutDemo's children are). The demo's only test checks a `<canvas>` mounts.
- evidence: read
- severity: medium

## ParallaxDemo's tree parts are posed in world coordinates under their group, so since rigid composition became the default the trees draw at twice their position, off the bottom of the stage
- where: apps/site/demos/ParallaxDemo.tsx:90-99 (tree)
- scenario: `tree('t1', 60, 340, 25, 50)` makes group `t1` at (60, 340) and its foliage at pose `{ x: 60, y: 340 }` and trunk at `{ x: 60 + …, y: 340 + 37.5 }` with `parent: 't1'`. The scene uses `useScene`'s default `RIGID_POSE_COMPOSITION` (made the default in b337d8d866, 2026-10-26, after this helper was written in 88c1ae30bd on 2026-09-28 under identity composition), which composes a child as `parent.x + child.x` (`composeRigidPose`, composePose.ts:108). So t1's foliage lands at world (120, 680), t5's near (1160, 696): with H = 400 every tree is below the visible stage, and the "trees" plane the demo exists to show (pan 1.3, the nearest plane) is empty. Children should be posed relative to the group (`{ x: 0, y: 0 }` for foliage, `{ x: (w - tw) / 2, y: fh }` for the trunk).
- evidence: read (composition default and compose math read; not rendered)
- severity: high

## MermaidKindsDemo lets a parse failure escape: a synchronous throw from `read` crashes the effect, an async rejection is unhandled and leaves the previous kind's diagram shown
- where: apps/site/demos/MermaidKindsDemo.tsx:26-32 (MermaidKindsDemo effect)
- scenario: `Promise.resolve(DIAGRAM_MERMAID.read!(SAMPLES[kind]))` evaluates `read` synchronously, so if it throws on a sample (or after a parser change) the throw escapes the effect and unmounts the demo tree; if `read` returns a rejecting promise there is no `.catch`, so the rejection is unhandled and `specs` keeps the previously selected kind's diagram while the segmented bar shows the new kind. Should catch and show the failure (or clear `specs`).
- evidence: read (inference on failure mode; no sample observed failing)
- severity: low

## PTouchLabelDemo's preview effect drops a `renderLabel` rejection unhandled, while its buttons route the same call's failures to the status line
- where: apps/site/demos/PTouchLabelDemo.tsx:62-72 (preview effect)
- scenario: `void renderLabel({ scene, … }).then(img => …)` has no rejection handler. An edit that makes the label unrenderable (e.g. a node `renderLabel` refuses, a font that fails to load) rejects on every scene version: each one is an unhandled rejection in the console and the preview silently keeps the last good image, whereas `print` (line 87) calls the same `renderLabel` through `report`, which shows the error. One failure answered two ways; the effect should pass the rejection to `setStatus` too.
- evidence: read (inference on failure mode)
- severity: low

## Files read
apps/site/demos/KeymapDemo.module.css
apps/site/demos/KeymapDemo.tsx
apps/site/demos/KitSettingsDemo.module.css
apps/site/demos/KitSettingsDemo.tsx
apps/site/demos/KneadLabDemo.tsx
apps/site/demos/LabLoupeDemo.tsx
apps/site/demos/LassoDemo.module.css
apps/site/demos/LassoDemo.tsx
apps/site/demos/LayerListDemo.module.css
apps/site/demos/LayerListDemo.tsx
apps/site/demos/LayeredCurveDemo.module.css
apps/site/demos/LayeredCurveDemo.tsx
apps/site/demos/LayoutDemo.module.css
apps/site/demos/LayoutDemo.tsx
apps/site/demos/LevelOfDetailDemo.tsx
apps/site/demos/Lines3dDemo.module.css
apps/site/demos/Lines3dDemo.tsx
apps/site/demos/LoupeDemo.module.css
apps/site/demos/LoupeDemo.tsx
apps/site/demos/LoupeModelDemo.module.css
apps/site/demos/LoupeModelDemo.tsx
apps/site/demos/MeasureLabDemo.module.css
apps/site/demos/MeasureLabDemo.tsx
apps/site/demos/MenuDemo.module.css
apps/site/demos/MenuDemo.tsx
apps/site/demos/MermaidKindsDemo.tsx
apps/site/demos/MinimapDemo.module.css
apps/site/demos/MinimapDemo.tsx
apps/site/demos/ModesDemo.module.css
apps/site/demos/ModesDemo.tsx
apps/site/demos/MoveSnapDemo.tsx
apps/site/demos/MultiSelectDemo.tsx
apps/site/demos/PTouchLabelDemo.module.css
apps/site/demos/PTouchLabelDemo.tsx
apps/site/demos/PageGridDemo.module.css
apps/site/demos/PageGridDemo.tsx
apps/site/demos/PaintDemo.module.css
apps/site/demos/PaintDemo.tsx
apps/site/demos/PaintKindsDemo.module.css
apps/site/demos/PaintKindsDemo.tsx
apps/site/demos/PanZoomDemo.tsx
apps/site/demos/ParallaxDemo.tsx
apps/site/demos/PathAnchorEditDemo.tsx
apps/site/demos/PathConstraintsLabDemo.module.css
apps/site/demos/PathConstraintsLabDemo.tsx
apps/site/demos/PathDirectionLabDemo.tsx
apps/site/demos/PathMotionDemo.tsx
apps/site/demos/PathPoseDemo.tsx

<!-- done: 4 findings, files read: 48 -->
