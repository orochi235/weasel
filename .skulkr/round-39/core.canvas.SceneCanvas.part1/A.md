I couldn't write `.skulk/out/findings.md` because the permission wasn't granted, so the whole findings document is below.

# Audit round 39: core.canvas.SceneCanvas.part1

## Insert preview of a polygon or star collapses under a flipped view, and has the wrong shape under a stretched one
- where: packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts:42 (insertPreviewCommands, `radialScale`)
- scenario: the preview radius is `geom.radius * (view.scale.x + view.scale.y) / 2`. Views can carry a negative axis (`normalizeView`, view.ts:51: "a negative one keeps its sign"). For a y-up view `{ scale: { x: 1, y: -1 } }` this gives `radialScale = 0`, so the polygon or star preview draws as a point while the drag inserts a full-size shape. `{ x: 2, y: -1 }` gives 0.5, and the rotation sign is not flipped either. Under a stretched view (`scale {2, 1}`) the preview is a regular polygon on screen with radius 1.5·r, but the node committed in world draws stretched 2:1, so the preview and the result disagree. The kit already answers "one scale for an anisotropic view" another way, with `viewZoom`/`meanScale` (`sqrt(|x·y|)`). The `path` case in the same switch does it correctly: it builds the shape in world and carries it through `[sx,0,0,sy,panX,panY]`.
- evidence: read
- severity: medium

## A preset component mounted after the canvas puts its deps over the children's, and toggling a preset remounts every component after it
- where: packages/core/src/canvas/SceneCanvas/PresetComponents.tsx:8 (PresetComponents)
- scenario: two separate failures:
  - **Keyed by index.** Components are keyed by list position, and `enabled.components` is rebuilt from the enabled presets. Going from `features=[A, B]` to `[B]` moves B's component from key 1 to key 0, so React unmounts and remounts it with a different type at that key. Any state it held is lost, such as an editing overlay mid-edit.
  - **Dep precedence.** Dep sources stack newest-live by push order (`DepNode.register`, routing depNode.ts:56, inside `useEffect`). Any preset component that mounts after first render lands over deps the canvas's `children` registered earlier, whether it was just turned on or remounted by the index key. `FeaturePreset.components` (features.ts:147–149) promises the opposite: "A dep one publishes sits over the canvas's own and under any its children publish". Example: a child's `useDepSource` override is shadowed once the user toggles a preset at runtime.
- evidence: read
- severity: medium

## `isAtom` ignores the node-kind and tool-action roles, so a node-kind preset is reported as a bundle
- where: packages/core/src/canvas/SceneCanvas/describePresets.ts:6 (`ATOM_ROLES`, isAtom)
- scenario: features.ts:8–9 defines a bundle as a preset holding "only actions, tools, and includes", and anything else as an atom. `ATOM_ROLES` leaves out `routing`, `insertNodeFactories`, `insertKinds`, `shapes`, `properties` and `toolActions`. So `createNodeKindPreset({ id: 'sticky', kind: 'sticky', matches, shape, insert, properties })` gets `atom: false`. The prefs bundle editor (prefs/src/edit/bundleTree.ts:107–114) breaks a non-atom preset down into its `actions`/`tools`/`includes` members. A bundle rebuilt from those members drops the preset's routing, painter, insert factory and properties, and its `toolActions` never appear in `PresetDescription.actions` at all.
- evidence: read (bundle-editor consequence inferred from bundleTree.ts)
- severity: medium

## A refining preset's `includes` end up after it, contradicting "ahead of its own place"
- where: packages/core/src/canvas/SceneCanvas/features.ts:252 (resolveFeatures, `place`)
- scenario: `features=[P, R]`, where R `includes: [Q]` and `refines: ['P']`. `add` lists P, Q, R. `place(P)` places its refiner R first, then P, and Q is placed last: the order is R, P, Q. `FeaturePreset.includes` (features.ts:173) says included presets go "ahead of its own place in the order", so Q's actions, ambient bindings, contributions and layers now come after R and after P. No preset in the repo both includes and refines today, but a consumer can write one.
- evidence: read
- severity: low

