# @weasel-js/symmetry

## 1.15.1

### Patch Changes

- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [8ad43af]
- Updated dependencies [120420a]
- Updated dependencies [e982d8a]
  - @weasel-js/core@1.15.1
  - @weasel-js/geom@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [8461e7b]
- Updated dependencies [70a64a3]
- Updated dependencies [f77e789]
- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [30bf607]
- Updated dependencies [0e60598]
- Updated dependencies [48b6c4c]
- Updated dependencies [a1cb281]
- Updated dependencies [c41c917]
- Updated dependencies [d25ad30]
- Updated dependencies [1de1aab]
- Updated dependencies [fce0494]
- Updated dependencies [746fab0]
  - @weasel-js/core@1.15.0
  - @weasel-js/geom@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [012cae5]
- Updated dependencies [ae38d2e]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
  - @weasel-js/core@1.14.2
  - @weasel-js/geom@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/core@1.14.1
  - @weasel-js/geom@1.14.1

## 1.14.0

### Patch Changes

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
- 12dcc21: Add a `wallpaper` symmetry kind, which tiles a group's contents across a lattice. The spec's
  `spacing`, `angle`, `rowSpacing`, and `rowAngle` set the lattice, its `extent` is the box around the
  center the lattice fills, and its `cell` draws one of the turning or reflecting kinds about every
  lattice point, turned `cellAngle` from the lattice. `wallpaperSpec(name, spacing)` gives the fields
  for fifteen of the seventeen wallpaper groups, listed in `WALLPAPER_GROUPS`. The guide outlines the
  extent, dots the lattice, and adds a handle for the row.
  
  `SymmetryKindDef` loses `group` in favor of `pointGroup`, the copies that keep the center fixed,
  which path edits now read. This is a breaking change for code that read `group`.
- 304dd60: `WALLPAPER_GROUPS` now has all seventeen wallpaper groups: pgg and p4g join it. They use a new optional `SymmetrySpec.glideRows`, which makes a wallpaper's glide mirror every other row rather than every other column; on a lattice whose rows are offset, that puts the glide axes between the rows, which is what those two groups need. A spec without it behaves as before.
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
- Updated dependencies [9ef7751]
- Updated dependencies [34a364e]
- Updated dependencies [4c0141f]
- Updated dependencies [f9282f7]
- Updated dependencies [01b103e]
- Updated dependencies [2e4943e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8e2c8c8]
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

## 1.13.0

### Patch Changes

