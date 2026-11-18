# Audit round 35 — apps.site.demos.part1

## CompoundPathsDemo's honk button stays put while the goose is dragged, then jumps on release
- where: apps/site/demos/CompoundPathsDemo.tsx:142 (honkBounds / HonkButton)
- scenario: drag the goose. A move gesture shows the node through pose overrides, which bump no scene version (AudioDemo.tsx:151 says so and subscribes to `scene.overrides` for this reason). `honkBounds` reads `g.pose` (the committed pose), and the component re-renders only on `useScene`'s version subscription. So the "honk" button, which is meant to sit over the goose's head, stays at the old spot for the whole drag and only jumps when the drag commits. It should follow the drag: subscribe to `scene.overrides` and read `effectivePose`, as AudioDemo does.
- evidence: read
- severity: low

## D3SortableDemo's "index" order sorts ids as strings, so bar-10 and bar-11 land third and fourth
- where: apps/site/demos/D3SortableDemo.tsx:44 (sortItems, case 'index')
- scenario: the demo opens on `sortKey = 'index'`, and picking "index" later is meant to restore the bars' original order. `a.id.localeCompare(b.id)` compares `bar-0 … bar-11` as plain strings, giving bar-0, bar-1, bar-10, bar-11, bar-2 … bar-9. The first paint and every return to "index" therefore show the two tallest bars in slots 3–4 rather than at the right end. "index" also differs from "asc", although for this data (value = i + 1) the two should look the same. It should keep INITIAL's array order (or compare the numeric suffix, or use `localeCompare(…, { numeric: true })`).
- evidence: read
- severity: medium

## DiagramDropDemo keeps notes out of the row on a palette drop, yet lets a dropped note be dragged into it
- where: apps/site/demos/DiagramDropDemo.tsx:53 (canReparent), with :62 (canDropItem) and :75/:79 (onMove)
- scenario: drag "note" from the palette to empty canvas. It lands as loose node `note-N`. Drag that node into the Row container. `canReparent` ignores its `ids` and refuses only the shelf, so the move is allowed: `onMove` reports `parent: 'row'`, `into('note-N')` is true, and the note is appended to `row` and drawn as a step. Yet `canDropItem` refuses that same placement ("Notes stay out of the row"), so the demo gives two answers to "may a note be in the row?". `canReparent` should refuse `into === 'row'` when any of `ids` is a note (an id starting `note-`), as `canDropItem` does.
- evidence: read
- severity: low

## DiagramLayoutDemo drops the routes a layout run reports, so the next rebuild undoes them
- where: apps/site/demos/DiagramLayoutDemo.tsx:51 (onMove)
- scenario: press "layered" or "tree". The run writes waypoints to the four `router: 'orthogonal'` edges (`layoutWritesRoute` holds for any non-`avoid` edge with no waypoints of its own, routeWrites.ts:64) and reports them to `onMove` as `routes` once it settles. The handler keeps only `moves` (`setNodes(moved(ns, moves))`). That state change rebuilds `specs` from `EDGES`, which carries no `routed`/`routedPorts`, and `DiagramViewProps.onMove`'s contract says such a rebuild "lays them out again". The routes the layout just eased to are thrown away: edges snap back to plain router output right after settling, and again after any drag. DiagramClustersDemo and DiagramElkDemo keep `routes` through `routed(es, routes)` in edge state; this demo should do the same.
- evidence: read
- severity: low

## ClipDemo's load check uses a binder that accepts every event name, so a clip the real binder rejects throws inside the effect
- where: apps/site/demos/ClipDemo.tsx:63 (load), with :49–51 (the effect's bindClip)
- scenario: in the textarea, rename the event `"name": "log"` to `"name": "note"`, then press "load the JSON". `load` validates with `event: () => ({})`, which resolves every name, so the check passes, `setError('')` runs and `setClip(next)` is called. The effect then calls `bindClip` with the real binder, which returns `undefined` for any name other than `log`, and `bindClip` throws "the binder has no event named "note"" (clip.ts:103) from inside `useEffect`. The demo unmounts to an error boundary instead of showing the message in its `error` span. The check should bind with the same binder the effect uses: one shared `binder` constant, or move the `try` around the effect's bind.
- evidence: read
- severity: medium

## AudioDemo keeps a stolen source voice as "playing": the button reads "stop source" over silence
- where: apps/site/demos/AudioDemo.tsx:175 (toggleSource), with :160 (setPosition effect)
- scenario: press "play source" (the looping bed on `music`) and start the pattern (also `music`), then press the music bus's "trigger" six or seven times within ~0.9 s (each a 900 ms bell). The `music` pool is past `voiceLimit: 8`, and the default `'oldest'` steal policy (voicePool.ts:52) takes the bed. `sourceVoice.current` still holds the dead handle and `sourcePlaying` stays true. The button keeps saying "stop source", a drag's `setPosition` goes to a voice that no longer sounds, and the next press only "stops" it, so a second press is needed to hear the source again. The demo should clear `sourceVoice`/`sourcePlaying` when the voice ends (an `onDrop`/`onDone` on `play`, or `isPlaying()` checked in the tick), or play the bed on a bus the one-shots cannot exhaust.
- evidence: read
- severity: low

## AnimationDemo's momentum bounds allow for a 60-px card, so a flung 80-px card ends 20 px past the right edge
- where: apps/site/demos/AnimationDemo.tsx:76 (selectToolOpts, momentum bounds)
- scenario: `momentum`'s `bounds` clamp only the top-left corner ("Object size is ignored … shrink the rect by the object's width and height", momentum.ts:23–26). The demo shrinks it by 60 on both axes, but cards a, b and c are 80 wide. Flick card A hard to the right and it comes to rest at x = width − 60, its right 20 px off the canvas, where that strip can no longer be grabbed. The bounds should shrink by the widest card (80), or per card by its own pose size.
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

<!-- done: 7 findings, files read: 49 -->
