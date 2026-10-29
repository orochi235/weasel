# @weasel-js/kernel3d

## 1.14.1

### Patch Changes

- @weasel-js/core@1.14.1
  - @weasel-js/geom@1.14.1
  - @weasel-js/prefs@1.14.1
  - @weasel-js/react@1.14.1

## 1.14.0

### Patch Changes

- 7f6a74c: A kernel3d view's aim drawn into a 2D view now outlines the part of the plane z = 0 its frustum actually takes in, cut off at the camera's far plane. A camera tilted so the horizon is in view used to outline nothing, because one of its corner rays missed the plane; it now outlines the ground it sees. A camera whose corner rays all meet the plane within its far distance outlines the same four points as before.
- 14f8583: `@weasel-js/geom/nd` exports `createSettledCache()`: a value built only once its source holds still. Each `read(key, build)` passes the source's key as a tuple; the first read at a new key answers null, and the second at the same key builds and keeps the value (`reads` moves which read builds it, and `reads: 1` makes it a plain memo). Keys match element by element under `Object.is`. This adds API.
  
  Core's pick index, the diagram port and label indexes, and kernel3d's snap box index now use it, in place of three copies of that rule. They build at the same reads as before.
- f130e8f: A kernel3d view drawn into a 2D view now outlines its footprint on the ground, the plane `createInsert` drops nodes onto, in place of the plane z = 0. A 2D view's aim drawn into a kernel3d pane, and a drag across one, lands on that same ground. In kernel3d's default y-up world, z = 0 is an upright wall, so a camera looking down at the floor used to outline nothing useful in a 2D view; its footprint now lies on y = 0, with world x and z carrying the 2D x and y. `aimOf3d` and `aimSpace3d` take an optional third argument, `{ up }`, read as `createInsert`'s `up` is (default +y); pass `{ up: { x: 0, y: 0, z: 1 } }` to keep the old z = 0 placement. The new `Aim3dOptions` type names it.
- d6884c8: kernel3d's README says how containers select: as in 2D, a click on a nested node selects its outermost container, a double-click enters it, and a click inside then selects the next level in. This needs nothing from a host beyond `<SceneCanvas>`'s own select tool, and is now under test.
- 1d39cf6: In a 3D move of several roots, a root stored under a container now moves by the same world distance as the first root, as roots stored in world space already did. It used to resolve the drag on its own plane, so it went a different distance and missed a snap target the first root found. A move now hands such a root the lead (`TranslateLead`) expressed in its container's frame, and kernel3d's descriptor applies the lead's change whole rather than flattening it onto the pose's own height.
- 8f3562e: kernel3d ships `POSE3_COMPOSITION`, a container composition for `Pose3`: a container's position, rotation and scale reach everything under it. It is exact when a container's scale is uniform; under a non-uniform one a turned child keeps its own axes rather than shearing.
  
  Picking, the marquee, `screenBoxOf`, snap targets and what a move drags now read each node at its world pose, folded up through its containers, where they used to read the stored pose. A node inside a container was picked and snapped at its container-relative position before. Picking also follows a gesture's in-flight pose. A move's snap leaves out everything under the moved nodes, which moves with them.
  
  `worldPoseOf(scene, id)` is new: the pose a renderer draws a node at. Additive API.
  
  Behavior change: `NodeBounds` is handed the node at its world pose and may return `null` for a node that occupies nothing, which is then never picked or snapped to. With no `bounds`, a group now occupies nothing, where it used to be a unit cube carried by its pose.
- e5ea7e8: A `@weasel-js/kernel3d` move or nudge of several roots moves them as one body. Each root used to turn the screen delta into a world delta on the plane at its own height and from its own place on screen, so roots moved by slightly different amounts and only the first landed on what the snap held it to. `PoseDescriptor.translate` takes an optional fourth argument, `lead: { from, to }`: how the move's first root went under the same delta. Core's move, nudge and `moveNodes` pass it for every root stored in world space, and kernel3d's descriptor moves each root by the lead's world change. `TranslateLead` is exported. A descriptor that ignores the argument behaves as before.
- 8bc23c2: `boxSnapSource` and `alignPlaneSource` read the scene's world boxes through an index kept against the scene's version and the world's `bounds`, so a snap during a drag reads only the boxes in reach of its probes instead of boxing every node each frame. They offer the same candidates in the same order as before.
- a80f8be: A scene composes poses by default. A child's stored pose is now relative to the frame of the nearest container above it that defines one (`RIGID_POSE_COMPOSITION`), so moving a container writes one pose, rotating it rotates its contents, and resizing it leaves them where they draw. A container whose pose derives from its children (`dependsOn: 'children'` with a `derivePose`) is an envelope, not a frame: its children share the frame above it.
  
  **This breaks a consumer that stores absolute child poses.** To migrate:
  
  - A scene whose `TPose` is not a rect pose must name its composition: `useScene` and `createScene` require `composition` in the type unless `TPose` is a `RectPose`. `IDENTITY_POSE_COMPOSITION` keeps every pose world; under it a container groups its children and never carries them. kernel3d's scenes name it.
  - Saves: `toJSON` writes version 3, whose child poses are local. `sceneFromJSON`, `Scene.loadState`, and `specsFromSerialized` read a version 1 or 2 save as world and make each pose local as it loads, under the scene's composition (`SpecsFromSerializedOptions.composition`). A recorded history from before is not restored: `SCENE_HISTORY_FORM` is 4.
  - Specs or ops you build with world poses for children: put them through `localizeWorldPoses(specs, composition)`, or `localizeInScene(scene, specs)` when they land under a container already in the scene. `worldPosesOf(specs, composition)` reads them back as world, and `heldInFrame(scene, id)` names what a container's frame holds.
  - `sceneToAdapter`'s `setPose` no longer moves a container's descendants by the same delta, and a container's pose target no longer shows them traveling beside it: the frame carries them. `PoseCascade` and the `cascade` argument of `scenePoseTarget` and `sceneClipTargets` are gone.
  - The group action makes a frame group, whose pose is authored, under any composition; it no longer derives an envelope's pose from its members under the identity strategy.
  - `resolvePreviews` answers each entry's pose in world, and a previewed frame brings the children it carries.
  - `SnapTarget.slotPose` is world, as documented; `snapToContainer` stores it in the target's frame.
  - `diagramScene` returns each spec's pose in its container's frame (`composition`, default `RIGID_POSE_COMPOSITION`; pass `IDENTITY_POSE_COMPOSITION` to read the layout in world). Body rows, container titles, lanes, and members are stored relative to what holds them; `DiagramView`'s reports, `diagramLayoutOf`, and `documentFromScene` stay in world.
  - `svgNodesFromKit` folds a tree's `composition` when it has one, and `unpackSvgFiles` stores each imported node in its container's frame.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [47656e3]
- Updated dependencies [ad58b32]
- Updated dependencies [f045da7]
- Updated dependencies [ac7aa31]
- Updated dependencies [a1b06d8]
- Updated dependencies [9725598]
- Updated dependencies [592b6e5]
- Updated dependencies [41a013b]
- Updated dependencies [965e698]
- Updated dependencies [fda48f1]
- Updated dependencies [070f3d0]
- Updated dependencies [f2188ba]
- Updated dependencies [e974dba]
- Updated dependencies [30582cb]
- Updated dependencies [2999820]
- Updated dependencies [8b14236]
- Updated dependencies [61e07e5]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [2692828]
- Updated dependencies [767713e]
- Updated dependencies [6a69c27]
- Updated dependencies [b0a55a6]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
- Updated dependencies [a370edb]
- Updated dependencies [e7fca17]
- Updated dependencies [1d39cf6]
- Updated dependencies [e5ea7e8]
- Updated dependencies [22472a1]
- Updated dependencies [ec6d7d3]
- Updated dependencies [80789ff]
- Updated dependencies [f695cff]
- Updated dependencies [b1b16ce]
- Updated dependencies [b15704a]
- Updated dependencies [81d08f7]
- Updated dependencies [a29d2df]
- Updated dependencies [4aa9b8b]
- Updated dependencies [39cb8ed]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [6b1b532]
- Updated dependencies [18c96c3]
- Updated dependencies [f30c624]
- Updated dependencies [b06e2b9]
- Updated dependencies [9a3626f]
- Updated dependencies [28f476b]
- Updated dependencies [ffdbbcf]
- Updated dependencies [ee97c81]
- Updated dependencies [9ef7751]
- Updated dependencies [34a364e]
- Updated dependencies [4c0141f]
- Updated dependencies [f9282f7]
- Updated dependencies [01b103e]
- Updated dependencies [2e4943e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8ddaf05]
- Updated dependencies [8e2c8c8]
- Updated dependencies [4f68c3a]
- Updated dependencies [ebe1f55]
- Updated dependencies [0fc0e50]
- Updated dependencies [3401898]
- Updated dependencies [058fcdf]
- Updated dependencies [dc6f83a]
- Updated dependencies [880f2b0]
- Updated dependencies [871a56b]
- Updated dependencies [f645651]
- Updated dependencies [1e54d33]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [ca31c35]
- Updated dependencies [69d6ede]
- Updated dependencies [24e03ff]
- Updated dependencies [b43c94c]
- Updated dependencies [dfdc8a6]
- Updated dependencies [e23101b]
- Updated dependencies [7a6f462]
- Updated dependencies [de97d4d]
- Updated dependencies [9abd787]
- Updated dependencies [09442dc]
- Updated dependencies [fceb8c5]
  - @weasel-js/core@1.14.0
  - @weasel-js/geom@1.14.0
  - @weasel-js/prefs@1.14.0
  - @weasel-js/react@1.14.0

