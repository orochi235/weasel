The findings file couldn't be written because the write was denied, so the whole document is below.

# Findings: apps.site.demos.part1

## DiagramLayoutDemo throws away the routes a layout run reports
- where: apps/site/demos/DiagramLayoutDemo.tsx:51 (DiagramLayoutDemo, `onMove`)
- scenario: press `layered` or `tree`. The four edges are `router: 'orthogonal'`, and the run reports each rewritten route and its ports as `onMove`'s second argument. The demo stores only the moves (`moved(ns, moves)`), so the `specs` rebuilt from the new `nodes` carry no `routed`/`routedPorts`. The edges lose the layout's routes and ports and get routed again from scratch. `DiagramViewProps.onMove` (packages/diagram/src/diagramViewProps.ts:109-114) says to store each route or "the next `diagramScene` lays them out again". DiagramClustersDemo and DiagramElkDemo do store them, through `routed(es, routes)` from `./diagram/shared`, so this one demo answers the same question differently and shows the wrong pattern.
- evidence: read
- severity: medium

## AudioDemo keeps a stolen looping source voice as "playing"
- where: apps/site/demos/AudioDemo.tsx:167 (toggleSource), :143 (onTick)
- scenario: press "play source", which loops `bed` on `music` (voiceLimit 8 per bus). Then start the pattern and press the music `trigger` a few times. The pool steals the oldest voice, which is the long-lived loop. `sourceVoice.current` still holds the dead handle, so the button keeps saying "stop source", dragging the dot calls `setPosition` on a handle that ignores it, and the first click only flips the label back. Nothing checks `sourceVoice.current.isPlaying()` (VoiceHandle, packages/audio/src/types.ts:65) to clear it.
- evidence: read
- severity: low

## CustomShaderDemo registers the weasel-mark texture once per mount that starts before the image loads
- where: apps/site/demos/CustomShaderDemo.tsx:37-49 (useWeaselMarkTexture)
- scenario: the effect checks `cachedImageTexture` only when it starts, and has no cleanup. StrictMode's double effect run, or two mounts before the first `onload`, creates two `Image`s. Both call `registerTexture`, so the module-level registry (packages/renderer/src/textures/registerTexture.ts:104) keeps a second entry, and its image, that nothing ever unregisters. An unmount before the load still runs `setTex` on the gone component.
- evidence: read
- severity: low

## BidiDemo throws on long input by spreading every code point into one call
- where: apps/site/demos/BidiDemo.tsx:84 (BidiDemo)
- scenario: paste a long text, about 100k+ characters, into the Text input. `String.fromCodePoint(...painted.map(...))` passes every code point as an argument and goes past the engine's argument limit. It throws `RangeError` during render and takes down the demo. It should build the string in chunks, or with `map(String.fromCodePoint).join('')`.
- evidence: read
- severity: low

## CompoundPathsDemo's honk button does not follow the goose during a drag
- where: apps/site/demos/CompoundPathsDemo.tsx:142-147 (honkBounds), :252 (HonkButton)
- scenario: drag the goose. A drag shows through pose overrides, which bump no scene version (AudioDemo.tsx:151 relies on this and subscribes to `scene.overrides`). `honkBounds` reads the committed `g.pose`, not `effectivePose`, and nothing re-renders on override changes. The "honk" button stays above where the goose started and jumps only on release.
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
apps/site/demos/DiagramClustersDemo.tsx
apps/site/demos/DiagramDataDemo.tsx
apps/site/demos/DiagramDrawOnDemo.tsx
apps/site/demos/DiagramDropDemo.module.css
apps/site/demos/DiagramDropDemo.tsx
apps/site/demos/DiagramEdgesDemo.tsx
apps/site/demos/DiagramElkDemo.tsx
apps/site/demos/DiagramLayoutDemo.tsx
apps/site/demos/DiagramLiveDemo.tsx
apps/site/demos/DiagramNodesDemo.tsx
apps/site/demos/DiagramOverlaysDemo.tsx
apps/site/demos/DiagramReorderDemo.tsx
apps/site/demos/DitherDemo.module.css

<!-- done: 5 findings, files read: 49 -->