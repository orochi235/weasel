I couldn't write `.skulkr/out/findings.md`: the first write created it, but the second one was refused permission. As the brief allows, the whole document is below.

# Audit round 60 — apps.site.demos.part4

## The indices slider re-sorts its thumbs mid-drag, so the held thumb's styling and focus jump to the neighbor it passes
- where: apps/site/demos/PerceptualColorSlidersDemo.tsx:288 (PerceptualColorSlidersDemo, "Indices band" Slider `onInput`)
- scenario: The slider is `free` (it has no `constraint`), and `onInput` sorts the values before storing them. During a drag, the Slider writes into its own buffer at the index that was pressed (`useThumbDrags.beginThumbDrag`, `buffer[index] = …`) and marks that index as held (`setDragged(index)`). Drag the `500` thumb right past `600`: the buffer becomes `[…, 610, 600, …]` and the parent stores `[…, 600, 610, …]`. The slider then draws the thumb at that index as held, with keyboard focus on it, but that thumb now carries the value 600, which the user isn't touching. The thumb under the pointer is drawn as idle. Fix: keep the slider's reported order while a drag is in flight (sort in `onChange`, or use `constraint="ordered"`), or don't sort.
- evidence: read (packages/ui/src/components/Slider/useThumbDrags.ts:60-76, and the demo's `onInput`)
- severity: low

## A failed PDF write leaves the previous file's download link up beside the error
- where: apps/site/demos/PdfDemo.tsx:40-53 (PdfDemo, `write`)
- scenario: Write a PDF and the download link appears. Move a shape, press "Write PDF" again, and have `exportRegionsPdf` reject (for example a strict or incomplete export, or a load failure that throws). The `catch` adds the message to `notes` but never clears `file`. So "Download shapes.pdf" still offers the earlier file, which no longer matches the canvas, right next to the alert saying the write failed. Fix: call `setFile(null)` when the write fails, or at the start of each write.
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