## 1.13.0

### Patch Changes

- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- 8c39126: Picks consult a BVH index kept beside the scene, so a marquee, a lasso or a click visits the nodes near the query instead of every node. `@weasel-js/geom` adds the tree. Three contracts tighten for the index to be sound. `NodeInk.outset` must not depend on the view scale: screen-space reach goes in `outsetPx`. In kernel3d, `world.bounds` must be a function of the node alone. Two picks change behavior: marquee and lasso now test a derived node at its derived path, and the point pick now tests a node carrying an override `path` against that path, which is what the renderer paints, instead of its pose box.
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
- Updated dependencies [7c1134c]
- Updated dependencies [f1c1528]
- Updated dependencies [9a76fb5]
- Updated dependencies [7e5f9e3]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [5f28e9c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/core@1.13.0
  - @weasel-js/prefs@1.13.0
  - @weasel-js/geom@1.13.0
  - @weasel-js/react@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- 8c39126: Picks consult a BVH index kept beside the scene, so a marquee, a lasso or a click visits the nodes near the query instead of every node. `@weasel-js/geom` adds the tree. Three contracts tighten for the index to be sound. `NodeInk.outset` must not depend on the view scale: screen-space reach goes in `outsetPx`. In kernel3d, `world.bounds` must be a function of the node alone. Two picks change behavior: marquee and lasso now test a derived node at its derived path, and the point pick now tests a node carrying an override `path` against that path, which is what the renderer paints, instead of its pose box.
- Updated dependencies [7e5f9e3]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [5f28e9c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/prefs@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0

## 1.12.0

### Patch Changes

- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- eec50d7: Views answer what they show: `SceneCanvasApi.aimOf` and `setAim`, and `<CanvasView aim onAimChange>` for a view that holds its aim and derives its camera from it. `<ViewMarker>`, or a contribution's `markers`, draws one view's aim inside another's frame, and dragging the marker moves that view; `actions={null}` turns marker dragging off. kernel3d answers a frustum aim with `aimOf3d`.
  
  `CanvasViewProps` is now a union: `aim` cannot be passed together with `view`, `defaultView`, `onViewChange` or `viewBounds`. Code that writes an interface extending `CanvasViewProps` needs a type alias instead. A `Partial<CanvasViewProps>` spread into `<CanvasView>` no longer type-checks, and `Omit<CanvasViewProps, …>` does not distribute over the union; type either over one of the named halves, `CanvasViewCommonProps` with `CameraHeldViewProps` or `AimHeldViewProps`.
  
  `SceneCanvasApi` has two new required members, `aimOf` and `setAim`, so a hand-written fake of it needs both.
- Updated dependencies [dbd6711]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [92a0f2d]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [eec50d7]
  - @weasel-js/geom@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/prefs@1.12.0

## 1.11.1

### Patch Changes

- 1a1bb83: Drawing or click-placing a node into a container with a unit scope now snaps on that scope's grid
  pitch, not the root's.
  
  - `SnapBegin` and `SnapCollect` take `parent`: the container a subject not yet in the scene lands
    in. `insertAction` and `placeAction` pass the container the `insertInto` dep names, the same one
    the `insert` dep puts the node in; an id naming no container passes nothing.
  - `gridSnapSource({ scopes })` reads the scope from `ids` when the gesture has a subject, else from
    `parent`, else the root.
  - kernel3d's `createSnap` passes `parent` on to its sources, as it does `ids`.
  - `placeAction` now requires the `insertInto` and `scene` deps, both optional.
- 5053f5b: `SnapBegin` takes `sources` and `omit`, so one gesture can ask snap sources the canvas does not list, or skip ones it does (a listed, registered or default source, by id), without changing the canvas. Gesture sources are ranked with the canvas's own, and one sharing an id with a source still asked throws. Gesture sources are 2D: kernel3d's `createSnap` honors `omit` but does not ask a gesture's `sources`, and warns once in dev when it is given some.
- 2b267d5: Snap pipeline follow-ups.
  
  - kernel3d's `createSnap` takes `kitSettings` and reads its reach from `targets.snapPx` there, as a canvas does (`reachPx` still overrides it).
  - Two snap sources sharing an id now throw, on a canvas when a gesture begins and in kernel3d's `createSnap`, where before the later one silently replaced the earlier: a `<SceneCanvas snap>` source and a preset's alignment source were the likely pair, and the page box went with it. A source still replaces one of the canvas's defaults (`'rotation'`, `'path-snap'`) by taking its id. Core exports the check as `assertSnapSourceIds`.
  - The symmetry axis knob and a repeat's step handle turn through a `rotate` session on the `snap` dep: they now snap to quarter turns and other nodes' angles without Shift, Shift keeps the 15° steps, Ctrl suspends snapping, and the angle readout draws. Breaking: `handleChange` takes a `SymmetryHandleSnap` (`{ point, angle }`, new export) in place of its `stepped` flag and point function. Without a `snap` dep the handles do not snap, Shift included.
  - `resolveSnap` keeps every required candidate past `poolSize`, so Shift's steps can no longer be crowded out by 24 nearer targets, and drops a candidate with a non-finite locus direction instead of treating its line as a point.
  - A move begins its snap session once the drag passes its threshold, so a click on a selected body reads nothing for snapping, and its `geometry` probe is placed within the canvas's reach rather than a fixed 8px.
- 433540d: A container's unit scope (`ContainerNode.units`) now reaches grid snapping and node property
  fields. A scope converts what is shown, typed and snapped to; every pose is still stored in world
  units, and pose composition does not scale by it.
  
  - `gridSnapSource({ scopes: { root, spacing? } })` snaps the subject on the pitch of the unit
    scope its nodes share, so a node inside a millimeter sub-assembly snaps on millimeter spacing.
    `spacing` is read in that scope's units unless `scopes.spacing` gives a pitch per scope.
    `scopedGridPitch` answers the pitch for a chain of scopes.
  - A snap source is told the gesture's subject: `SnapCollect.ids`.
  - `sceneSharedUnitScopes(scene, ids, root)` is the run of unit scopes every node of `ids` sits in.
  - A number leaf takes `measure: 'length'` for a length stored in world units.
    `prefLeafInScopes(leaf, scopes)` gives such a leaf the unit of the scopes it is shown in, built by
    `scopedPrefUnit(scopes)`: shown in the innermost scope's base unit, with every unit of its system
    accepted as typed text. The kit's node schemas mark X, Y, W, H and text padding as lengths.
  - `SelectionPanel` takes `units`, the scene's outermost scope; given it, a length field shows the
    selected nodes' shared scope.
- Updated dependencies [70b12d1]
- Updated dependencies [3b5750f]
- Updated dependencies [768be71]
- Updated dependencies [9390be4]
- Updated dependencies [1dd65f5]
- Updated dependencies [411b629]
- Updated dependencies [267d5e4]
- Updated dependencies [922cddf]
- Updated dependencies [d5a4102]
- Updated dependencies [9cd12f7]
- Updated dependencies [e5ba382]
- Updated dependencies [8e317f5]
- Updated dependencies [abf41a7]
- Updated dependencies [312eb35]
- Updated dependencies [7ffc196]
- Updated dependencies [25a112b]
- Updated dependencies [4d99526]
- Updated dependencies [853ce69]
- Updated dependencies [8c1861a]
- Updated dependencies [6440997]
- Updated dependencies [44cf2c5]
- Updated dependencies [8ff750f]
- Updated dependencies [161c9c4]
- Updated dependencies [33fa471]
- Updated dependencies [2eb0370]
- Updated dependencies [c726003]
- Updated dependencies [e30f4df]
- Updated dependencies [8c2a9a9]
- Updated dependencies [1156d63]
- Updated dependencies [13fc67f]
- Updated dependencies [adadf5e]
- Updated dependencies [b3aa7cb]
- Updated dependencies [50da815]
- Updated dependencies [ee2f0fc]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [0e24110]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
- Updated dependencies [8cd81e7]
- Updated dependencies [b7e6edc]
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/core@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/prefs@1.11.1

## 1.11.0

### Patch Changes

- 6525caa: An ongoing gesture can take the wheel while it is in flight. `OngoingHandle.onWheel(ctx)` is called with each wheel event before any wheel binding sees it, newest gesture first; returning `true` claims the event, so the viewport neither zooms nor pans, and anything else lets it through to the bindings as before.
  
  `OngoingHandle.overlay()` may now answer a list of overlays as well as one, for a gesture showing several runs at once. This is breaking for code that reads `overlay()` directly and expects a single overlay: read it through the new `overlaysOf(handle)`, exported from routing and core, which always answers a list. Core's overlay painter, gesture bounds and parallax-plane mapping, and kernel3d's `collectOverlayBoxes`, all read it that way.
  
  `OverlayRole` names one more kit role, with a stroke in core's overlay painter: `falloff`, the reach of a soft-selection drag.
- c6a0a52: Kit settings for gestures, targets, the camera, orbit and the loupe. Under a `<KitSettingsProvider>` a consumer can now set `gestures.doubleClickMs`, `doubleClickPx`, `longPressMs`, `tapPx` and `dragPx` (read by the dispatcher, the move action and `useDragHandle`; an explicit `longPress` prop or `dragThresholdPx` param still wins); core's `targets` leaves `handlePx`, `anchorHitPx` and `rotationDistancePx` (the base that device scaling multiplies, under an explicit `handleHitRadius`), `segmentHitPx`, `anchorClickPx`, `pickTolerancePx` (under `geometry.pickTolerancePx`), and the pen, bone, weight and slice overlay dot radii; `view.animationMs` (under a move's own `ms`); `orbit3d.orbitRate` and `dollyRate` in kernel3d; and `loupe.wheelRate` in labkit. `coreKitSettingsSchema`, `kernel3dKitSettingsSchema` and `labkitKitSettingsSchema` describe these as prefs groups whose paths are the settings' paths, each default being the existing constant. Underneath: `createPointerRecognizer` takes `doubleClickMs`, `doubleClickPx`, `tapPx` and `dragPx` thunks; `<SceneCanvas>` publishes the provider's store as the `kitSettings` dep; `targetSizesPx` and `mergeLayersWithDefaults` take optional base sizes; `createPenPreviewLayer`, `createBoneOverlay` and `createWeightOverlay` take optional size readers; `@weasel-js/react` declares `KitTargetSettings`, the shared `targets` area. Additive.
- 98870f1: labkit gets a 3D orbit camera as an instrument capability, the sibling of
  `canvas` and `stage`.
  
  **`orbit`.** An instrument declaring `orbit: { initialView, limits, gestures,
  overlay }` gets a trial-owned kernel3d `Camera3d` in the trial's `view`, so the
  camera persists, Clone copies it and Reset restores it. A drag turns it,
  Shift+drag pans its target, the wheel and both pinches dolly, and a double
  click goes home, all through the gesture dispatcher. `useTrialOrbit()` reads and
  moves it from anywhere in the trial, and `as3DView` reads it off a stored view.
  `<Orbit>` is exported for use outside a lab. `orbit` beside `canvas` or `stage`
  throws. labkit now depends on `@weasel-js/kernel3d`.
  
  **One camera surface for 2D and 3D.** The lab's zoom controls drive an orbit as
  they drive a 2D camera, reading its zoom as home distance over distance, and
  `RenderContext.trial.zoom` means the same. `CameraGestures` serves every camera
  and gains `home`, a double click back to where the camera opened — on by
  default for an orbit, opt-in for a 2D camera through `onHome` on `<Stage>`,
  `<CanvasStack>` and `<CameraInput>`.
  
  **Breaking.** `CameraGestures.pan` is renamed `drag`, since on an orbit a drag
  turns rather than pans. `CameraView` gains a required `zoomOf(view)`, so a
  `CameraView` built by hand needs one. `useViewPlacement` returns `{ place, home }`
  rather than the placement function.
  
  **kernel3d.** `orbitBy` and `dollyBy` take an `OrbitLimits`, and `clampCamera`
  applies one; distance limits were fixed at 0.5..500, which is the default now.
  `panBy` and the `camera.pan`, `camera.pinchDolly` and `camera.home` actions are
  new, and `Camera3dDep` takes optional `limits()` and `home()`. `camera.dolly`
  now binds the ctrl+wheel a trackpad pinch arrives as, which used to zoom the
  page, and Safari's pinch. `useOrbitTool` binds Shift+drag to `camera.pan`.
  
  **routing.** A wheel reported in lines or pages — Firefox's mouse wheel — is
  converted to pixels before it reaches an action, so per-pixel rates are no
  longer about a sixteenth as fast there.
  
  **Icons.** labkit draws its glyphs from the app's icon registry, which it does
  not mount: a lab with none draws placeholders and warns. Mount
  `<IconRegistryProvider icons={kitIcons}>` (`@weasel-js/ui/kit-icons`) or the
  trimmed `virtual:weasel-icons` set at the app root; labkit's examples now do.
- e34bfb5: An orbit dollies about the point under the pointer, as a 2D camera zooms about
  it. kernel3d's `dollyToward` keeps the point in the target's screen-facing
  plane under the pointer still and slides the target toward it, and
  `camera.dolly` and `camera.pinchDolly` go through it, anchored at the pointer
  and at where the fingers began.
  
  An orbit instrument whose scene fills only part of its DOM names that pane with
  `useTrialOrbit().viewportRef` (or `<Orbit viewport>`): gestures land there and
  the dolly anchors there, so a toolbar or a timeline beside the picture no
  longer throws the anchor off or takes the camera's gestures.
  
  `CameraGestures.pinch` takes `'trackpad'` or `'touch'` as well as a boolean, on
  every camera. Two fingers are pointers, so an instrument handing every press to
  its own tools can now keep the trackpad's pinch, which it previously had to
  give up with them.
- db8c16e: One snap pipeline for every gesture. Move, resize, rotate, insert (drag and click-place), pen and spiro placement, pen handles, anchor and handle drags in path edit, measure, and the symmetry center all begin a session on the `snap` dep at press and ask it each frame where their point lands. Every kind of target is a snap source, and one resolver ranks all of their candidates together: a point beats a line, a real target beats a fallback such as the grid, then the smaller move on screen wins, then source order. One readout layer draws what the result met. `docs/snapping.md` is the reference.
  
  **Breaking: removed APIs, with their replacements.**
  
  - `SnapDep.point` is gone: the `snap` dep is `begin(req)`, which returns a `SnapSession` (`at`, `angle`, `end`).
  - `<SceneCanvas toolOptions={{ snapPoint }}>` is gone: register a source in `<SceneCanvas snap={{ sources }}>`, `gridSnapSource` for a grid.
  - `selectTool.snap`, `SnapStrategy`, and core's `snap()` behavior adapter are gone: a grid is `gridSnapSource({ spacing, origin?, unitSystem? })`, ruler guides `guideSnapSource(getGuides)`. A pose that is neither a rect nor a `Path` passes its `OriginProjection` as `snap={{ originProjection }}`. Moving from `selectTool.snap: gridSnapStrategy(…)` to `gridSnapSource` also snaps resize corners, inserts and pen clicks to the grid, not only a move's origin.
  - `@weasel-js/guides`: `gridSnapStrategy`, `guideSnapStrategy`, `GuideSnapOptions`, `DEFAULT_GUIDE_TOLERANCE_PX`, and `pointSnapToGrid` are gone, and so are the `@weasel-js/guides/move`, `/resize` and `/insert` subpaths with their `snapToGrid`, `snapToGuides`, `SnapToGuidesMoveArgs`, `SnapToGuidesResizeArgs` and `SnapToGuidesInsertArgs`: use `gridSnapSource` and `guideSnapSource`. An import of `snapToGrid` from `@weasel-js/core/move` (a subpath that no longer had it) becomes `gridSnapSource` from `@weasel-js/guides`.
  - `@weasel-js/guides`: `alignMoveBehavior`, `alignInsertBehavior`, `alignResizeBehavior`, `AlignMoveArgs`, `AlignmentBehaviorBase`, `matchAlignment`, `MOVE_ANCHORS`, `AlignAnchor` and `AlignMatchResult` are gone: `alignmentSnapSource(opts)` snaps to siblings' edges and centers and `spacingSnapSource(opts)` to equal gaps, on move, resize and insert alike. `matchSpacing` and `measureGaps` stay.
  - `PointSnapBehavior`, `PointSnapContext`, `PointSnapResult`, `PointSnapFrame`, `ResizePolicy.pointSnap`, `useResizePolicy`'s `pointSnap`, and the resize option `pointSnapBehaviors` are gone: a resize snaps its dragged corner or edges through the session, so any source snaps it.
  - `lockAspectWithModifier` (with its `{ key }` option) and `DEFAULT_RESIZE_BEHAVIORS` are gone from `@weasel-js/core/resize`: Shift's aspect lock is the resize's `snap.constrain` role.
  - `snapRotationWithModifier`, `DEFAULT_ROTATION_SNAP_STEP` and `DEFAULT_ROTATE_BEHAVIORS` are gone: rotation snaps through `rotationSnapSource`, which every canvas asks, and the `snap.constrain` role (Shift) adds the 15° steps. `rotate: { behaviors: [] }` no longer turns rotation snapping off; `<SceneCanvas snap={{ omit: ['rotation'] }}>` does, and a source with the id `'rotation'` replaces the default.
  - `constrainTo45` is gone from `@weasel-js/core`: the pen's handle Shift is the session's angle step.
  - `usePenTool`'s `snapPoint` and `anchorSnapRadius` options are gone, and `useDragRect`'s and `useDragRadial`'s `snapPoint`: the pen and the drag gestures snap through the `snap` dep (`pathSnapSource` for anchors, `gridSnapSource` for a grid). A pen anchor joins an open end within `targets.penCloseHitPx` of the press before any snap.
  - kernel3d's `createSnap()` took nothing and snapped nothing; `createSnap(world, { sources?, reachPx?, store? })` takes the world and snaps.
  
  **New.**
  
  - `<SceneCanvas snap={{ sources, omit, reachPx, originProjection, readout, readoutStyle }}>` (`SceneCanvasSnap`), a feature preset's `snapSources`, and `useSnapSource(source)`.
  - One reach for every source that sets none, the kit setting `targets.snapPx` (8 screen px; `DEFAULT_SNAP_PX`).
  - The snap source contract: `SnapSource`, `SnapCollect`, `SourceCandidate`, `Locus`, `SnapProbeAt`, `SnapGesture` (with `'handle'`), `SnapEdge`, `SnapEdges`, `AngleCollect`, `AngleCandidate`, `SnapMark` and `SnapMarks`; the session types `SnapBegin` (with `reachRad` and `theta0`), `SnapConstrain`, `SnapMods`, `SnapOutcome`, `SnapResizeBox`, `SnapSession`.
  - Sources: `pathSnapSource` with `PathSnapSourceOptions` (and `only`), `measureEndSource` with `MeasureEndSourceOptions` (`reachPx`), and `rotationSnapSource` in core; `gridSnapSource`, `guideSnapSource`, `alignmentSnapSource` and `spacingSnapSource` in guides; `handleSnapSource` and `HandleSnapOptionsInput` in path-tools (`createHandleSnapPreset` and `createHandleSnapExtension` take options or a thunk of them, and the preset registers the source); `boxSnapSource`, `alignPlaneSource`, `groundGridSource` and `GroundGridSourceOptions` in kernel3d.
  - The modifier roles `snap.suspend` (Ctrl) and `snap.constrain` (Shift), declared by every snapping action: `SNAP_ROLES`, `snapMods`, `SNAP_ANGLE_STEP` (the one 15° step for a line insert, a measurement, a rotate and the symmetry axis), `SNAP_AXIS_STEP`, and `stepAngles`.
  - The readout: `createSnapReadoutLayer`, `SnapReadoutStyle`, `createSnapOutcomeStore`, the `snapReadout` dep (`SnapReadoutDep`), and the drawing helpers `tickedSegment`, `pillCommands` and `measuredSegmentCommands`. The debug overlay's `snap` feature draws every candidate the resolver weighed.
  - Building blocks for a host's own session: `resolveSnap` and its types in `@weasel-js/geom/nd`, with `stepLine` and the flat math under it (`Flat`, `Vec`, `flatDim`, `closestOnFlat`, `closestBetweenFlats`, `intersectFlats`); `gatherSnapCandidates`, `resolvedSnapMarks`, `snapSourcesFor`, `GatherSnapOptions`, `SnapCandidateMark` and `SnapGeometry` in core; `pointSnap`/`PointSnap` for a tool placing points.
  - `@weasel-js/geom/3d` gains `vec3`, `distance`, `lerp`, `pointOnRay`, `aabbOfPoints`, `closestPointOnLine`, `closestPointOnSegment` and `closestPointsRayLine`.
  - `@weasel-js/core/test-seams` gains `createSnapSession2dForTests` (with `SnapSession2dOptions`), a 2D session for tests outside core; it is not public API.
  - kernel3d: `projectSnapMarks` with `ScreenLine` and `ScreenPoint`, `projectPoint`, and `Snap3dOptions`.
  - `InsertDep.commit` and `InsertDep.build` take an optional `ends: InsertEnds` (the drag's start, end and `fromCenter`); click-place passes them too. kernel3d's `createInsert` builds its footprint from the two ends cast onto the ground, so a 3D click-place centers its footprint on the snapped ground point.
  - path edit: `PathEditDragStart.snap`, `PathEditDrag.end`, `SnapMods.hold`.
  
  **Behavior changes.**
  
  - Every `<SceneCanvas>` snaps point gestures to other nodes' anchors — rect and text corners, ellipse quadrants, path anchors — through a default source with `pathSnapSource`'s id, `'path-snap'`: pen placement and handle tips, spiro points, anchor drags, line and box insert, click-place, measure ends and the measurement end drag, and the symmetry center; not move, resize or rotate. `snap={{ omit: ['path-snap'] }}` drops it, and a consumer's own `pathSnapSource()` replaces it rather than doubling. A point target on the gesture's own `origin` is never offered, so a handle tip does not stick to its anchor.
  - A grid gives way to a target in reach on its axis, where alignment used to add its delta on top of the grid's. Guides and alignment reach 8px, not 6.
  - Ties between equally good results break by source order, then by the order a source yields its targets.
  - Ctrl suspends snapping on every snapping gesture, a pen drag and an anchor drag included; a handle drag keeps Ctrl as its length lock.
  - A rotate snaps to quarter turns and to other nodes' angles without Shift (new); near the pivot its reach is capped at 30°.
  - Shift on a move locks it to the horizontal, vertical or 45° line through the press (new), and so does Shift on an anchor drag (new).
  - Shift on a line insert, a measurement or a pen handle puts the end at the pointer's nearest point on the stepped line through the start (it used to keep the drag's length), and that line meets snap targets.
  - An anchor drag meets every point-gesture source, a grid included.
  - A multi-root move snaps each root's origin, the nearest winning, not only the first node's.
  - A move's behaviors run on the snapped delta, and a behavior's translate stands, so a container's slot preview wins over a snap target in reach.
  - A measurement end drag keeps its offset from the press (it used to jump the end to the pointer), and no longer snaps to its own measurement's ends.
  - kernel3d's `translate` puts its plane at `up · position`, the same as before for +y up.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [ed0e096]
- Updated dependencies [65be8d3]
- Updated dependencies [10b67bb]
- Updated dependencies [6f839dd]
- Updated dependencies [327fb63]
- Updated dependencies [5338358]
- Updated dependencies [7116c36]
- Updated dependencies [1c76897]
- Updated dependencies [4447e67]
- Updated dependencies [84dd318]
- Updated dependencies [e0608bf]
- Updated dependencies [b0f392c]
- Updated dependencies [cf7b009]
- Updated dependencies [6072e93]
- Updated dependencies [53ba41a]
- Updated dependencies [1322a03]
- Updated dependencies [4da5998]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [89271a6]
- Updated dependencies [72a0ea2]
- Updated dependencies [14b7551]
- Updated dependencies [eec8a5b]
- Updated dependencies [1774dc4]
- Updated dependencies [8ff3b4b]
- Updated dependencies [02cbe1d]
- Updated dependencies [d2749ce]
- Updated dependencies
- Updated dependencies [8374354]
- Updated dependencies [5b20cca]
- Updated dependencies [516914b]
- Updated dependencies [6525caa]
- Updated dependencies [f4dd2ff]
- Updated dependencies [5adbb76]
- Updated dependencies [0382007]
- Updated dependencies [d0daf94]
- Updated dependencies [63b310c]
- Updated dependencies [ebb8804]
- Updated dependencies [c6a0a52]
- Updated dependencies [628c62d]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [e4642bb]
- Updated dependencies [797bf34]
- Updated dependencies [e901a2b]
- Updated dependencies [57725cc]
- Updated dependencies [2f51085]
- Updated dependencies [c6d61e0]
- Updated dependencies [3f89d6b]
- Updated dependencies [86725ed]
- Updated dependencies [f34b290]
- Updated dependencies [679138c]
- Updated dependencies [7cbedd8]
- Updated dependencies [c17c978]
- Updated dependencies [a2dcbfb]
- Updated dependencies [a4c99c1]
- Updated dependencies [c53b0ae]
- Updated dependencies [8775065]
- Updated dependencies [d4d28ad]
- Updated dependencies [ad8f48a]
- Updated dependencies [5274f79]
- Updated dependencies [c4840ed]
- Updated dependencies [616a4b2]
- Updated dependencies [0677769]
- Updated dependencies [974682d]
- Updated dependencies [66e3696]
- Updated dependencies [5973184]
- Updated dependencies [7afe8cd]
- Updated dependencies [3378ade]
- Updated dependencies [71c079d]
- Updated dependencies [c0d59c6]
- Updated dependencies [f426089]
- Updated dependencies [dcca70c]
- Updated dependencies [420e4b2]
- Updated dependencies [bfb566c]
- Updated dependencies [d019f44]
- Updated dependencies [79b65f5]
- Updated dependencies [cc54285]
- Updated dependencies [e021579]
- Updated dependencies [5f12888]
- Updated dependencies [d18df3e]
- Updated dependencies [46c731d]
- Updated dependencies [36eca7a]
- Updated dependencies [cc11671]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [39f86d1]
- Updated dependencies [f3398d4]
- Updated dependencies [86a5ec7]
- Updated dependencies [c2048de]
- Updated dependencies [9073669]
- Updated dependencies [798e9b0]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [e287da2]
- Updated dependencies [4df0749]
- Updated dependencies
- Updated dependencies [365ab72]
- Updated dependencies [3eb2abc]
- Updated dependencies [e554ae5]
- Updated dependencies [70fe7cc]
- Updated dependencies [c4e499e]
- Updated dependencies [5ebf7e7]
- Updated dependencies [ecdf4d0]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1efa251]
- Updated dependencies [1faab2d]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [329aa39]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/prefs@1.11.0
  - @weasel-js/core@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/react@1.11.0

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- Updated dependencies [113c088]
- Updated dependencies [cbd5b4d]
- Updated dependencies [d3b73b9]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [faf8ff3]
- Updated dependencies [8bee821]
- Updated dependencies [67a7de8]
- Updated dependencies [f6e3e90]
- Updated dependencies [74ba77e]
- Updated dependencies [a8e8048]
- Updated dependencies [755b7ff]
- Updated dependencies [1d3ca5c]
- Updated dependencies [566f15e]
- Updated dependencies [ee59ccd]
- Updated dependencies [f22f5ce]
- Updated dependencies [92e6291]
- Updated dependencies [2216d1b]
- Updated dependencies [a7144f4]
- Updated dependencies [35c4879]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [f8faa63]
- Updated dependencies [3bc85c9]
- Updated dependencies [d8b51a4]
- Updated dependencies [d0c3896]
- Updated dependencies [3448831]
- Updated dependencies [27fe0fb]
- Updated dependencies [8bbf878]
- Updated dependencies [b5267f9]
- Updated dependencies [62e766c]
- Updated dependencies [5485d35]
- Updated dependencies [690ea72]
- Updated dependencies [ab9ea7a]
- Updated dependencies [e962494]
- Updated dependencies [bad37cf]
- Updated dependencies [9e84e5d]
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [781a15e]
- Updated dependencies [a092978]
  - @weasel-js/core@1.10.1
  - @weasel-js/geom@1.10.1

