# Audit round 70 — apps.site.demos.part3

## PTouchLabelDemo hides the Download button's result and errors wherever printing is unavailable
- where: apps/site/demos/PTouchLabelDemo.tsx:101 (PTouchLabelDemo)
- scenario: In a browser with neither WebUSB nor Web Serial (Firefox, Safari), `CAN_PRINT` is false. Clicking "Download .lbx" still runs `report(download)`, which sets `status` to "wrote …" or to the error string. But the status span renders `CAN_PRINT ? status : 'printing needs WebUSB or Web Serial'`, so neither the success line nor a `sceneToLbx` failure ever shows. The comment at line 74 says both buttons report to the status line. The fixed hint should sit beside `status`, not replace it.
- evidence: read
- severity: low

## MermaidKindsDemo leaves a failed parse as an unhandled rejection and keeps showing the previous diagram
- where: apps/site/demos/MermaidKindsDemo.tsx:28 (MermaidKindsDemo effect)
- scenario: If `DIAGRAM_MERMAID.read` throws or rejects for a sample (for example, a sample `.mmd` edited into a form the reader doesn't accept), the `.then` chain has no rejection handler. The result is an unhandled promise rejection, and `specs` still holds the previously selected kind, so the stage shows the wrong diagram under the new segment. It should catch the error and clear or flag `specs`.
- evidence: read
- severity: low

## MenuDemo's menu items sit in a plain `<ul>`, so they are not owned by the `role="menu"` container, and the highlight is never exposed
- where: apps/site/demos/MenuDemo.tsx:28-46 (Panels)
- scenario: `role="menu"` is on the outer `div`, but each level is an unannotated `<ul>`, whose implicit role is `list`. The `role="menuitem"` / `role="separator"` `<li>`s are therefore children of a list rather than of a menu or group. Assistive tech reports items outside a menu, and every level after the first is not a submenu at all. Focus stays on the container with no `aria-activedescendant`, and the rows have no ids, so the controller's highlight (`index === highlight`) is visible only as a CSS class: a screen-reader user pressing the arrow keys hears nothing. Each `<ul>` needs `role="menu"` (or `none`/`group`), and the container needs `aria-activedescendant` pointing at the highlighted row. The demo presents itself as the reference for drawing a `MenuController` by hand.
- evidence: read
- severity: low

## MeasureLabDemo keeps one `Measurements` store across trial scenes, so a measurement picked in one trial stays picked in the next
- where: apps/site/demos/MeasureLabDemo.tsx:65 (MeasureTrial)
- scenario: `measurements` is created once with `useState`, but `scene` comes from `useTrialScene(ctx, createLabScene)` and is rebuilt for a new or reset trial. `picked`, `draft` and `measuring` are per-scene state (`currentMeasureId` resolves `picked` against whichever scene it is given). Every lab scene seeds the same ids (`rise`, `offset`). So after a user picks `rise` and starts a fresh trial, `picked` still holds `rise`, which exists in the new scene, and Move by / Rotate by act on it. The comment at line 49 says that with nothing picked the commands use the offset. The store should be keyed to `scene` (`useMemo(() => createMeasurements(...), [scene])`). The scene-replacement half rests on the name and role of `useTrialScene`; I did not trace labkit's reset path.
- evidence: read (store contents in packages/measure/src/measurements.ts); scene rebuild per trial inferred
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
