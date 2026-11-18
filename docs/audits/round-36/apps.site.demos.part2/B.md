# Findings: apps.site.demos.part2

## FontFallbackDemo drops registerCanvasFont's release handle and tears Georgia out with unregisterCanvasFont, removing every other holder
- where: apps/site/demos/FontFallbackDemo.tsx:66-74 (FontFallbackDemo effect)
- scenario: `registerCanvasFont` returns a per-call release that unregisters only when the last holder lets go (packages/font/src/dynamic/dynamicAtlas.ts:112); `unregisterCanvasFont` "removes a canvas family, whoever holds it" (:190). The demo discards the release and, when `enrolledHere`, calls `unregisterCanvasFont`. If anything else registers Georgia while the demo is mounted (another demo on the same page, the app), unmounting this demo deletes that holder's family and its glyphs. Conversely, when Georgia was auto-enrolled and the policy in force is `'canvas'`, `isCanvasFont` is true so `enrolledHere` is false, but `registerCanvasFont` still promotes the family to explicit "for good" and nothing undoes it on unmount — process-wide state left behind by teardown, which the comment says the effect exists to prevent. Should be `const release = registerCanvasFont(CANVAS_FAMILY); return () => { …; release(); }`.
- evidence: read
- severity: medium

## GeomDemo draws each dot from `n.data`, the item as created, so a dragged dot stays where it started while the curve follows it
- where: apps/site/demos/GeomDemo.tsx:151-157 (scene layer `drawOne`)
- scenario: `useScene({ items })` sets both `pose` and `data` to the item (packages/core/src/core/scene/trivialScene.ts:44-50); a move writes a new pose (and previews through pose overrides) but never touches `data`. `drawOne` ignores its pose argument and draws the circle at `d.x + R, d.y + R`, and `buildSceneLayer` calls `drawOne(obj, pose, …)` without translating its output. Drag `p1` (or the probe): `centersOf` reads `worldPoses`, so the hull, curve, nearest point and table all move with the drag and after the commit, while the dot itself is drawn at its initial spot — the handle the user grabbed is no longer under the curve's control point. Should draw from the pose: `circlePath(p.x + R, p.y + R, R - 1)` with `drawOne: (n, p) => …`.
- evidence: read
- severity: high

## GeomDemo's split-length row shows NaN% when the four curve points coincide
- where: apps/site/demos/GeomDemo.tsx:191 (GeomDemo table)
- scenario: drag p0–p3 onto one spot (all four are draggable): `m.length` is 0, and `(100 * m.beforeLength) / m.length` is 0/0, so the readout prints `NaN%` (`qty` of NaN). Should guard a zero length (show 0% or a dash).
- evidence: read
- severity: low

## LayeredCurveDemo's partition handle claims a full-height band at the seam, so the two seam anchors can never be dragged and the C0 sync never runs from the seam
- where: apps/site/demos/LayeredCurveDemo.tsx:47-50 (createPartitionLayer `hitTest`), :166 (layer order)
- scenario: the layer dispatcher tries layers top-first (packages/ui/src/components/CurveEditor/layerDispatch.ts:42, "Topmost-claimed wins", layerTypes.ts:88), and the `CustomLayer` partition is the last child, so it is tried first. Its `hitTest` returns a hit for any point within 12 px of x = b at any height, not just the 10×28 handle it draws at mid-height. The bevel's last anchor and the spline's first anchor both sit exactly at x = b (and `endpoints="pinned-x"` leaves them free in y), so a press on either always grabs the partition instead: the seam's height cannot be edited, `onBevelChange`/`onSplineChange`'s C0 mirroring (the demo's stated point) is unreachable from the seam, and click-curve insertion within 12 px of the seam is swallowed too. Should hit-test only the drawn handle rect (or order the partition below the function layers).
- evidence: read
- severity: medium

## HistoryDemo's stack sections use `s.stack`, a class its stylesheet does not define
- where: apps/site/demos/HistoryDemo.tsx:90 (Stack)
- scenario: `HistoryDemo.module.css` defines `.stacks` and `.stackTitle` but no `.stack`, so `className={s.stack}` is `undefined` and each history/session column renders with no class — whatever per-stack layout was intended never applies.
- evidence: read
- severity: low

## Files read
apps/site/demos/DitherDemo.tsx
apps/site/demos/DrapeLabDemo.tsx
apps/site/demos/EasingsDemo.module.css
apps/site/demos/EasingsDemo.tsx
apps/site/demos/EditingSessionsDemo.module.css
apps/site/demos/EditingSessionsDemo.tsx
apps/site/demos/EffectChartDemo.tsx
apps/site/demos/EffectsDemo.tsx
apps/site/demos/FairingLabDemo.module.css
apps/site/demos/FairingLabDemo.tsx
apps/site/demos/FilletLabDemo.module.css
apps/site/demos/FilletLabDemo.tsx
apps/site/demos/FilletPanel.tsx
apps/site/demos/FontFallbackDemo.module.css
apps/site/demos/FontFallbackDemo.tsx
apps/site/demos/ForceGraphDemo.module.css
apps/site/demos/ForceGraphDemo.tsx
apps/site/demos/GeomDemo.module.css
apps/site/demos/GeomDemo.tsx
apps/site/demos/GestureGrammarDemo.tsx
apps/site/demos/GesturesDemo.tsx
apps/site/demos/HandleLockLabDemo.module.css
apps/site/demos/HandleLockLabDemo.tsx
apps/site/demos/HandleSnapLabDemo.tsx
apps/site/demos/HistoryDemo.tsx
apps/site/demos/HudContextMenuDemo.tsx
apps/site/demos/HudDemo.tsx
apps/site/demos/HudGalleryDemo.tsx
apps/site/demos/ImageDemo.tsx
apps/site/demos/IngestionDemo.tsx
apps/site/demos/InsertDemo.tsx
apps/site/demos/Kernel3dDemo.module.css
apps/site/demos/Kernel3dDemo.tsx
apps/site/demos/KeymapDemo.module.css
apps/site/demos/KeymapDemo.tsx
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

<!-- done: 5 findings, files read: 46 -->