## 1.10.0

### Patch Changes

- 54b013c: Removes what was left of tools running their own gestures. A tool declares bindings to actions, and nothing called these any more.
  
  Breaking, for code that used them:
  
  - `ToolCtx` is gone from `@weasel-js/routing` and `@weasel-js/core`. An action reads its `InvocationCtx`.
  - A function passed as `Tool.cursor` or `ToolDef.cursor` takes no argument: the type is `CursorSpec | (() => CursorSpec)`. A cursor that depends on the tool's state closes over that state. Before, the function was handed a context whose pointer position was always `0, 0` and whose modifiers were always up.
  - `Tool.previewPose`, `Tool.previewBounds`, and `Tool.previewIds` are gone, and a canvas no longer asks its tools for a preview. An in-flight preview comes from the action's `OngoingHandle` (`previewIds`, `previewPose`, `previewData`), which is where the kit's actions publish theirs. `CanvasHelpers.getPreviewSources()` returns those handles alone.
  - `Tool.initScratch` and `ToolDef.initScratch` are gone, and so is `ToolLifecycleCtx`. `onActivate` and `onDeactivate` take no argument; before, they were handed `{ scratch }`, the value `initScratch()` returned. A tool that keeps state between gestures holds it itself and closes over it, as the pen does.
  - `Tool`, `ToolDef`, and `defineTool` lose their scratch type parameter. In `@weasel-js/core` none of them takes a type argument: `Tool<null>` becomes `Tool`, and `defineTool<null>({ … })` becomes `defineTool({ … })`. In `@weasel-js/routing` the one parameter left is the overlay type: `Tool<TOverlay>`, `ToolDef<TOverlay>`, `defineTool<TOverlay>`.
  - `AnyToolOf<TOverlay>` is gone from `@weasel-js/routing`; `Tool<TOverlay>` is the same type.
  - `ToolPresentation` takes no type parameter, and a function passed as `presentation.icon` takes no argument. The palette only ever called it with `undefined`.
  
  Adds API: `CanvasExtensionApi.clientToWorld(clientX, clientY)` converts a client point to the canvas's world the way the canvas itself does, through the `clientToWorld` prop when one was given. Fixes a `<Canvas>` given that prop disagreeing with itself: hover used the override, and the test for whether a registered layer covers a point inside a `<CanvasView>` did not.
