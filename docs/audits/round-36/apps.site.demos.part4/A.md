I couldn't write `.skulk/out/findings.md` because the write permission was declined, so the full findings document is below. I read all 49 listed files and edited nothing.

# Findings: apps.site.demos.part4

## StrokeTrimLab's palette offers a Select tool that its canvas never registers
- where: apps/site/demos/StrokeTrimLabDemo.tsx:150 (TrimTrial), with the tool listed at :169 (trimInstrument)
- scenario: the instrument lists `{ id: 'select' }` in the lab's tool palette, but the canvas gets only `features={[viewPreset]}` and `defaultTools={['hand']}`. The `select` tool comes from `pick`/`selectPreset` (see `toolProps.ts`), and `viewPreset` brings only `hand` (`VIEW_TOOLS`). When the user clicks "Select", labkit's `pushTool` (`useSceneToolSlot.ts:77`) returns early because `!Object.hasOwn(target.registry, 'select')`. The palette then shows Select as active while the canvas stays on the hand tool, so nothing can be selected. It should either add a pick/select preset or drop the entry.
- evidence: read
- severity: medium

## QuantityDemo's BandEditor drops Escape-cancel, so a canceled drag stays shown as the value
- where: apps/site/demos/QuantityDemo.tsx:139-151 (QuantityDemo)
- scenario: the demo passes `onInput={setLive}` and `value={live ?? bands}` but no `onCancel`. Drag a seam, which calls `onInput` and sets `live` to the draft, then press Escape. BandEditor clears its draft and calls `onCancel` (`useBandDraft.ts:79`), which isn't wired here, so `live` keeps the canceled bands. The editor and the JSON readout both show the canceled seam position as if it were committed, and the next edit builds on it, because `value` is BandEditor's `committed`. It should pass `onCancel={() => setLive(null)}`.
- evidence: read
- severity: medium

## RigDemo's "track u" readout keeps its last value after the track stops
- where: apps/site/demos/RigDemo.tsx:215-219 (track effect)
- scenario: press "play track", then stop it mid-cycle (u ≈ 0.6). `trackRig.pose(POSE_A)` puts the figure back at pose A, but `trackBlend.current` is never reset. The onTick readout keeps showing `track u 0.60` while the figure sits at u = 0.
- evidence: read
- severity: low

## SvgDemo serializes the old scene under the wrong viewBox while the source fails to parse
- where: apps/site/demos/SvgDemo.tsx:124 (export effect)
- scenario: load or type an SVG with `viewBox="0 0 800 600"`, then make an edit that makes `parseSvg` throw. `imported` becomes `{ error }`, so the load effect leaves the previous nodes in the scene. The export effect re-runs on the new `imported` and falls back to `VIEW` (0 0 420 320). The output then shows the unchanged scene cropped to a different viewBox. It should keep the last good parse's viewBox, or skip the export.
- evidence: read
- severity: low

## RegistryDemo's registry is module-level, so its entries outlive the demo's unmount
- where: apps/site/demos/RegistryDemo.tsx:22 (`cursors`)
- scenario: push a few cursors, navigate to another demo, then come back. `createReflectable` runs once at module scope and nothing clears it on unmount. The table reopens with the old entries and a version count that isn't 0, and every mounted copy of the demo shares one registry.
- evidence: read
- severity: low

## Files read
apps/site/demos/QuantityDemo.tsx
apps/site/demos/ReachLabDemo.tsx
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
apps/site/demos/SceneDemo.tsx
apps/site/demos/SceneLabDemo.tsx
apps/site/demos/SceneScrollerDemo.module.css
apps/site/demos/SceneScrollerDemo.tsx
apps/site/demos/ScopedGridDemo.tsx
apps/site/demos/ScoreDemo.module.css
apps/site/demos/ScoreDemo.tsx
apps/site/demos/ScrollingGridDemo.tsx
apps/site/demos/SegmentTypeLabDemo.tsx
apps/site/demos/SelectDemo.module.css
apps/site/demos/SelectDemo.tsx
apps/site/demos/SelectionPanelDemo.tsx
apps/site/demos/SequenceDiagramDemo.tsx
apps/site/demos/ShapeBuilderLabDemo.tsx
apps/site/demos/ShapeToolsDemo.tsx
apps/site/demos/SharedBrushSizeDemo.tsx
apps/site/demos/SkinDemo.tsx
apps/site/demos/SliceDemo.tsx
apps/site/demos/SlideNavigationDemo.tsx
apps/site/demos/SmallCapsDemo.tsx
apps/site/demos/SnipLabDemo.tsx
apps/site/demos/SpacingHintsLabDemo.tsx
apps/site/demos/SpiroLabDemo.tsx
apps/site/demos/StickyNotesDemo.tsx
apps/site/demos/StrokeAndFillDemo.tsx
apps/site/demos/StrokeMarkersDemo.tsx
apps/site/demos/StrokeTrimLabDemo.module.css
apps/site/demos/StrokeTrimLabDemo.tsx
apps/site/demos/StrokeWidthLabDemo.tsx
apps/site/demos/SvgDemo.module.css
apps/site/demos/SvgDemo.tsx

<!-- done: 5 findings, files read: 49 -->