- ed89d42: A node clips its children only when it declares a clip. Breaking: a group no longer clips its children to its outline by default, and nothing else does either. A node clips its children to its `clipFromPose` when it has one, or to its outline when it sets the new `clip: 'outline'` field. Its own paint, under its children or over them, is not clipped by its own clip. That outline is the silhouette of whichever painter claims the node, the rect fallback's box included, read by the new `clipOutline(node, pose)`. `clip` is saved and loaded, copied, pasted and undone like the node's other fields, and `NodeClip` names its type.
  
  Scenes saved at version 1 keep their look: a version 1 container that loads as a group, as it does by default, gets `clip: 'outline'` when it has no clip function or a load skips its clip key. One that `classifyV1` makes a mark gets no implicit clip, since the loader cannot know which painter will claim it; set `clip` on it where it should clip. Version 2 scenes saved by builds between the version 2 format and this change are read as written, so a group there that relied on the old default clip draws its children unclipped.
  
  - `clipNothing` and symmetry's `SYMMETRY_CLIP_KEY` stay registered so saves naming them load; diagram bodies and symmetry groups no longer set a clip, and `@weasel-js/diagram`'s `BodyNodeSpec` drops its `clipFromPose` field.
  - Baking a symmetry group carries each copied node's pose through the copy's transform, its clip with it, and copies a mark's children and every node's stated fields (`pickable`, `hidden`, `units`, `clip`). A mirrored copy of a clipping group used to clip its content away.
  - `statedFields(node)` and `StatedNodeFields` are exported: the plain optional fields a copy of a node carries.
  - `@weasel-js/svg`: an imported `<g clip-path>` is a group with `clip: 'outline'` (`SvgSceneDraft` carries `clip` on a group). The export writes a clip only for a node that declares one, clipped to the same `clipOutline` the canvas uses; a group holding `data.path` without `clip` exports unclipped. A mark with children now exports as a `<g>` holding its own element and then its children, which were left out before; its declared clip and copies apply to its children only. `SvgKitTreeNode` takes `clip`.
  - `@weasel-js/diagram-formats`: a page export writes a diagram box as its outline followed by its rows, with no special case for diagram nodes.
  - `specsFromSerialized` is exported, with `SpecsFromSerializedOptions`. Its `unknownKeys: 'skip'` loads a node whose registry key is unknown without that function instead of throwing, and `onSkip` hears each key left out as a `SkippedKey`. `sceneFromJSON` takes both options, and `scene.loadState(json, opts)` takes them as a second argument.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- 7e7549c: A group now selects as one item:
  
  - A press on a group's member selects the group, and so does a right-click, whose menu is the group's own. A drag from a member moves the group.
  - A double-click on a member enters the group, drawn with a dashed frame; a press then selects among its members, and a further double-click goes one level deeper. Escape leaves one level. Both work under any tool. While a group is entered only what is inside it can be pressed, marqueed, lassoed or selected with Select All. Under the select tool a press outside the entered group's box, with or without modifiers, leaves every group that box is outside of and selects nothing; that leave is its own binding, `group.leave.press`, which `bindingOverrides` can rebind or remove. Under a drawing tool the press draws, and what is drawn or pasted lands in the entered group: core now sources the `insertInto` dep from it, under any source registered after it, and `sceneToAdapter`'s new `pasteInto` option says where a paste lands. A double-click on a member that is not a group still reaches text and path editing, and an open mode takes Escape before the group does.
  - Cmd-click (Ctrl on Windows and Linux) selects the node under the pointer past every group. It no longer extends the selection: Shift-click does that, and Cmd-Shift-click adds the node under the pointer past every group.
  - The entered group is session state beside the selection: undo does not move it. `<SceneCanvas>` publishes it as the optional `enteredGroup` dep, and an absent dep means no group is entered. `<SceneCanvas enteredGroup>` takes an `EnteredGroupApi` made with `useEnteredGroup(scene)`, as `selection` is passed, for an app that reads or drives it; without it the canvas keeps its own. `leaveAll()` leaves every level at once.
  - `createEnteredGroupScope({ entered, scene })` returns a `NodeScope` (from `@weasel-js/modes`, which `ScopingDim` now extends) for the entered group, everything outside it dimmed to `OUT_OF_SCOPE_ALPHA`. Compose its `alphaFor` into `<SceneCanvas alphaFor>` and pass it in `redrawOn` to dim what is outside the group.
  - The entered-group frame takes its color from the `--wzl-entered-group` override hook on the canvas or any element above it, and repaints when a theme, mode or class attribute changes there or the system color scheme flips.
  - A contribution's dep source may read the source it displaces: `ContributionDeps` entries take the `below` argument `DepSource` does. The symmetry contribution's `insertInto` falls through to it when no symmetry group is active.
  - `workspaceTintLayer` takes a `fallback` tint, shown when the mode has none.
  
  Breaking: isolation mode is gone. `ISOLATION` is no longer exported from `@weasel-js/modes` and `DEFAULT_MODES` no longer holds it, and `<SceneCanvas isolatedGroup>` is removed: the entered group is the one way of working inside a group. In WeaselDraw a double-click on a group's member now enters the group, dims everything outside it, tints the workspace, and names the group in the breadcrumb. Edits made inside it are each their own undo step, where isolation by default collected them into one entry on leaving, and path and text editing open inside the group without leaving it.
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
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
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [4c113da]
  - @weasel-js/core@1.13.0
  - @weasel-js/geom@1.13.0

## 1.13.0-rc.0

### Patch Changes

