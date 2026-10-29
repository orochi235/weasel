# @weasel-js/rig

## 1.14.1

### Patch Changes

- @weasel-js/animator@1.14.1
  - @weasel-js/core@1.14.1
  - @weasel-js/geom@1.14.1
  - @weasel-js/history@1.14.1
  - @weasel-js/icons@1.14.1
  - @weasel-js/prefs@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/registry@1.14.1
  - @weasel-js/renderer@1.14.1
  - @weasel-js/routing@1.14.1

## 1.14.0

### Patch Changes

- 5b7d0ac: Breaking: an immediate action's params carry the event's point as `world`, a `WorldPoint`, in place of `worldX`/`worldY`, and a click's press point as `press` in place of `pressX`/`pressY`. Read `params.world.x` where you read `params.worldX`, and pass `{ world: { x, y } }` where you passed `{ worldX: x, worldY: y }`: to `trigger`, as a menu's params, and to an invoker called directly. The new exported `ImmediateParams` type names every field the dispatcher puts in the bag; cast `params` to it to read them. `trigger` asks `enabled` at `params.world`. A parallax plane now carries `press` into the plane as it already did the release point. The align and flip actions' `'pointer'` reference reads `world` too. The input events themselves are unchanged: a `ClickEvent` still has `x`/`y` and `pressX`/`pressY`, and `useClipboardOps`' `paste(at)` keeps its `{ worldX, worldY }` shape.
- a58fb4f: Every reader of a `PolygonPath`'s coords now reads them where its `origin` puts them: hit-testing and marquee/lasso picking, distance, anchors (`pathToAnchors`, anchor editing, corner expansion and restore), the booleans, `pathToD` and SVG export, cubic contours, puppet meshes, pose interpolation, derived parts, path warps, diagram connectors, and skinning. `translatePath` and `rotatePathAround` move the origin rather than the coords, and `anchorsToPath` given `like` writes back from its origin. This adds API: `worldCoords`, `pathPoint`, `originOf`, `addOrigin` and `coordsFrom` read and write coords in a path's own space.
  
  Paths far from 0 now get an origin where they are made: past `ORIGIN_THRESHOLD` (16,384), `anchorsToPath` without `like` (the pen tool), `pathFromD`, the booleans, and SVG import measure the path from `originFor`, the rounded center of its points. `PathBuilder.autoOrigin()` and `transformPath`'s `{ autoOrigin: true }` opt a producer in. A path near 0 is built as before.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [cc0e73a]