- Updated dependencies [dfc0dda]
- Updated dependencies [cd8cbbd]
- Updated dependencies [1f7548d]
- Updated dependencies [a86d79f]
- Updated dependencies [ad15c29]
- Updated dependencies [90eae1c]
- Updated dependencies [96a63de]
- Updated dependencies [7140b5a]
- Updated dependencies [8e00180]
- Updated dependencies [fc267f3]
- Updated dependencies [9f5cdb2]
- Updated dependencies [b9fb732]
- Updated dependencies [67f4d79]
- Updated dependencies [d137eaf]
- Updated dependencies [1837952]
- Updated dependencies [99553f7]
- Updated dependencies [5149cce]
- Updated dependencies [2c6246d]
- Updated dependencies [de60e10]
- Updated dependencies [2892438]
- Updated dependencies [b310df0]
- Updated dependencies [2a5d8ef]
- Updated dependencies [3994be7]
- Updated dependencies [e80de55]
- Updated dependencies [b3ba3d9]
- Updated dependencies [126116b]
- Updated dependencies [9296fb4]
- Updated dependencies [0e46e02]
- Updated dependencies [dee0a3b]
- Updated dependencies [b1f7521]
- Updated dependencies [e77f185]
- Updated dependencies [d635e84]
- Updated dependencies [dc1f09c]
- Updated dependencies [2ed751e]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [0449330]
- Updated dependencies [4878967]
- Updated dependencies [2a141ac]
- Updated dependencies [7063584]
- Updated dependencies [da0335e]
- Updated dependencies [fb715f4]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [87dd1ad]
- Updated dependencies [3bacb3e]
- Updated dependencies [6b03b7e]
- Updated dependencies [b260415]
- Updated dependencies [66d5455]
- Updated dependencies [eb7f534]
- Updated dependencies [7548e82]
- Updated dependencies [eb3114f]
- Updated dependencies [0a37db1]
- Updated dependencies [a275f78]
- Updated dependencies [605ace8]
- Updated dependencies [0db7e81]
- Updated dependencies [6bb8035]
- Updated dependencies [5d82ef9]
- Updated dependencies [bc15034]
- Updated dependencies [1ce19c9]
- Updated dependencies [7d94bbb]
- Updated dependencies [1c9bc4e]
- Updated dependencies [525800f]
- Updated dependencies [dcf0554]
- Updated dependencies [5c7d50f]
- Updated dependencies [bb3e633]
- Updated dependencies [be611ae]
- Updated dependencies [ca09ae2]
- Updated dependencies [33c90ed]
- Updated dependencies [8d0498c]
- Updated dependencies [b3d4383]
- Updated dependencies [a6dff38]
- Updated dependencies [27c1c86]
- Updated dependencies [54b013c]
- Updated dependencies [a8ef308]
- Updated dependencies [5996856]
- Updated dependencies [0d1c052]
- Updated dependencies [71512af]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [bb53d86]
- Updated dependencies [18920a4]
- Updated dependencies [9b8bd89]
- Updated dependencies [efc1205]
- Updated dependencies [b4227bc]
- Updated dependencies [6139898]
- Updated dependencies [335f192]
- Updated dependencies [f3b977a]
- Updated dependencies [df159bc]
- Updated dependencies [7b9de2d]
- Updated dependencies [485bb80]
- Updated dependencies [21b6db7]
- Updated dependencies [970f489]
- Updated dependencies [af48ee3]
- Updated dependencies [1c8c3fc]
- Updated dependencies [4d4d81c]
- Updated dependencies [ea54a64]
- Updated dependencies [8524e05]
- Updated dependencies [8ac6236]
- Updated dependencies [eafd001]
- Updated dependencies [1956417]
- Updated dependencies [955defa]
- Updated dependencies [27b827e]
- Updated dependencies [74f364f]
- Updated dependencies [01d6e4e]
- Updated dependencies [32b3cc9]
- Updated dependencies [70413dd]
- Updated dependencies [fcf44fa]
- Updated dependencies [a91e5cd]
- Updated dependencies [91a479a]
- Updated dependencies [7afbc13]
- Updated dependencies [8f38287]
- Updated dependencies [936679d]
- Updated dependencies [813aea2]
- Updated dependencies [42f24c8]
- Updated dependencies [499af9b]
- Updated dependencies [8cc746f]
- Updated dependencies [a21947b]
- Updated dependencies [de07db0]
- Updated dependencies [4d3ff3f]
- Updated dependencies [85cb886]
- Updated dependencies [aed6320]
- Updated dependencies [9d11828]
- Updated dependencies [37463b5]
- Updated dependencies [3558fbb]
- Updated dependencies [bffba0a]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [c9b9598]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [e69e97f]
- Updated dependencies [9c19d5e]
- Updated dependencies [0e1f269]
- Updated dependencies [5b1a788]
- Updated dependencies [d3b9057]
- Updated dependencies [4fe6756]
- Updated dependencies [9fa373d]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [ad10f82]
- Updated dependencies [4042637]
- Updated dependencies [46fcc7e]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [0d1c052]
  - @weasel-js/core@1.10.0
  - @weasel-js/geom@1.10.0

