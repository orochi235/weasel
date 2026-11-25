## AnimationDemo's per-card effects map is never pruned when cards leave the scene
- where: apps/site/demos/AnimationDemo.tsx:55 (AnimationCards, `effects`), 145-164 (addBatch), 107-110 (removeSelected)
- scenario: every "Add 5" seeds five new ids (`n1`, `n2`, … never reused) into `effects.current`, and `getEffect` adds one for every breathed/staggered id; "Remove selected" removes the nodes but never deletes their entries, so pressing Add 5 / Remove repeatedly grows the map without bound for the life of the demo. Entries should be dropped when the node is removed (or the map keyed off live scene ids).
- evidence: read
- severity: low

## CustomShaderDemo's shared texture load never settles if the image fails, disabling Ripple for every later mount
- where: apps/site/demos/CustomShaderDemo.tsx:41-51 (loadWeaselMark)
- scenario: `img.onerror` is not handled, so a failed load (404, offline, decode error) leaves `markLoad` as a promise that never resolves or rejects. Because it is module-scoped and memoized with `??=`, every subsequent mount of the demo awaits the same dead promise: the Ripple panel stays `disabled` (draws nothing) forever with no error and no retry. It should reject (and clear `markLoad`) on error.
- evidence: read
- severity: low

## AnnotationCaptureDemo's last capture blob URL outlives the demo, and a failed capture throws away the previous good one
- where: apps/site/demos/AnnotationCaptureDemo.tsx:23-29 (`latest`, publish), 64-69 (CapturePanel run)
- scenario: `latest` is module scope and only revoked when the next capture replaces it, so after the demo unmounts (navigating to another demo) the last PNG/SVG object URL — at scale 4, a sizeable blob — stays alive for the page's lifetime. Separately, a `capture()` rejection calls `publish(null)`, revoking and hiding the prior successful capture, so one failed export erases a good result the user was looking at. Revoke on unmount; on failure leave `latest` alone (or show the error).
- evidence: read
- severity: low

## AudioDemo's voice readout shows the total across buses against a per-bus cap
- where: apps/site/demos/AudioDemo.tsx:148 (onTick, `kit.engine.activeVoices()`), 275 (readout)
- scenario: `voiceLimit: 8` builds one pool of 8 per bus (`createAudioEngine.ts:121`), and `activeVoices()` with no argument counts every bus. With the looping source and the pattern on `music` while "fire 50 one-shots" fills `sfx`, the readout reads e.g. `activeVoices 13 / 8 per bus`. That looks like the cap failing, which is the opposite of what the hint says the burst shows ("the pool steals rather than piling up"). The fix is to show it per bus, `activeVoices('sfx')` / `activeVoices('music')`, or to label the total against 16.
- evidence: read
- severity: low

## AutoControlsDemo draws past its own width when cols and gap are pinned high at a narrow width
- where: apps/site/demos/AutoControlsDemo.tsx:79-85 (grid layer draw)
- scenario: width 240, cols pinned to 16, gap pinned to 48 → `cell = (240 - 15·48)/16 = -30`; the bars are drawn at `i·(cell+gap) = i·18` with width `max(cell,1)`, so they span 0…271 and spill out of the 240-wide gray panel while the gaps shown are 17 px, not the 48 px set. The resolver clamps only the auto values; pinned values combine into an impossible layout that the draw does not clamp (e.g. clamp gap to `(width - cols)/(cols-1)`).
- evidence: read
- severity: low

## Files read
apps/site/demos/AddExtremesLabDemo.tsx
apps/site/demos/AlignDemo.tsx
apps/site/demos/AlignmentGuidesDemo.tsx
apps/site/demos/AnchorFieldsLabDemo.tsx
apps/site/demos/AnchorSelectLabDemo.tsx
apps/site/demos/AnimationDemo.module.css
apps/site/demos/AnimationDemo.tsx
apps/site/demos/AnimatorDemo.module.css
apps/site/demos/AnimatorDemo.tsx
apps/site/demos/AnnotationCaptureDemo.tsx
apps/site/demos/AudioDemo.tsx
apps/site/demos/AutoControlsDemo.tsx
apps/site/demos/BendAlongLabDemo.tsx
apps/site/demos/BidiDemo.module.css
apps/site/demos/BidiDemo.tsx
apps/site/demos/BooleanOpsDemo.tsx
apps/site/demos/BridgeLabDemo.tsx
apps/site/demos/CanvasViewDemo.module.css
apps/site/demos/CanvasViewDemo.tsx
apps/site/demos/ClipDemo.module.css
apps/site/demos/ClipDemo.tsx
apps/site/demos/ClockDemo.module.css
apps/site/demos/ClockDemo.tsx
apps/site/demos/ClothWarpLabDemo.tsx
apps/site/demos/ColorMatrixDemo.module.css
apps/site/demos/ColorMatrixDemo.tsx
apps/site/demos/CompoundPathsDemo.module.css
apps/site/demos/CompoundPathsDemo.tsx
apps/site/demos/ContextMenuDemo.tsx
apps/site/demos/CursorDemo.module.css
apps/site/demos/CursorDemo.tsx
apps/site/demos/CurvatureCombLabDemo.tsx
apps/site/demos/CurveLabDemo.tsx
apps/site/demos/CustomShaderDemo.module.css
apps/site/demos/CustomShaderDemo.tsx
apps/site/demos/D3SortableDemo.tsx
apps/site/demos/DebugOverlayDemo.tsx
apps/site/demos/DemoStage.tsx
apps/site/demos/DevtoolsDemo.module.css
apps/site/demos/DevtoolsDemo.tsx
apps/site/demos/DiagramClustersDemo.tsx
apps/site/demos/DiagramDataDemo.tsx
apps/site/demos/DiagramDrawOnDemo.tsx
apps/site/demos/DiagramDropDemo.module.css
apps/site/demos/DiagramDropDemo.tsx
apps/site/demos/DiagramEdgesDemo.tsx
apps/site/demos/DiagramElkDemo.tsx
apps/site/demos/DiagramLayoutDemo.tsx

<!-- done: 5 findings, files read: 48 -->