- ed89d42: A node clips its children only when it declares a clip. Breaking: a group no longer clips its children to its outline by default, and nothing else does either. A node clips its children to its `clipFromPose` when it has one, or to its outline when it sets the new `clip: 'outline'` field. Its own paint, under its children or over them, is not clipped by its own clip. That outline is the silhouette of whichever painter claims the node, the rect fallback's box included, read by the new `clipOutline(node, pose)`. `clip` is saved and loaded, copied, pasted and undone like the node's other fields, and `NodeClip` names its type.
  
  Scenes saved at version 1 keep their look: a version 1 container that loads as a group, as it does by default, gets `clip: 'outline'` when it has no clip function or a load skips its clip key. One that `classifyV1` makes a mark gets no implicit clip, since the loader cannot know which painter will claim it; set `clip` on it where it should clip. Version 2 scenes saved by builds between the version 2 format and this change are read as written, so a group there that relied on the old default clip draws its children unclipped.
  
  - `clipNothing` and symmetry's `SYMMETRY_CLIP_KEY` stay registered so saves naming them load; diagram bodies and symmetry groups no longer set a clip, and `@weasel-js/diagram`'s `BodyNodeSpec` drops its `clipFromPose` field.
  - Baking a symmetry group carries each copied node's pose through the copy's transform, its clip with it, and copies a mark's children and every node's stated fields (`pickable`, `hidden`, `units`, `clip`). A mirrored copy of a clipping group used to clip its content away.
  - `statedFields(node)` and `StatedNodeFields` are exported: the plain optional fields a copy of a node carries.
  - `@weasel-js/svg`: an imported `<g clip-path>` is a group with `clip: 'outline'` (`SvgSceneDraft` carries `clip` on a group). The export writes a clip only for a node that declares one, clipped to the same `clipOutline` the canvas uses; a group holding `data.path` without `clip` exports unclipped. A mark with children now exports as a `<g>` holding its own element and then its children, which were left out before; its declared clip and copies apply to its children only. `SvgKitTreeNode` takes `clip`.
  - `@weasel-js/diagram-formats`: a page export writes a diagram box as its outline followed by its rows, with no special case for diagram nodes.
  - `specsFromSerialized` is exported, with `SpecsFromSerializedOptions`. Its `unknownKeys: 'skip'` loads a node whose registry key is unknown without that function instead of throwing, and `onSkip` hears each key left out as a `SkippedKey`. `sceneFromJSON` takes both options, and `scene.loadState(json, opts)` takes them as a second argument.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- 7e7549c: A group now selects as one item:
  
  - A press on a group's member selects the group, and so does a right-click, whose menu is the group's own. A drag from a member moves the group.
  - A double-click on a member enters the group, drawn with a dashed frame; a press then selects among its members, and a further double-click goes one level deeper. Escape leaves one level. Both work under any tool. While a group is entered only what is inside it can be pressed, marqueed, lassoed or selected with Select All. Under the select tool a press outside the entered group's box, with or without modifiers, leaves every group that box is outside of and selects nothing; that leave is its own binding, `group.leave.press`, which `bindingOverrides` can rebind or remove. Under a drawing tool the press draws, and what is drawn or pasted lands in the entered group: core now sources the `insertInto` dep from it, under any source registered after it, and `sceneToAdapter`'s new `pasteInto` option says where a paste lands. A double-click on a member that is not a group still reaches text and path editing, and an open mode takes Escape before the group does.
  - Cmd-click (Ctrl on Windows and Linux) selects the node under the pointer past every group. It no longer extends the selection: Shift-click does that, and Cmd-Shift-click adds the node under the pointer past every group.
  - The entered group is session state beside the selection: undo does not move it. `<SceneCanvas>` publishes it as the optional `enteredGroup` dep, and an absent dep means no group is entered. `<SceneCanvas enteredGroup>` takes an `EnteredGroupApi` made with `useEnteredGroup(scene)`, as `selection` is passed, for an app that reads or drives it; without it the canvas keeps its own. `leaveAll()` leaves every level at once.
  - `createEnteredGroupScope({ entered, scene })` returns a `NodeScope` (from `@weasel-js/modes`, which `ScopingDim` now extends) for the entered group, everything outside it dimmed to `OUT_OF_SCOPE_ALPHA`. Compose its `alphaFor` into `<SceneCanvas alphaFor>` and pass it in `redrawOn` to dim what is outside the group.
  - The entered-group frame takes its color from the `--wzl-entered-group` override hook on the canvas or any element above it, and repaints when a theme, mode or class attribute changes there or the system color scheme flips.
  - A contribution's dep source may read the source it displaces: `ContributionDeps` entries take the `below` argument `DepSource` does. The symmetry contribution's `insertInto` falls through to it when no symmetry group is active.
  - `workspaceTintLayer` takes a `fallback` tint, shown when the mode has none.
  
  Breaking: isolation mode is gone. `ISOLATION` is no longer exported from `@weasel-js/modes` and `DEFAULT_MODES` no longer holds it, and `<SceneCanvas isolatedGroup>` is removed: the entered group is the one way of working inside a group. In WeaselDraw a double-click on a group's member now enters the group, dims everything outside it, tints the workspace, and names the group in the breadcrumb. Edits made inside it are each their own undo step, where isolation by default collected them into one entry on leaving, and path and text editing open inside the group without leaving it.
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
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0

## 1.12.0

### Patch Changes

- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- f461572: `DiagramView` now draws a node's perimeter port labels. A node's `portLabels` are children of its
  container and sit outside its box, and a container clips its children to its painter's
  silhouette, so every one of them was clipped away. `buildBody` now gives the container a `clipFromPose` that clips nothing.
  
  Core exports that clip as `clipNothing` (from `@weasel-js/core` and `@weasel-js/core/math`),
  for any container whose children may draw outside it. Every scene's registry carries it under
  `CLIP_NOTHING`, so a container using it saves and loads with no registry entry of the consumer's.
  A symmetry group now uses it too, and still saves under `SYMMETRY_CLIP_KEY`.
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

## 1.11.1

### Patch Changes