## 1.9.4

### Patch Changes

- b8e974c: `@weasel-js/kernel3d` no longer ships its own copy of React. `useOrbitTool` imports `useMemo`, the manifest did not declare `react`, and the build inlined it: `dist/index.js` carried React's production and development builds, so the hook ran on a copy of React the app's renderer never drives. `react` is now a peer dependency (`>=18`) and the bundle imports it; `dist/index.js` goes from 84 KB to 17 KB.
- Updated dependencies [6e2447b]
- Updated dependencies [9dfd8a5]
- Updated dependencies [4c4aa40]
- Updated dependencies [f17d213]
- Updated dependencies [7420a37]
- Updated dependencies [41a4b4e]
- Updated dependencies [50b294e]
- Updated dependencies [f7872a9]
- Updated dependencies [9d54d0a]
- Updated dependencies [0a2eba9]
- Updated dependencies [3df6f75]
- Updated dependencies [719b2eb]
- Updated dependencies [095c055]
- Updated dependencies [4b0688a]
- Updated dependencies [103f988]
- Updated dependencies [c567961]
- Updated dependencies [6ba9cad]
- Updated dependencies [3f18dbe]
- Updated dependencies [8d25bd4]
- Updated dependencies [bb078c0]
- Updated dependencies [663248a]
- Updated dependencies [c2a2a5d]
- Updated dependencies [92c8af4]
- Updated dependencies [9b4fc5c]
- Updated dependencies [e023a51]
- Updated dependencies [184be75]
- Updated dependencies [9ad839d]
- Updated dependencies [fb505bb]
- Updated dependencies [0aaeebc]
- Updated dependencies [e589003]
- Updated dependencies [ec79c3f]
- Updated dependencies [1c401e3]
- Updated dependencies [158e471]
- Updated dependencies [001aaae]
- Updated dependencies [a843f5a]
- Updated dependencies [2fda51b]
- Updated dependencies [557c01d]
- Updated dependencies [b370885]
- Updated dependencies [8a21a87]
- Updated dependencies [86fd792]
- Updated dependencies [8f23c57]
- Updated dependencies [eb123ad]
- Updated dependencies [f06caab]
- Updated dependencies [2b3b637]
- Updated dependencies [55fd8a6]
- Updated dependencies [fc8068c]
- Updated dependencies [efcb538]
- Updated dependencies [1268f79]
- Updated dependencies [452fffc]
- Updated dependencies [01f9a06]
- Updated dependencies [41bddcc]
- Updated dependencies [94abaef]
- Updated dependencies [20c2d26]
- Updated dependencies [f5d50b0]
- Updated dependencies [b39b0f3]
- Updated dependencies [eefcc9a]
- Updated dependencies [f66ec41]
- Updated dependencies [1896646]
- Updated dependencies [ccf595e]
- Updated dependencies [546fd8a]
- Updated dependencies [310c9db]
- Updated dependencies [ad0b554]
- Updated dependencies [7da269f]
- Updated dependencies [f21325d]
- Updated dependencies [bb5c5dc]
- Updated dependencies [04caa20]
- Updated dependencies [f12ac6a]
- Updated dependencies [8fca412]
- Updated dependencies [a2e0462]
- Updated dependencies [234f718]
- Updated dependencies [5e1cbe4]
- Updated dependencies [8fa3cbc]
- Updated dependencies [fb297fb]
- Updated dependencies [657872c]
- Updated dependencies [110142d]
- Updated dependencies [39b26f9]
- Updated dependencies [3a4fa8e]
- Updated dependencies [71f5742]
- Updated dependencies [e39b73c]
- Updated dependencies [cf3d535]
- Updated dependencies [7c2e054]
- Updated dependencies [243984f]
- Updated dependencies [c527f50]
- Updated dependencies [b8a988c]
- Updated dependencies [9e51015]
- Updated dependencies [ab164dd]
- Updated dependencies [68dcc32]
- Updated dependencies [20617cc]
- Updated dependencies [71f5742]
- Updated dependencies [07d7cfe]
- Updated dependencies [d490ebc]
- Updated dependencies [fc4676d]
- Updated dependencies [9d9eb3b]
- Updated dependencies [cc57bc6]
- Updated dependencies [420ba9c]
- Updated dependencies [abe11f9]
- Updated dependencies [316ecd0]
- Updated dependencies [fae67cb]
- Updated dependencies [b4f06f1]
- Updated dependencies [427ea6c]
- Updated dependencies [dcc041e]
- Updated dependencies [0a17152]
- Updated dependencies [f356bd0]
- Updated dependencies [9472e9a]
- Updated dependencies [928cafc]
- Updated dependencies [95e64cd]
- Updated dependencies [d01459d]
- Updated dependencies [1eee4df]
- Updated dependencies [cca79cf]
- Updated dependencies [5cd52f3]
- Updated dependencies [cad8bd9]
- Updated dependencies [190622a]
- Updated dependencies [36c6ca0]
- Updated dependencies [6983df3]
- Updated dependencies [399033f]
- Updated dependencies [2d1c6af]
- Updated dependencies [e31a360]
- Updated dependencies [33e0710]
- Updated dependencies [a8e964e]
- Updated dependencies [b444e46]
- Updated dependencies [e4d444f]
- Updated dependencies [bdf0a97]
- Updated dependencies [0641010]
- Updated dependencies [667ca34]
- Updated dependencies [e06409e]
- Updated dependencies [1268f79]
- Updated dependencies [4d559ca]
- Updated dependencies [60ac0a5]
- Updated dependencies [93780f6]
- Updated dependencies [188604d]
- Updated dependencies [036d768]
- Updated dependencies [9f70b3c]
- Updated dependencies [812118e]
- Updated dependencies [4bbffa2]
- Updated dependencies [e640378]
- Updated dependencies [ec5e31d]
- Updated dependencies [2db1963]
- Updated dependencies [20cb4c6]
- Updated dependencies [0a83dfb]
- Updated dependencies [b413e19]
- Updated dependencies [d8b791e]
- Updated dependencies [dc856b3]
- Updated dependencies [0b93821]
- Updated dependencies [8b405d0]
- Updated dependencies [6fd724f]
- Updated dependencies [a145539]
- Updated dependencies [279d88f]
- Updated dependencies [60edb93]
- Updated dependencies [66f7465]
- Updated dependencies [9c10943]
- Updated dependencies [e98e95b]
- Updated dependencies [8261c9c]
- Updated dependencies [4787e75]
- Updated dependencies [c2ec0c3]
- Updated dependencies [16559ef]
- Updated dependencies [ba7cc48]
- Updated dependencies [569a013]
- Updated dependencies [ac8491b]
- Updated dependencies [5601761]
- Updated dependencies [7123087]
- Updated dependencies [1ca2395]
- Updated dependencies [47d868f]
- Updated dependencies [77fe781]
- Updated dependencies [d18b041]
- Updated dependencies [97bcbef]
- Updated dependencies [a53f3da]
- Updated dependencies [cd5ff3e]
- Updated dependencies [ec3c147]
- Updated dependencies [24bdb50]
- Updated dependencies [5d1ffd6]
- Updated dependencies [6b42996]
- Updated dependencies [6122f67]
- Updated dependencies [50cb70e]
- Updated dependencies [e9a28a0]
- Updated dependencies [ea6842f]
- Updated dependencies [54faddb]
- Updated dependencies [0cf2bf4]
- Updated dependencies [c5389a8]
- Updated dependencies [a1ea9ff]
- Updated dependencies [8953d33]
- Updated dependencies [8d56051]
- Updated dependencies [d16306d]
- Updated dependencies [b931128]
- Updated dependencies [a200c36]
- Updated dependencies [2bbcc5a]
- Updated dependencies [d3635ee]
- Updated dependencies [2098025]
- Updated dependencies [6a4a8ad]
- Updated dependencies [5b8578a]
- Updated dependencies [d8e003d]
- Updated dependencies [b3b209e]
- Updated dependencies [72002f8]
- Updated dependencies [26c11b8]
- Updated dependencies [44e1258]
- Updated dependencies [40533db]
- Updated dependencies [d71fc46]
- Updated dependencies [4334f6d]
- Updated dependencies [bb28e63]
- Updated dependencies [3dff419]
- Updated dependencies [ba4684e]
- Updated dependencies [0d82f92]
- Updated dependencies [6befeae]
- Updated dependencies [7c45605]
  - @weasel-js/core@1.9.4
  - @weasel-js/geom@1.9.4