- Updated dependencies [d6221a7]
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
- Updated dependencies [a40d519]
- Updated dependencies [2993216]
- Updated dependencies [61e07e5]
- Updated dependencies [a64647a]
- Updated dependencies [7b048f4]
- Updated dependencies [aba8563]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [8ef803d]
- Updated dependencies [2f3d924]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [7cc9da9]
- Updated dependencies [2692828]
- Updated dependencies [767713e]
- Updated dependencies [2232189]
- Updated dependencies [6a69c27]
- Updated dependencies [8763fc3]
- Updated dependencies [b0a55a6]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
- Updated dependencies [a370edb]
- Updated dependencies [e7fca17]
- Updated dependencies [1d39cf6]
- Updated dependencies [e5ea7e8]
- Updated dependencies [f7c49b7]
- Updated dependencies [22472a1]
- Updated dependencies [ec6d7d3]
- Updated dependencies [80789ff]
- Updated dependencies [f695cff]
- Updated dependencies [b1b16ce]
- Updated dependencies [b15704a]
- Updated dependencies [4aa138a]
- Updated dependencies [81d08f7]
- Updated dependencies [e7d70f5]
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
- Updated dependencies [941f382]
- Updated dependencies [9ef7751]
- Updated dependencies [34a364e]
- Updated dependencies [561472d]
- Updated dependencies [c66c536]
- Updated dependencies [cbb344e]
- Updated dependencies [4c0141f]
- Updated dependencies [d3fdba8]
- Updated dependencies [f9282f7]
- Updated dependencies [0509c29]
- Updated dependencies [3803ba2]
- Updated dependencies [01b103e]
- Updated dependencies [9819d7a]
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
- Updated dependencies [95eb9d3]
- Updated dependencies [7507e13]
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
  - @weasel-js/animator@1.14.0
  - @weasel-js/renderer@1.14.0
  - @weasel-js/routing@1.14.0
  - @weasel-js/geom@1.14.0
  - @weasel-js/prefs@1.14.0
  - @weasel-js/react@1.14.0
  - @weasel-js/history@1.14.0
  - @weasel-js/icons@1.14.0
  - @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
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
- Updated dependencies [1f2a0b3]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/routing@1.13.0
  - @weasel-js/core@1.13.0
  - @weasel-js/renderer@1.13.0
  - @weasel-js/prefs@1.13.0
  - @weasel-js/geom@1.13.0
  - @weasel-js/animator@1.13.0
  - @weasel-js/history@1.13.0
  - @weasel-js/icons@1.13.0
  - @weasel-js/react@1.13.0
  - @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
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
- Updated dependencies [1f2a0b3]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/animator@1.13.0-rc.0
  - @weasel-js/routing@1.13.0-rc.0
  - @weasel-js/prefs@1.13.0-rc.0
  - @weasel-js/renderer@1.13.0-rc.0
  - @weasel-js/history@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- Updated dependencies [dbd6711]
- Updated dependencies [f6db995]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [2cf7da4]
- Updated dependencies [92a0f2d]
- Updated dependencies [448065a]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [929736f]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [eec50d7]
  - @weasel-js/geom@1.12.0
  - @weasel-js/routing@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/renderer@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/animator@1.12.0
  - @weasel-js/prefs@1.12.0
  - @weasel-js/history@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 683dea0: New package, `@weasel-js/rig`: the bone and weight tools, with the actions they bind, moved out of
  core. `useRigTools({ scene })` builds both for `<SceneCanvas tools>`, keyed by the ids `RIG_TOOLS`
  names; they act on the rig the scene's selection names unless given `selection` or `rig`, and take
  `state`, `reach` and `radius` as `toolOptions.rig` and `toolOptions.weight` used to. `useBoneTool`,
  `useWeightTool`, `createRigEditState`, `placedRig`, `rigOfSelection`, the two overlays and
  `weighedPaths` come from it too, and its glyphs are `rig:bone` and `rig:weight`.
  
  **Breaking for core:** `<SceneCanvas>` no longer mounts the rig tools. `'bone'` and `'weight'` are
  gone from `BuiltinToolId`, `BUILTIN_TOOLS` and `BUILTIN_TOOL_IDS`, `RIG_TOOLS` and every name above
  are gone from core's barrel, and so are `toolOptions.rig`, `toolOptions.weight` and the
  `core:bone` and `core:weight` glyphs. The kit settings `targets.boneJointRadiusPx` and
  `targets.weightPointRadiusPx` keep their paths, but are declared by `@weasel-js/rig` and listed in
  its `rigKitSettingsSchema` rather than `coreKitSettingsSchema`. Core keeps the rig itself:
  `useRigNode`, `bindRig`, `placeSkeleton` and the rest bind a skeleton from scene data as before.
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
- Updated dependencies [5cdc3d0]
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
- Updated dependencies [995eac7]
- Updated dependencies [ee2f0fc]
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
- Updated dependencies [8cd81e7]
- Updated dependencies [b7e6edc]
- Updated dependencies [c29ac84]
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [f148f50]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/routing@1.11.1
  - @weasel-js/core@1.11.1
  - @weasel-js/animator@1.11.1
  - @weasel-js/renderer@1.11.1
  - @weasel-js/history@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/registry@1.11.1
