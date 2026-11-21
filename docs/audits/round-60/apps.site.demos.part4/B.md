# Audit round 60 — apps.site.demos.part4

## Tightening the bounds mode can invert the ordered L range
- where: apps/site/demos/PerceptualColorSlidersDemo.tsx:212-219 (changeBoundsMode)
- scenario: the clamp raises only the dark thumb, to `l.dark[0]`, and lowers only the light thumb, to `l.light[1]`, each on its own. In `unconstrained`, drag both L thumbs below 0.15 (say [0.05, 0.10]) and pick `conservative`: `lRange` becomes [0.15, 0.10], dark above light, on a slider declared `constraint="ordered"`. Picking `default` from [0.98, 0.99] gives [0.98, 0.97] the same way. With `lo > hi`, `lAtIndex` runs the ramp backward (index 0 is the darkest swatch), `chromaAt` returns `cBot` or `cTop` for nearly every L because both of its range tests fire, and the diagram draws B to the right of T. The clamp should keep `lRange[0] <= lRange[1]`, for example by clamping each thumb into its bounds and then moving the other one so they don't cross.
- evidence: read (packages/paint/src/chromaCurve.ts:21-27 for the degenerate curve)
- severity: low

## A failed PDF write still offers the previous PDF for download
- where: apps/site/demos/PdfDemo.tsx:40-53 (write)
- scenario: write once (the link offers `shapes.pdf`), move a shape, and write again when `exportRegionsPdf` rejects. The `catch` puts the error in `notes`, but `file` keeps the earlier blob, so the alert and the download link appear together and the link serves a PDF of the scene as it was before the edit, as if it were this write's result. The fix is `setFile(null)` at the start of `write` or in the `catch`.
- evidence: read
- severity: low

## Files read
apps/site/demos/PdfDemo.module.css
apps/site/demos/PdfDemo.tsx
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
apps/site/demos/PrefsEditorDemo.module.css
apps/site/demos/PrefsEditorDemo.tsx
apps/site/demos/PrefsSchemaDemo.module.css
apps/site/demos/PrefsSchemaDemo.tsx
apps/site/demos/PresentationDemo.css
apps/site/demos/PresentationDemo.tsx
apps/site/demos/QuadtreeDemo.tsx
apps/site/demos/QuantityDemo.module.css
apps/site/demos/QuantityDemo.tsx
apps/site/demos/ReachLabDemo.tsx
apps/site/demos/ReactDemo.module.css
apps/site/demos/ReactDemo.tsx
apps/site/demos/RectPathEditLabDemo.module.css
apps/site/demos/RectPathEditLabDemo.tsx
apps/site/demos/RegistryDemo.module.css
apps/site/demos/RegistryDemo.tsx
apps/site/demos/RenderToPixelsDemo.tsx
apps/site/demos/RepeatAlongLabDemo.tsx
apps/site/demos/ResampleLabDemo.tsx
apps/site/demos/ResizeSnapDemo.tsx
apps/site/demos/RigDemo.tsx
apps/site/demos/RigToolsDemo.tsx
apps/site/demos/RotatedResizeMathDemo.css
apps/site/demos/RotatedResizeMathDemo.tsx
apps/site/demos/RoutingDemo.module.css
apps/site/demos/RoutingDemo.tsx
apps/site/demos/RulersDemo.tsx
apps/site/demos/SandLabDemo.tsx
apps/site/demos/ScaleDemo.module.css
apps/site/demos/ScaleDemo.tsx
apps/site/demos/SceneDemo.tsx

<!-- done: 2 findings, files read: 48 -->