## 1.9.3

### Patch Changes

- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [7cb27b7]
- Updated dependencies [e05c820]
  - @weasel-js/core@1.9.3
  - @weasel-js/geom@1.9.3

## 1.9.2

### Patch Changes

- Updated dependencies [3ba97df]
- Updated dependencies [1b7af8d]
  - @weasel-js/core@1.9.2
  - @weasel-js/geom@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1
  - @weasel-js/geom@1.9.1

## 1.9.0

### Patch Changes

- c06cc26: Read action deps at their declared `DepSchema` types instead of casting them.
- Updated dependencies [c06cc26]
- Updated dependencies [dc5bcfc]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
- Updated dependencies [ad0da6c]
- Updated dependencies [2b03077]
- Updated dependencies [718769e]
- Updated dependencies [3088756]
- Updated dependencies [63d0bf8]
- Updated dependencies [4146713]
- Updated dependencies [24b2eaf]
  - @weasel-js/core@1.9.0
  - @weasel-js/geom@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [7e72192]
- Updated dependencies [bf522cf]
- Updated dependencies [c49c9e0]
- Updated dependencies [2123049]
  - @weasel-js/core@1.8.1
  - @weasel-js/geom@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [d24f51f]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
  - @weasel-js/core@1.8.0
  - @weasel-js/geom@1.8.0

