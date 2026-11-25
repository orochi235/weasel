I couldn't save `.skulk/out/findings.md` because the write permission was declined, so the full findings document is below.

## ParallaxDemo's intro undoes a per-plane-zoom toggle made while it plays
- where: apps/site/demos/ParallaxDemo.tsx:147 (playIntro)
- scenario: click "play intro", then within its 1.4 s tick "per-plane zoom". The checkbox's `apply(true, 0)` sets each plane's zoom to its depth, but the tween's `onTick` closed over `zoomParallax === false` at click time and calls `apply(false, x)` on every remaining frame. Zoom parallax goes back off on every plane and the intro ends that way, while the checkbox still shows it on. Unticking mid-intro does the reverse. `onTick` should read the current setting (a ref or `useLatest`), or the toggle should cancel the intro.
- evidence: read
- severity: medium

## PTouchLabelDemo's Download swallows a failure that Print reports
- where: apps/site/demos/PTouchLabelDemo.tsx:73 (download)
- scenario: `sceneToLbx` or `downloadBlob` rejects (a node the LBX writer can't encode, a font that won't load). `download` has no try/catch and is called as `void download()`, so the rejection goes unhandled and the status line keeps its old text. `print` answers the same failure by catching it and showing `String(err)`. The two buttons handle the same kind of error in two different ways.
- evidence: read
- severity: low

## PathMotionDemo keeps the last ride's tilt after "turn with the path" is unticked
- where: apps/site/demos/PathMotionDemo.tsx:39 (ride)
- scenario: ride once with "turn with the path" ticked. The rider ends turned to the track's final tangent, about −90°, since the last segment rises to (430, 60). Untick it and ride again. With `orient: false`, `pathMotion.at` keeps `getRotation(pose)` and the tween goes from that rotation to that rotation, so the rider travels the whole track standing on end instead of level. The rider's rotation is never set back to 0 when `orient` is off.
- evidence: read
- severity: low

## Files read
apps/site/demos/Lines3dDemo.module.css
apps/site/demos/Lines3dDemo.tsx
apps/site/demos/LoupeDemo.module.css
apps/site/demos/LoupeDemo.tsx
apps/site/demos/LoupeModelDemo.module.css
apps/site/demos/LoupeModelDemo.tsx
apps/site/demos/MeasureLabDemo.module.css
apps/site/demos/MeasureLabDemo.tsx
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
apps/site/demos/PanZoomDemo.tsx
apps/site/demos/ParallaxDemo.tsx
apps/site/demos/PathAnchorEditDemo.tsx
apps/site/demos/PathConstraintsLabDemo.module.css
apps/site/demos/PathConstraintsLabDemo.tsx
apps/site/demos/PathDirectionLabDemo.tsx
apps/site/demos/PathMotionDemo.tsx
apps/site/demos/PathPoseDemo.tsx
apps/site/demos/PathSnapLabDemo.tsx
apps/site/demos/PerAxisZoomDemo.module.css
apps/site/demos/PerAxisZoomDemo.tsx
apps/site/demos/PerceptualColorSlidersDemo.module.css
apps/site/demos/PerceptualColorSlidersDemo.tsx
apps/site/demos/PinWarpLabDemo.tsx
apps/site/demos/PinWarpSolverLabDemo.tsx
apps/site/demos/PlaneWarpLabDemo.tsx
apps/site/demos/PlotKindsDemo.tsx
apps/site/demos/PlotXyChartDemo.tsx
apps/site/demos/PoiseLabDemo.tsx
apps/site/demos/PoseBlendDemo.tsx
apps/site/demos/PrefConditionDiagramDemo.module.css
apps/site/demos/PrefConditionDiagramDemo.tsx
apps/site/demos/PrefsDemo.module.css
apps/site/demos/PrefsDemo.tsx
apps/site/demos/PresentationDemo.css
apps/site/demos/PresentationDemo.tsx
apps/site/demos/QuadtreeDemo.tsx
apps/site/demos/QuantityDemo.module.css

<!-- done: 3 findings, files read: 49 -->