- 2b267d5: Snap pipeline follow-ups.
  
  - kernel3d's `createSnap` takes `kitSettings` and reads its reach from `targets.snapPx` there, as a canvas does (`reachPx` still overrides it).
  - Two snap sources sharing an id now throw, on a canvas when a gesture begins and in kernel3d's `createSnap`, where before the later one silently replaced the earlier: a `<SceneCanvas snap>` source and a preset's alignment source were the likely pair, and the page box went with it. A source still replaces one of the canvas's defaults (`'rotation'`, `'path-snap'`) by taking its id. Core exports the check as `assertSnapSourceIds`.
  - The symmetry axis knob and a repeat's step handle turn through a `rotate` session on the `snap` dep: they now snap to quarter turns and other nodes' angles without Shift, Shift keeps the 15° steps, Ctrl suspends snapping, and the angle readout draws. Breaking: `handleChange` takes a `SymmetryHandleSnap` (`{ point, angle }`, new export) in place of its `stepped` flag and point function. Without a `snap` dep the handles do not snap, Shift included.
  - `resolveSnap` keeps every required candidate past `poolSize`, so Shift's steps can no longer be crowded out by 24 nearer targets, and drops a candidate with a non-finite locus direction instead of treating its line as a point.
  - A move begins its snap session once the drag passes its threshold, so a click on a selected body reads nothing for snapping, and its `geometry` probe is placed within the canvas's reach rather than a fixed 8px.
- 0cf0f52: The symmetry guide's angle knob no longer sits on the shapes it turns. It stays `knobDistancePx` out while the group's contents are nearer than that, and otherwise moves out past the farthest of them, clear by twice the hit radius. `SymmetryGuideSource.current()` may return `reach`, the world distance from the center to the farthest point of the contents (`createSymmetry` fills it in), and `guideHandles` takes it and the clearance as optional trailing arguments.
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

## 1.11.0

### Patch Changes

- 7904ef3: `bakeSymmetry` copies every leaf whose pose is a box, text and images included. A copy keeps its leaf's data, and its pose is carried through the copy's turn or mirror as a `rotation` and `transform` (`carryPose`, exported), so a paint laid out in the shape's box, a gradient say, turns and mirrors with it the way the live copy drew it. A path copy no longer has its outline rewritten into world coordinates. `skipped` now names only leaves whose pose is not a box.
- Export three types that public signatures already named: `PreviewPathsDep` (the `previewPaths` action dep), `EditingDrawOne` (`useSceneTextEdit`'s `drawOne`), and `BoxPose` (what `carryPose` takes).
- 0430dcc: Every type a public signature names is now exported, so the API reference links it. Signatures that named a file-local point alias (`Pt`, `XY`, `Vec`) take geom's `Point`, and ones that named a local `AnyScene` or `AnyNode` say `Scene<unknown, string, unknown>` or the node type outright. Newly exported: core's `AnnotationFlag`, `AnchorEdit`, `JoinPlan`, `PathEditPreview`, `PathStorageKind`, and `ViewPoseAdapter`; diagram's `RoutedScene`; prefs' `UsePrefsStoreOptions`; symmetry's `SymmetryKindDef`; path-tools' `WarpToolOptions`; and ui's `SceneLayerListProps`.
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
- ecdf4d0: Symmetry groups work in a scene that composes frames. Moving a group's center leaves its contents where they drew, though their stored poses are in the group's frame, and `bakeSymmetry` writes every original and copy as a pose local to its new parent. Core exports `scenePoseAdapter`, the `PoseAdapter` over a scene that `composeWorldPose` and `rebaseLocalPose` take.
- baaa5cf: The package description no longer says "No React." Importing `@weasel-js/symmetry` loads `@weasel-js/core`, which loads React.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [ed0e096]
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
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [e4642bb]
- Updated dependencies [e901a2b]
- Updated dependencies [57725cc]
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
  - @weasel-js/core@1.11.0
  - @weasel-js/geom@1.11.0

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- e962494: New package, `@weasel-js/symmetry`: live symmetry groups. A group's copies (a mirror at any angle, both axes, a point, radial, kaleidoscope, or a repeat with an optional glide) are drawn from its real children. Every edit to a child therefore reaches every copy, a click on a copy selects the child it copies, and `bakeSymmetry` turns the copies into real nodes. `createSymmetry(scene).contribution` draws the guide with draggable center, axis, and step handles, sends every tool's shapes into the active group, and keeps a path that is its own image under its group symmetric while its anchors are dragged or nudged.
  
  Core gains what the package is built on, and each piece is usable on its own:
  
  - `ContainerNode.copiesFromPose`: a container draws its subtree again under each affine it returns. Hit tests reach into the copies, and the clip travels with each one. Additive.
  - The `insertInto` dep: the container the `insert` dep puts new nodes into.
  - The `pathSymmetry` dep: transforms that anchor drags and nudges keep a path symmetric under.
  
  `@weasel-js/geom` adds `anchorSymmetry`, `anchorSymmetries`, `translateAnchorsSymmetric`, and `moveHandleSymmetric`. `@weasel-js/svg` writes a container's copies as transformed groups.
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