## 1.7.3

### Patch Changes

- @weasel-js/core@1.7.3
  - @weasel-js/geom@1.7.3

## 1.7.2

### Patch Changes

- 88e298e: Remove `PoseDescriptor.intersectsRect`. Nothing in the kit has read it since marquee and lasso began testing a node's drawn outline, so the built-in descriptors (`RECT_POSE_DESCRIPTOR`, `ROTATED_POSE_DESCRIPTOR`, `pathPoseDescriptor`, the auto descriptor, and kernel3d's) no longer implement it. This is a breaking removal of a public field for anyone implementing a custom `PoseDescriptor`: an object literal typed as `PoseDescriptor` that still declares `intersectsRect` now fails the excess-property check. Delete the method; nothing called it.
- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [0756a82]
- Updated dependencies [b18ef4a]
  - @weasel-js/core@1.7.2
  - @weasel-js/geom@1.7.2

## 1.7.1

### Patch Changes

- Updated dependencies [6f59206]
- Updated dependencies [716ea36]
- Updated dependencies [2d7003a]
- Updated dependencies [e17fe2c]
- Updated dependencies [f457e7c]
- Updated dependencies [8635031]
- Updated dependencies [276bad1]
- Updated dependencies [efc5727]
- Updated dependencies [108551d]
- Updated dependencies [a5bc201]
- Updated dependencies [4e18c9f]
- Updated dependencies [112c781]
- Updated dependencies [ac2e76e]
- Updated dependencies [9c164e2]
- Updated dependencies [85d62a7]
- Updated dependencies [dfd926f]
- Updated dependencies [3d80c9f]
- Updated dependencies [a1ecaac]
- Updated dependencies [886fefd]
- Updated dependencies [04b0b96]
- Updated dependencies [27bcf57]
- Updated dependencies [a7f2103]
- Updated dependencies [b2fd89a]
- Updated dependencies [4212d2d]
- Updated dependencies [12263bc]
- Updated dependencies [b5cc59f]
- Updated dependencies [e2f1968]
- Updated dependencies [1524403]
- Updated dependencies [bfc4b21]
- Updated dependencies [f046160]
- Updated dependencies [9f83b33]
- Updated dependencies [3c1def2]
- Updated dependencies [ae6e8ac]
- Updated dependencies [4b570e5]
- Updated dependencies [251fb64]
- Updated dependencies [9bfdda9]
- Updated dependencies [b554ee0]
- Updated dependencies [702829d]
- Updated dependencies [9cad63b]
- Updated dependencies [b228015]
- Updated dependencies [53cdd41]
- Updated dependencies [33b7ac2]
- Updated dependencies [fa67cbf]
- Updated dependencies [8f68fa8]
- Updated dependencies [25448ee]
- Updated dependencies [88c1ae3]
- Updated dependencies [dcc9834]
- Updated dependencies [365c762]
- Updated dependencies [941e941]
- Updated dependencies [b20df31]
- Updated dependencies [55ef61f]
- Updated dependencies [712de19]
- Updated dependencies [67d95c8]
- Updated dependencies [8a68b6c]
- Updated dependencies [16a0476]
- Updated dependencies [6f03bf7]
- Updated dependencies [72379f6]
- Updated dependencies [7f7d153]
- Updated dependencies [d9cdff1]
- Updated dependencies [63d0ece]
- Updated dependencies [f8bde12]
- Updated dependencies [685a086]
- Updated dependencies [90a4686]
- Updated dependencies [7e08265]
- Updated dependencies [d60a422]
- Updated dependencies [dde2315]
- Updated dependencies [4cb55b7]
- Updated dependencies [fb21799]
- Updated dependencies [fe9a91e]
- Updated dependencies [3a68365]
- Updated dependencies [43ad590]
- Updated dependencies [4cef954]
- Updated dependencies [c4cc60f]
- Updated dependencies [6df279e]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
- Updated dependencies [5308126]
  - @weasel-js/core@1.7.1
  - @weasel-js/geom@1.7.1

## 1.7.0

### Patch Changes

- 42d2591: `useOrbitTool` returns the same tool on every render, as the kit's other tool hooks do. It built a new one each call, which — now that a tool redefined under the same id replaces the old one — rebuilt the canvas's tools every render and looped any canvas whose `onToolsCreated` sets state.
- Updated dependencies [b1142a7]
- Updated dependencies [96adc78]
- Updated dependencies [240138b]
- Updated dependencies [21ee45b]
- Updated dependencies [32bb3be]
- Updated dependencies [2e34d59]
- Updated dependencies [32c5fb4]
- Updated dependencies [0047d33]
- Updated dependencies [ad0378f]
- Updated dependencies [da20f95]
- Updated dependencies [b4227b8]
- Updated dependencies [0cecdcf]
- Updated dependencies [7c3cc5d]
- Updated dependencies [722b267]
- Updated dependencies [52078c5]
- Updated dependencies [197fdf7]
- Updated dependencies [5acf166]
- Updated dependencies [7f7b04f]
- Updated dependencies [fc3de06]
- Updated dependencies [b8f2007]
- Updated dependencies [fd178be]
- Updated dependencies [5201b8e]
- Updated dependencies [bc2a7ef]
- Updated dependencies [6819653]
- Updated dependencies [793987a]
- Updated dependencies [ca2f45f]
- Updated dependencies [082c63f]
- Updated dependencies [242e9f7]
- Updated dependencies [f8f0160]
- Updated dependencies [455e4bc]
- Updated dependencies [a028cc3]
- Updated dependencies
- Updated dependencies [667f14f]
- Updated dependencies [e442bcb]
- Updated dependencies [aad77d3]
- Updated dependencies [8999210]
- Updated dependencies [94cf4cd]
- Updated dependencies [d647c9b]
- Updated dependencies [d7aaeb1]
- Updated dependencies [38f524c]
- Updated dependencies [2336d9c]
- Updated dependencies [71d54e4]
- Updated dependencies [03e9385]
- Updated dependencies [8c1cd8d]
- Updated dependencies [d5a9fbf]
- Updated dependencies [3a20620]
  - @weasel-js/core@1.7.0
  - @weasel-js/geom@1.7.0