## A frame hook added once the phase is already subscribed waits for an unrelated redraw
- where: packages/core/src/canvas/SceneCanvas/contributionFrameHooks.ts:50–67 (useContributionFrameHooks)
- scenario: the effect, and its `api.requestRedraw()` ("A hook arriving after the last paint would otherwise wait for an unrelated redraw"), re-runs only when `hasBefore`/`hasAfter` flips. If one entry already has `beforePaint` and a second entry with `beforePaint` is added, `hasBefore` stays true: no redraw is requested, and the new hook first runs whenever something else repaints. That is exactly the case the comment says it prevents.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/SceneCanvas/ActionsProviderIfRoot.tsx
packages/core/src/canvas/SceneCanvas/CanvasKitProviders.tsx
packages/core/src/canvas/SceneCanvas/DepRegistryProviderIfRoot.tsx
packages/core/src/canvas/SceneCanvas/DevHuds.tsx
packages/core/src/canvas/SceneCanvas/PointerProviderIfRoot.tsx
packages/core/src/canvas/SceneCanvas/PresetComponents.tsx
packages/core/src/canvas/SceneCanvas/SceneCanvasInput.tsx
packages/core/src/canvas/SceneCanvas/SurfaceDeclarations.tsx
packages/core/src/canvas/SceneCanvas/actionProps.ts
packages/core/src/canvas/SceneCanvas/brushOverlay.ts
packages/core/src/canvas/SceneCanvas/builtinToolSets.ts
packages/core/src/canvas/SceneCanvas/canvasPassThrough.ts
packages/core/src/canvas/SceneCanvas/contributionFrameHooks.ts
packages/core/src/canvas/SceneCanvas/coordTrace.ts
packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts
packages/core/src/canvas/SceneCanvas/defaultNodeRouting.ts
packages/core/src/canvas/SceneCanvas/describePresets.ts
packages/core/src/canvas/SceneCanvas/dispatcherGestureBounds.ts
packages/core/src/canvas/SceneCanvas/features.ts
packages/core/src/canvas/SceneCanvas/geometryProps.ts
packages/core/src/canvas/SceneCanvas/ingestionProps.ts
packages/core/src/canvas/SceneCanvas/insertPreviewCommands.ts
packages/core/src/canvas/SceneCanvas/longPressProps.ts
packages/core/src/canvas/SceneCanvas/mergeLayers.ts
packages/core/src/canvas/SceneCanvas/nodeTraits.ts
packages/core/src/canvas/SceneCanvas/pathEditHost.ts
packages/core/src/canvas/SceneCanvas/pointerProps.ts
packages/core/src/canvas/SceneCanvas/poseGeometry.ts
packages/core/src/canvas/SceneCanvas/poseRegistrars.tsx
packages/core/src/canvas/SceneCanvas/presetBuild.ts
packages/core/src/canvas/SceneCanvas/presetMerge.ts
packages/core/src/canvas/SceneCanvas/presetTraits.ts
packages/core/src/canvas/SceneCanvas/presets/baseline.ts
packages/core/src/canvas/SceneCanvas/presets/chrome.ts
packages/core/src/canvas/SceneCanvas/presets/index.ts
packages/core/src/canvas/SceneCanvas/presets/toolDriven.ts
packages/core/src/canvas/SceneCanvas/presets/view.ts
packages/core/src/canvas/SceneCanvas/presets/viewTools.ts
packages/core/src/canvas/SceneCanvas/props.ts
packages/core/src/canvas/SceneCanvas/sampleProps.ts
packages/core/src/canvas/SceneCanvas/scenePointQuery.ts
packages/core/src/canvas/SceneCanvas/sceneProps.ts
packages/core/src/canvas/SceneCanvas/sceneViewBounds.ts
packages/core/src/canvas/SceneCanvas/selectToolProps.ts
packages/core/src/canvas/SceneCanvas/shapeGeneratorProperties.ts

<!-- done: 5 findings, files read: 45 -->