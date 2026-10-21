# @weasel-js/symmetry

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