## 1.6.1

### Patch Changes

- Updated dependencies [b209a8e]
- Updated dependencies [7683659]
  - @weasel-js/core@1.6.1
  - @weasel-js/geom@1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [c373af4]
- Updated dependencies [bfe6a4f]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [0cf6a0d]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [5345efb]
- Updated dependencies [87fd8a8]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [debfd5d]
- Updated dependencies [d975afa]
- Updated dependencies [62d8d7c]
  - @weasel-js/core@1.6.0
  - @weasel-js/geom@1.6.0

## 1.5.2

### Patch Changes

- 24a2dae: Close the places where two tiers spelled one concept differently.
  
  **A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
  the world `drag.delta` and then divided by the zoom anyway, panning at
  1/scale² for any event source that supplies no `clientX`/`clientY` — which is
  every synthesized `InputEvent`, since those fields are optional. It now
  reconstructs the client delta exactly, by undoing each end of the world delta
  against the view that produced it.
  
  **Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
  carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
  `worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
  lands at the origin. All three now also carry `clientX`/`clientY`, so a
  context-menu action can finally read `ctx.screen` — the case that surface was
  added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
  affine in a file that imports from both. `translatePolygonInPlace` is
  gone: it was the one sanctioned writer into a committed path's coord buffer,
  documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
  in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
  `useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
  the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
  was declared and never written by anything; it is gone.
  
  **Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
  matching the reason `geom/3d` already gives for its own. `History.entries()`
  returns `readonly` arrays, which is what its docstring always asked callers to
  assume.
  
  **One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
  `Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
  `ScreenLength` rather than that union written out again. `kernel3d`'s
  `ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
  beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
  Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.
  
  **Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
  `@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
  `@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
  callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
  paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
  name the repack between the GL layout and geom's.
  
  **Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
  rotated no longer reports itself unrotated to `useResize` and to diagram's port
  placement. `ToolDef.capabilities` is documented as reaching
  `Tool.eligibility.capabilities`, which is where it actually goes — following
  the old text gave `undefined`, and `eligibleForMode` turns that into a tool
  that vanishes from every mode. `MultitouchEvent.centroid` is documented as
  canvas-local, which is what the dispatcher hands over. `drag.points` is a
  snapshot on `onEnd` rather than the dispatcher's live accumulator.
  
  `tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
  `loupe`, which it had never included.
- ad6c351: Give `Vec3` named fields, so both dimensions say `p.x`.
  
  `@weasel-js/geom`'s 2D tier has no point struct on purpose — it passes loose
  components so the f32-relative epsilon policy has nothing between it and the
  numbers — and `core` wraps those in `Vec2` at the API tier, where a call site
  reads better with names. `geom/3d` had to pack, since loose scalars stop
  working at four and sixteen components, but it packed into a tuple, and
  `@weasel-js/kernel3d` then re-exported that kernel type at its own public
  surface: `Pose3.position` and `Camera3d.target` were both `Vec3`.
  
  So at the position a consumer actually handles, 2D said `pose.x` and 3D said
  `pose3.position[0]`. Packing was forced; the tuple was not.
  
  `Vec3` is now `{ readonly x, readonly y, readonly z }`. The fields are readonly
  because the tuple's immutability was load-bearing: a pose in a history snapshot
  must not be writable through the value handed to a renderer. `Quat` stays a
  tuple — it is not a point, and `[x, y, z, w]` is the layout three.js and
  glMatrix both use.
  
  Breaking for anyone indexing a `Vec3`, which is why it is worth doing while the
  type is a week old.
- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [ad6c351]
  - @weasel-js/core@1.5.2
  - @weasel-js/geom@1.5.2

## 1.5.1

### Patch Changes

- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [f4049be]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [b6a5eed]
- Updated dependencies [98ad39c]
- Updated dependencies [67f3867]
- Updated dependencies [f663199]
- Updated dependencies [a80e8db]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [d963d14]
- Updated dependencies [edb825a]
- Updated dependencies [229a16a]
- Updated dependencies [f9feecc]
- Updated dependencies [b981856]
- Updated dependencies [0662a2d]
- Updated dependencies [c0fa540]
- Updated dependencies [21ce23e]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1
  - @weasel-js/geom@1.5.1

## 1.5.0

### Patch Changes

- 2f1ddd0: `@weasel-js/kernel3d` is a new package: poses, an orbit camera, ray picking and screen-projected chrome geometry over core's scene graph and dispatcher. It hosts a renderer rather than owning one — a consumer brings its own and the kernel hands it poses — and it takes core as a peer, the same tier `svg`, `diagram` and `loupe` sit in.
  
  Core took no diff for it. `Scene` is generic over its pose and holds a `Pose3` with no adapter; a 3D host passes the dispatcher an identity `clientToWorld` so `ctx.world` stays two numbers and each dep rebuilds the ray from the camera it closes over; tools transfer untouched. The two things that do not transfer are stated rather than guessed: `ViewApi` has no orientation, so the kernel declares a `camera3d` dep of its own, and `PoseDescriptor.remapBounds`/`fromBounds` throw, because a screen rectangle does not name a 3D pose without a depth.
  
  `@weasel-js/geom` gains a `./3d` subpath — vectors, quaternions, 4x4 matrices, ray/AABB and ray/plane intersection, and `transformAabb`. Dependency-free like the rest of the package, and immutable tuples rather than classes, so a pose survives `structuredClone` with its methods intact because it never had any.
  
  Two corrections to code promoted out of the 3D lab. `projectAabbToScreen` now clips each of the box's twelve edges against the near plane instead of dropping the corners behind it; the old behaviour reported a box too small for anything straddling the near plane, and reported almost nothing for a solid the camera sits inside. And the seam that says how big a node is now asks for its world box rather than a local one to transform: a sphere's box is the same under every rotation, and no transform of a local box reproduces that.
  
  `sceneFromJSON`'s `options` argument is now optional. Every field in it already was, so the natural one-argument call did not compile.
  
  Also new: a test that a quaternion pose survives `toJSON` and `sceneFromJSON` with its rotation intact. The claim that `Scene` is dimension-neutral had only ever been run against `setPose` and undo.
- aa45d32: `@weasel-js/geom/3d` now judges singularity the way the 2D kernel does: against the matrix's own scale, never against an absolute floor.
  
  - `invert` on a 4x4 compares the determinant with the product of the four column lengths. A uniformly tiny matrix, such as a scale of `1e-4`, now inverts; so does a projection with a very small near plane. A large matrix whose determinant is only rounding now returns `null`, and so does a matrix holding `NaN`, which used to come back as a matrix of `NaN`s.
  - `normalize` keeps the direction of any vector with a finite, non-zero length. It used to return the zero vector below a length of `1e-9`, which collapsed `lookAt` for a camera less than `1e-9` from its target.
  - `lookAt` returns a singular matrix when `up` is parallel to the view to within rounding, as it already did when exactly parallel.
  - `transformPoint` always divides by w. It used to skip the division below `|w| < 1e-9`, so a camera with a far plane beyond about `1e9` cast rays in the wrong direction.
  - `intersectRayAabb` and `intersectRayPlane` accept a direction of any length. A ray counts as parallel to a plane only to within rounding of its own length.
  - `EPS3` is removed. Nothing in the subpath uses an absolute tolerance any more. This is a breaking change for anything that imported it.
  
  In `@weasel-js/kernel3d`, `rayThroughScreenPoint` now returns `null` when the view-projection has no inverse or the pane has no area. It used to return a made-up ray from the eye straight down -z. This is a type-level breaking change. The built-in deps handle `null`: `createNodeAtPoint` picks nothing, `createInsert` inserts nothing, and the pose descriptor's `translate` keeps dragging through the last camera that did cast a ray. `projectAabbToScreen` no longer drops points closer to the eye than `1e-9`, so a scene at a tiny scale projects the same as it does at unit scale.
- a5f738a: Resolve a screen rectangle at a pose's own depth, and stop deriving a group's
  bounds from poses the kit cannot read.
  
  `kernel3d`'s `PoseDescriptor.remapBounds` and `fromBounds` threw: a rectangle on
  screen names a pose only once something says how far away it is. Both now
  resolve it on the plane through the pose they were handed, facing the camera, so
  neither changes depth. A resize scales uniformly — two screen extents cannot
  name three — and `fromBounds` returns a world-axis-aligned box whose third
  extent is the mean of the two the rectangle gives it.
  
  `core`'s `unionOfChildren`, which every scene carries under
  `kit:unionOfChildren`, read its members as rects with no check and produced a
  box of `NaN` in a scene posed otherwise. It now declines, and the container
  keeps its authored pose; `unionOfChildrenVia(descriptor)` remains the way to
  make such a container track its members.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [dd48085]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [aa45d32]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0
  - @weasel-js/geom@1.5.0
