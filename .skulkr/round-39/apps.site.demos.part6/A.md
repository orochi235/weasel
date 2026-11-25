I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole document is below.

## TiledSurfaceDemo sizes the shared surface for one devicePixelRatio, but the panes' renderers read the ratio on every paint
- where: apps/site/demos/TiledSurfaceDemo.tsx:131 (TiledSurfaceDemo, the useLayoutEffect sizing `c.width/c.height`)
- scenario: open the demo at dpr 1, then zoom the browser (Cmd +) or drag the window to a 2× display. `devicePixelRatio` changes, and the canvas renderer reads it on every paint (`packages/core/src/canvas/canvasRenderer.ts:45`), so each pane now paints its `paintInto` rect at the new density. The effect has `[]` deps and never runs again, so the backing buffer stays 820 × 400 device px. Pane B (x = 420 CSS px, which is 840 device px at 2×) then starts past the right edge of the buffer and is clipped away. Pane A is drawn at twice its size into the top-left quarter. The comment says the buffer is "the host's to size", so the host should resize it whenever dpr changes.
- evidence: read
- severity: medium

## UiInputDemo checks for a single character with `e.key.length !== 1`, where ui-input uses `isOneChar`
- where: apps/site/demos/UiInputDemo.tsx:35 (UiInputDemo onKeyDown)
- scenario: type a character outside the BMP (an emoji, or a CJK Extension B character from an IME) into the focused listbox. `e.key` is then a surrogate pair with `length` 2, so the demo drops the key before it reaches `typeaheadStep`. The package decides "one typed character" with `isOneChar` (`typeaheadMatch`, `rowKey`), which accepts that key. The two answer the same question differently, and a demo meant to show how to drive the package uses the wrong test.
- evidence: read
- severity: low

## TimelineFramesDemo still downloads the frame being encoded after Cancel
- where: apps/site/demos/TimelineFramesDemo.tsx:72 (save, the `for await` body)
- scenario: click "save frames", then "cancel" while a frame is in `await rasterToPng(frame.image)` or in the 120 ms gap before it. Neither await is followed by a check of `ac.signal.aborted`, so `downloadBlob` still saves that frame, one more PNG after the user canceled. Only the generator's next pull sees the abort.
- evidence: read
- severity: low

## Files read
apps/site/demos/ThemeDemo.tsx
apps/site/demos/TiledSurfaceDemo.tsx
apps/site/demos/TimelineDemo.tsx
apps/site/demos/TimelineFramesDemo.tsx
apps/site/demos/ToolReflectionDemo.module.css
apps/site/demos/ToolReflectionDemo.tsx
apps/site/demos/TransformDemo.tsx
apps/site/demos/TrialClockDemo.module.css
apps/site/demos/TrialClockDemo.tsx
apps/site/demos/TugLabDemo.tsx
apps/site/demos/TweenLabDemo.tsx
apps/site/demos/UiInputDemo.module.css
apps/site/demos/UiInputDemo.tsx
apps/site/demos/UiLogicDemo.module.css
apps/site/demos/UiLogicDemo.tsx
apps/site/demos/VertexColorAnimationDemo.tsx
apps/site/demos/ViewportDemo.tsx
apps/site/demos/WhiteboardDemo.tsx
apps/site/demos/animation/AnimatorWatch.tsx
apps/site/demos/animation/FlickSnapPanel.tsx
apps/site/demos/curveLab/ReadoutHud.tsx
apps/site/demos/curveLab/RepresentationPanel.tsx
apps/site/demos/curveLab/curveScene.ts
apps/site/demos/curveLab/overlays.ts
apps/site/demos/curveLab/presets.ts
apps/site/demos/customShaderPrograms.ts
apps/site/demos/diagram/shared.ts
apps/site/demos/ditherDemoExport.ts
apps/site/demos/ditherDemoScene.ts
apps/site/demos/effectChartPictures.ts
apps/site/demos/forceGraph/graph.ts
apps/site/demos/forceGraph/overrides.ts
apps/site/demos/pathEditLabScene.ts
apps/site/demos/pathEffectLab.module.css
apps/site/demos/pathEffectLab.tsx
apps/site/demos/pathLab/pathLab.module.css
apps/site/demos/pathLab/pathLab.tsx
apps/site/demos/pinWarpSolverLab/PinWarpSolverLab.module.css
apps/site/demos/pinWarpSolverLab/SolverPanel.tsx
apps/site/demos/pinWarpSolverLab/meshLayer.ts
apps/site/demos/pinWarpSolverLab/meshModel.ts
apps/site/demos/pinWarpSolverLab/presets.ts
apps/site/demos/pinWarpSolverLab/solverTrace.ts
apps/site/demos/rotatedResize/math.ts
apps/site/demos/rotatedResize/panels.tsx
apps/site/demos/score/scoreRoll.ts
apps/site/demos/warpLab.tsx

<!-- done: 3 findings, files read: 47 -->