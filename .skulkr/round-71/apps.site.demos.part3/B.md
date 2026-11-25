# Audit round 71 — apps.site.demos.part3

## LevelOfDetailDemo's hint says "Scroll to zoom out", but a plain wheel pans
- where: apps/site/demos/LevelOfDetailDemo.tsx:55 (LevelOfDetailDemo)
- scenario: the canvas runs `presets.view` with no `viewport.zoom.wheel` set; `viewport.zoom` binds the wheel only with `mods: { mod: true }` unless `wheel: 'plain'` (packages/core/src/interactions/actions/defaults/viewportZoom.ts:65-68), and a bare wheel goes to `viewport.wheelPan`. A reader following the hint scrolls and the diagram pans instead of zooming out, so the level-of-detail collapse the demo exists to show never appears; it needs Cmd/Ctrl+wheel or a pinch (or the canvas should set `viewport={{ zoom: { wheel: 'plain' }, pan: false }}`).
- evidence: read
- severity: medium

## ParallaxDemo's zoom control scales about the world origin, so zooming in sinks the landscape off the bottom
- where: apps/site/demos/ParallaxDemo.tsx:151 (zoomTo)
- scenario: `zoomTo` writes `{ ...view, scale: { x: z, y: z } }`, keeping `view.x/y`, so the fixed point is the view's top-left. With `viewport.pan.axis: 'x'` the user cannot pan vertically to recover: at the control's max of 3× the ground (world y 320–400) maps to screen y ≥ 960 on a 400px stage and the trees and hills are gone. The control should zoom about the stage center (or route through the kit's viewport zoom), as wheel/pinch zoom does about the pointer.
- evidence: read
- severity: low

## LayoutDemo adds a tile below G, not at "G's bottom-right corner" as its comment says
- where: apps/site/demos/LayoutDemo.tsx:54-55 (addTile)
- scenario: G is 180×180 (apps/site/demos/data/layout.scene.json:18). The new tile's pose in G's frame is `{ x: 75, y: 185, width: 30, height: 30 }`, which spans y 185–215, entirely below G and horizontally centered-ish, not in its bottom-right corner (that is x 150, y 150). With "animate reflow" on, the tileGrid reflow glides the new tile up from outside the container rather than from its corner as intended.
- evidence: read
- severity: low

## MenuDemo's menu never closes on an outside click or blur, and the only opener stays disabled
- where: apps/site/demos/MenuDemo.tsx:33-44 (Panels), :109 (MenuDemo)
- scenario: open the menu, then click anywhere else on the page. `Panels` installs no dismissal (the package ships `dismiss.ts` for exactly this), so the panel stays open with focus gone from it; keys no longer reach `controller.key`, and the "Open menu" button is `disabled` while a controller exists. A pointer user's only way out is to choose an item. Also, on close nothing returns focus to the opener, so keyboard focus drops to `<body>`.
- evidence: read
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
