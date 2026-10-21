# @weasel-js/guides

## 1.11.0

### Patch Changes

- 4447e67: A canvas host given no `width`/`height` fills its parent and follows it as it resizes: `Canvas`,
  `SceneCanvas`, `LeanSceneCanvas`, `DrawCanvas`, `SceneViewCanvas` and `MinimapCanvas`, each with a new
  `onResize` reporting every size. Nothing paints until the first measure. On a resize the view keeps
  its transform, so more or less of the world shows; `DiagramView` and `EffectChart` refit until the
  user pans or zooms, and `MinimapCanvas` refits its overview. `DrawCanvas`'s `draw(size)` gets the
  measured size. Core exports `SurfaceSizeProps` and `viewportWorldRect`; labkit's
  `TrialSceneCanvas` fills through `SceneCanvas` instead of measuring its own trial.
  
  `createGridLayer`'s `bounds` is now optional and receives the paint's view and canvas size. Omitted,
  the grid covers whatever the canvas shows, its lines held on world multiples of `spacing` as the view
  pans, and any set of lines that would sit closer than 4px on screen is left out.
- 679138c: A scene node can be hidden or locked on its own, not only through its layer. `SceneNode.hidden` keeps a node and its whole subtree from being drawn; `SceneNode.locked` keeps a node and its subtree drawn but out of reach, the way a locked layer's nodes are. Both are set through `scene.setHidden(id, hidden)` and `scene.setLocked(id, locked)`, each one undo step that neither lock blocks, or through the new `createSetHiddenOp` / `createSetLockedOp` against an adapter's `setHidden` / `setLocked`. Both go on `AddNodeSpec`, ride a snapshot, and come back with an undone removal. Additive.
  
  `scene.isHidden(id)` is new, and `scene.isLocked(id)` now folds in the node flags. Both answer from `nodeGates`, now exported with `isNodeHidden`, `isNodeLocked` and `hidesSubtree`, which every reader asks: painting, point picking, the marquee and lasso, select-all, path snapping, measurement picking and snapping, sibling spacing guides, the slice and Girth tools, and text editing all pass over a hidden node, and the pickers over a locked one. The selection now drops a hidden node as it drops a locked one, so hiding a layer or a node deselects what it hides.
  
  `@weasel-js/svg`: `svgNodesFromKit` writes a node carrying `hidden` with `display="none"`, which `parseSvg(…, { keepHidden: true })` reads back as hidden, and `unpackSvgFiles` now keeps a dropped file's hidden content, inserting it hidden rather than leaving it out.
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
- e287da2: Spacing hints, as one preset. `createSpacingHintsPreset()` is a `<SceneCanvas features>` entry: a move snaps the selection so its gap to a neighbor equals one already between its siblings and marks the equal gaps, and holding Alt over a shape measures its distance from the selection. Options turn off the spacing snap or the readout, add snapping to siblings' edges and centers, and set the snap distance and color. Turning it off is leaving it out of `features`.
  
  A `FeaturePreset` can now carry `moveBehaviors`, folded into every move the presets' ambient bindings run, after the select tool's own.
  
  The pieces are exported too. `measureDistances(from, to)` returns the gaps between two boxes on each axis where they separate, or from an inner box to the edges of the one holding it, as `SpacingGap`s, with leader lines where a gap runs past its target. `distanceReadout()`, which the preset brings, is a surface contribution for `<SceneCanvas ambient>`: while Alt (or the `modifier` given) is held over a shape, it draws the distances from the selection to that shape. `siblingBounds`, `worldBoundsOf`, and `worldUnionOf` read world boxes off a scene; `siblingBounds` is the boxes equal spacing measures while some ids move.
  
  A modifier going down or up over a resting pointer now dispatches a `hover`, with the new modifiers, so a hover binding that needs a key held answers it without waiting for the pointer to move.
  
  Core exports `scenePoseFrame` and `PoseFrame`: world reads and local writes over a scene's own composition.
- 70fe7cc: A stroked shape's box now includes its stroke as drawn, engine-wide. The selection outline and handles sit on the stroke's outer edge (align, joins, markers, variable widths, and screen-pixel widths at the view's scale all counted), and a group's box reaches as far as its members' strokes. Resizing moves that box and keeps the stroke's width, so the stroke's outer edge lands under the pointer: a 100×100 rect with a centered stroke 10 wide shows a 110×110 box at (−5, −5), and dragging its right handle to x = 205 leaves the rect 200 wide. Resize constraints see the box with the stroke. Rotate turns a selection about the center of that box, and flip, align, distribute, and alignment snapping measure it too. Stored geometry is unchanged: a group's derived pose, booleans, outlines, and export still read the pose box.
  
  This changes behavior for any stroked shape. `<SceneCanvas geometry={{ boundsIncludeStroke: false }}>` restores geometric boxes; actions read it as the new `boundsIncludeStroke` dep.
  
  New in core: `drawnBoundsOf`, `drawnAABBOf`, and `inkExtentsOf` answer the box for any scene node, and `NodeShapeEntry.drawnBounds` lets a painter report its own (the built-in shape and path painters measure miter joins and markers on polygons, stars, and paths). `GestureFrames.drawnBounds` hands that box to gesture behaviors. `SceneCanvasGeometry` names the `geometry` prop's type. A variable-width stroke's picking reach now uses its widest vertex.
  
  `@weasel-js/guides`: pass `drawnAABBOf` boxes to `deriveAlignmentGuides` so siblings are measured the same way as the dragged selection.
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

- 92e6291: A container's layout is the one its scene node declares, and nothing else. The `layouts` prop of `<SceneCanvas>` and the `layouts` option of `sceneToAdapter` and `useSceneAdapter` are removed, along with `useLayoutArrivals`, `layoutArrivalHandler`, `LayoutSource`, and `LayoutArrivalOptions`, which existed to carry that map into the scene's layout pass.
  
  Breaking: declare the layout on the node (`scene.add({ kind: 'container', layout })`) or set it with `scene.setLayout(id, layout)`, which is undoable. The scene's own layout pass arranges it, measured by `useScene({ layoutFrame })`; a canvas's `poseDescriptor` no longer measures a layout, so a scene whose poses are not rects passes `layoutFrame`. `scene.setArrivalHandler` is unchanged.
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

- de319ce: Types a public signature names are exported now, so a consumer can write them down and the API reference links to them. All additions; nothing is renamed or removed.
  
  - core: `ViewLike`, `TargetTransform`, `WeightEnv`.
  - diagram: `DiagramRouter`, `DiagramTextStyle`, `DiagramDerivePose`, `Forest`.
  - font: `DynamicFace`.
  - forge: `ArgCondition`, `ComponentHistory`, `StoryGlobals`, `StoryLayout`, `StoryViewport`, `TimelineSpan`; from `/frame`, `Channel`, `ToFrame`, `FromFrame`, `ConfigAnswers`, `FaultPhase`; from `/shell`, `StoryRegistryOptions`, `StoryChanges`, `IndexEntry`, `CssVarReport`, `TrialFrameCalls`, `Libraries`, `SchemaDescription`, `DescribedShape`, `DescribedEntry`, `SectionDescription`.
  - guides: `SnapToGuidesInsertArgs`, `SnapToGuidesMoveArgs`, and `SnapToGuidesResizeArgs`, each from its own subpath.
  - hud: `AttachHudOptions`, `SourceRect`, `LoupeBaseOptions`.
  - labkit: `MarkPose`, `AnnotationStorage`, `PaintedMark`, `ControlPanelProps`, `ControlPack`, `LoupeBindings`; from `/state`, `InstrumentHooks`; from `/config`, `Branching`, `Fields`, `FieldValues`, `Variants`, `VariantValues`.
  - paint: `InCommandUnits`, `WithPatternHandle`.
  - quantity: `FractionOptions`.
  - renderer: `ShaderStage`, `UniformArray`.
  - routing: `ToolScopes`.
  - svg: `SvgDraftPose`.
  - text-dom: `OverlayRunBase`.
  - theme: `DtcgDocument`; from `/engine`, `SemanticCommon`, `DtcgGroup`, `DtcgAxesExtension`, `DtcgLayer`.
  - ui: `ButtonBase`, `ButtonRegular`, `ButtonIconOnly`, `ToggleBarCommonProps`, `ToastFn`, `Fold`, `DistributiveOmit`, `WalkCtx`, `OverlayPoint`, `DocumentCodec`, `OpenedDocument`, `SchemaRoot`, `AnyNode`, `CurveSamplePoint`.
  
  The names for types that had none of their own to export under (`StoryGlobals`, `TimelineSpan`, `CurveSamplePoint`, the `Diagram*` three, `ShaderStage`, `DtcgGroup`, `ToggleBarCommonProps`) were chosen by an agent.
- 3a92afc: Breaking: the paint model's serialized shape changed in three ways, and its type names in two. Nothing reads the old shapes.
  
  **A fill is a record holding a paint, as a stroke is.** Every `fill` slot now takes a `Fill`, `{ paint?: Paint }`, where it took a bare paint: node data, draw commands (`CommandFill`), text styles and runs, and the affordance and overlay paint options. `fill: { color: '#abc' }` becomes `fill: { paint: { color: '#abc' } }`, beside `stroke: { paint: { color: '#000' }, width: 2 }`. `fill: null` still means no fill, and a fill with no `paint` paints nothing. `commandFill(fill, box)` resolves a node's fill for a draw command the way `commandStroke` resolves its stroke; resolving a bare paint is `commandPaint`.
  
  **A paint names its variant under `kind`, not `fill`.** `{ fill: 'linear-gradient', … }` becomes `{ kind: 'linear-gradient', … }`, the word the paint-kind registry already used. A solid still omits it. `asPaint` takes `{ kind: string }`.
  
  **Each built-in tile is its own paint kind.** `{ fill: 'pattern', pattern: { tile: 'hatch', color, lineWidth }, units }` becomes `{ kind: 'hatch', color, lineWidth, units }`, and likewise `crosshatch`, `dots`, and `chunks`. A tile a consumer rasterized itself is `{ kind: 'texture', texture: handle }`. `TilePatternSpec` is now a union keyed on `kind`, so a tile's own fields are checked instead of being optional on every tile. An SVG exported before this change carries its tiles in the old shape and loses them on import, with a warning.
  
  Follows from the fill record: `DEFAULT_SHAPE_FILL` is a `Fill`, `createPathLayer`'s `getFill` returns a `CommandFill`, `setFill` and `setFillOpacity` write the record, and the default node properties describe `data.fill` as an object with one `paint` field, as `data.stroke` is. A node whose `fill` is a string or a bare paint now paints no fill. `SelectionPanel` built from those default properties no longer offers "None" for a fill, since it offers none for a paint nested in a record; clearing one goes through the `setFill` action.
  
  A tile paint has a `color`, so `'color' in paint` no longer means solid. `isSolidPaint(paint)` answers that.
  
  Renames: `FillStyle` is `Paint`, and `GradientUnits` is `PaintUnits`. The paint types named as fills are named as paints: `GradientPaint`, `MeshGradientPaint`, `CommandPaint`, `PosedPaint`, and `SolidPaint`, with `isGradientPaint` and `isMeshGradientPaint`. `isPatternSpec` is gone; `isTilePaint` and `isPatternPaint` replace it.
  
  Adds API: `Fill`, `CommandFill`, `commandFill`, `PatternPaint`, `TilePaint`, `TexturePaint`, `TileKind`, `PatternPlacement`, `TILE_KINDS`, `isTileKind`, `isTilePaint`, `isPatternPaint`, `isSolidPaint`, `tileSpecOf`, `patternPlacementOf`, and `seedTile`. A paint kind can name a `family` (`PaintKindFamily`); kinds sharing one are a single segment in `PaintInput`'s kind bar, and the built-in tiles and `texture` share `patternFamily`.
- 21b6db7: Adds API: a plane's axes can carry different units. `resolveAxes(value, units)` in `@weasel-js/quantity` resolves one value for both axes, or `{ x, y }`, against one `UnitSystem` or one per axis (`PlaneUnits`), and `formatAxes` writes a base-unit point back out with each axis in its own display unit. `axisUnits`, `PerAxis`, `PlaneUnits`, and `PlaneValue` are exported beside them, and all are re-exported from `@weasel-js/core`.
  
  `gridSnapStrategy`, `pointToGridCell`, `createGridLayer`, `createCellHighlightLayer`, and `useGridCellHover` take a per-axis `spacing` and `unitSystem`, so a grid can be 1s wide and 5mV tall. A single value still means a square grid.
- 35abab1: Adds API: `perContainer(factory, { snap })`, for a layout strategy that keeps state. `factory` runs once for each container the layout is asked about, and the strategy it returns serves that container from then on, so it can close over a spatial index or its last arrangement. The result is an ordinary `LayoutStrategy`, declared on a container like any other, with a `forget(containerId)` to drop one container's state.
  
  Decided on an agent's judgment: the factory form is a wrapper in `@weasel-js/guides` rather than a second shape of `ContainerNode.layout`, so the scene and `move` are unchanged. `snap` and `contains` are read with no container in hand, so every container shares the ones passed in the options. It keeps 256 containers' strategies by default (`max`) and rebuilds the one used longest ago when asked for it again.
- 89e68c1: Adds API: two layout strategies for children of mixed sizes.
  
  `quadtree({ maxDepth })` quarters its container as far as each child needs: a child holds the smallest cell that fits it, and a cell is free while it, the cells around it, and the cells inside it hold nobody. A drag is offered the free cells of its own size, an arrival with no free cell is refused, and `cells(container, children)` on the strategy reports who holds what, for an overlay.
  
  `pack({ gap, overflow })` shelves children at their own sizes, left to right, wrapping at the container's width. A drop inserts at an index and everything after it reflows. `overflow` is `'reject'` (the default), `'grow'`, or `'scroll'`, as on `tileGrid`.
  
  `sequenceLayout(sequencer)` is the behavior `pack` and `slots` share, exported for a layout that keeps its children in one ordered sequence of its own.
  
  Decided on an agent's judgment: a quadtree never moves a child to make room, and places larger children first when it arranges; `pack`'s order is reading order, shelf by shelf, and it refuses a child wider than the container whatever the overflow policy.
- d2bafa4: `QuadtreeStrategy` is declared as an interface extending `LayoutStrategy` where it was an intersection type. It holds the same members.
- 4db5049: Adds API: `slots({ arrangement })`, a layout strategy that keeps a container's children in a sequence of slots whose positions depend on how many children there are, so the arrangement re-spaces itself as children come and go. `rowSlots`, `gridSlots`, and `ringSlots` are the arrangements it ships with, and an `Arrangement` is any `(bounds, count) => Slot[]`; one that returns fewer slots than it was asked for caps the container.
  
  Decided on an agent's judgment: a child's place in the sequence is the slot it sits nearest, not its index among the container's children, so reordering is a pose change and z-order is left alone. Dropping on a slot inserts there and shifts the children between, where `tileGrid` swaps. A slot is a center point; the default `slotToPose` centers the child's own size on it, and a ring slot's outward `angle` is passed through for a `slotToPose` that wants to turn the child.
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

- 072dccb: Alignment snapping works on a `parallax` layer. Candidate lines and spacing boxes handed to `alignMoveBehavior`, `alignInsertBehavior`, and `alignResizeBehavior` are always in the camera's world, and so are the lines and gaps they publish; a gesture whose poses are in a plane carries them in to match and back out to publish. `deriveAlignmentGuides` takes `planeOf`, which says which plane a sibling's pose is stored in so its box is carried out to the camera's world. A caller that fed plane coordinates in for siblings on the dragged node's own parallax layer now passes `planeOf` instead.
- 9ad839d: A `PathDrawCommand`'s `fill` and `stroke` are now `CommandFill` and `CommandStroke`: a pattern must name a registered texture, and no paint may be in `'bounds'` units, so a tile spec or a box-relative gradient on a hand-built command is a type error where it used to draw blank or in screen space. This is a breaking change to types: code that passes a node's `FillStyle` or `Stroke` straight into a command now calls `commandFill(fill, box)` or `commandStroke(stroke, box)`, which resolve both. Options that feed commands directly (`createPathLayer`'s `getFill` and `getStroke`, affordance paints, selection overlay and guide strokes, overlay role strokes) take the narrowed types. `<Canvas backgroundFill>`, `<DrawCanvas background>`, the rect fallback painter, a marker's own fill, and `diagramShape` now resolve their paint, so a tile spec or `'bounds'` gradient there paints.
- 35e3059: Resizing or drag-inserting a node on a layer with `parallax` snapped to the wrong place: the resize and insert `snapToGuides` and `snapToGrid` behaviors compared the node's plane coordinates with the guide's or grid's camera coordinates directly, so an edge landed away from the drawn line by the plane's scale and offset. They now carry the guide or grid line into the plane first, as `guideSnapStrategy` and `gridSnapStrategy` already did for a move.
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

- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [0756a82]
- Updated dependencies [b18ef4a]
  - @weasel-js/core@1.7.2
  - @weasel-js/geom@1.7.2

## 1.7.1

### Patch Changes

- e2f1968: New package `@weasel-js/guides`: placement aids, built on top of core. It holds what used to be core's grid, guide and layout-strategy code:
  
  - the grid: `createGridLayer`, `createCellHighlightLayer`, `useGridCellHover`, `roundToCell`, `gridSnapStrategy`, `pointToGridCell`;
  - guides and alignment: `useGuides`, `createGuidesLayer`, `guideSnapStrategy`, `DEFAULT_GUIDE_TOLERANCE_PX`, `deriveAlignmentGuides`, `matchAlignment`, `MOVE_ANCHORS`, `alignMoveBehavior`, `alignResizeBehavior`, `alignInsertBehavior`, and the `Guide` type;
  - snap behaviors: `snapToGrid` and `snapToGuides` from `@weasel-js/guides/move`, `/resize` and `/insert`, and `pointSnapToGrid` from the root or `/resize`;
  - layout strategies: `freeform`, `tileGrid`, `snapPoint`, and the drop-target pickers `none`, `nearest`, `nearestWithin`, `containedThenNearest` and `cellAt`.
  
  Breaking for `@weasel-js/core`. Core no longer exports any of those names, and does not re-export them, so import them from `@weasel-js/guides` instead. The `@weasel-js/core/insert` subpath is gone, since everything it held moved. `@weasel-js/core/move` keeps `snapToContainer` and `snapBackOrDelete`, and `@weasel-js/core/resize` keeps `clampMinSize` and `lockAspectWithModifier`.
  
  The canvas's `grid` layer slot now takes a pre-built layer, like `cellHighlight` and any custom slot, instead of grid options. `GridSlotConfig` and the `grid.highlight` sub-option are gone. Write `layers={{ grid: { layer: createGridLayer({ spacing: 20, bounds }) } }}`, and pass a cell highlight as `cellHighlight: { layer: createCellHighlightLayer(...) }`.
  
  Core keeps the seams the package plugs into: the `SnapStrategy`, `MoveBehavior`, `BoundsConstraint`, `InsertBehavior` and `PointSnap*` types, `snap()`, `OriginProjection` with `RECT_ORIGIN_PROJECTION`, the `snap` dep, `selectTool.snap`, `toolOptions.snapPoint`, and the `LayoutStrategy` contract. It now also exports `AUTO_ORIGIN_PROJECTION`, the default projection for rects and paths, and three helpers for writing a snap behavior: `screenTolerance`, which converts a screen-pixel tolerance to world units through the gesture's camera; `gestureViewReader`, which reads that camera; and `gesturePlaneReader`, which reads the parallax plane being edited.
- 9118aea: Alignment guides gain equal-spacing snaps and Figma-style segments. Additive,
  with one visible default change.
  
  - `matchSpacing` and `measureGaps` snap a box so its gap to a neighbor in its
    row or column equals a gap already between two other boxes, or center it
    between its two neighbors. Pass `getSpacingTargets` (sibling bounds) and
    `setActiveGaps` to `alignMoveBehavior` or `alignResizeBehavior` to turn it
    on; on each axis the nearer of the alignment and spacing snaps wins.
  - `Guide` has an optional `span`, the stretch of the line worth drawing.
    `deriveAlignmentGuides` fills it with the extent of the boxes behind each
    line, and `matchAlignment` stretches it to reach the snapped box.
  - `createGuidesLayer` draws a spanned guide as a segment with end ticks, and
    draws `getGaps` as ticked, size-labeled gap markers (`ticks`, `gapLabels`,
    `gapColor`). Derived alignment guides therefore render as segments by
    default now; `extent: 'full'` restores canvas-long lines. Guides with no
    span, such as user-placed ones, still draw across the canvas.
- 9f83b33: A grown `tileGrid({ overflow: 'grow' })` shrinks back when children leave it. Deleting a child, or moving or dragging one out, gives back each line of cells that empties — never below the declared `rows` (or `cols` for `flow: 'column'`) — and the rest keep their cell size instead of stretching over the grown container. The shrink lands in the same undo step as the departure.
  
  This rides on a new optional `LayoutStrategy.depart(container, children, departed)`: the scene's layout pass hands it the children that stay and the ids that left, and it returns poses plus optional new container bounds, as `arrive` does. An edit that both removes and adds children runs `depart` first, then `arrive`. `SceneArrivalHandler` gains a third argument, `departures`, the nodes each container lost in the edit; `layoutArrivalHandler` and `useLayoutArrivals` pass it through. Additive: a strategy without `depart` is rearranged by `childPoses`, as before.
- 6f03bf7: A container can declare its layout on the scene: `scene.add({ kind: 'container',
  layout: tileGrid(...) })`, or `layoutKey` in a snapshot, resolved through the new
  `SceneRegistry.layout`. Layouts now answer to every change to a container's
  children, not only arrivals: a delete, reorder or resize re-runs the strategy's
  `childPoses`, and the writes land in the same undo step as the change, so undo
  restores the whole arrangement at once. A child that joins goes to `arrive` as
  before, and to `childPoses` when the strategy has no `arrive`.
  
  This runs through the scene's existing arrival window and `arrange` op; there is
  one layout pass (`core/scene/layoutPass.ts`) whether the layout is declared on
  the node or supplied by `<SceneCanvas layouts>` / `useLayoutArrivals`, and a
  declared layout wins. With no handler installed, a scene holding declared
  layouts runs that pass itself, measured by the new
  `UseSceneOptions.layoutFrame` (also a `sceneFromJSON` option).
  
  Breaking edges: `SceneArrivalHandler` gains a second argument, `changed`, and is
  now also called for edits with no arrivals. While layouts are active, a bare
  `scene.remove`, `scene.reorder`, or a `setPose` that resizes a container is
  recorded as a one-mutation batch, like `add` and `move` already were. The
  `arrange` op's coalesce key now names the nodes it moved.
  
  Also new: `scene.layoutOf(id)` and `scene.onReflow(listener)`, which reports each
  live edit's layout writes; `<SceneCanvas reflowTransition>` uses it to glide
  those reflows as it does a drag's. New exports: `LayoutFrame`, `LayoutMove`.
- 43ad590: `tileGrid` takes an `overflow` policy, and it holds however a child arrives — dragged in, inserted, reparented, duplicated or grouped inside the grid. Before, only a drop was checked: a child that arrived by an op past `cols * rows` was skipped by the layout and left wherever its pose put it.
  
  - `'reject'` (the default) refuses the child by every route. A drop finds no free cell, as before. An insert or reparent that would overfill the grid is now reverted whole, so nothing lands and no undo entry is recorded. **This is a behavior change:** such an op used to add the child and leave it unplaced.
  - `'grow'` adds a row when the last one fills (a column, under `flow: 'column'`), and the container grows by one cell pitch to hold it, in the same undo step.
  - `'scroll'` keeps the container's size and runs the extra children on past its last visible row at the same pitch. `LayoutStrategy.contentExtent` reports the region they cover.
  
  Also new on `tileGrid`: `flow: 'row' | 'column'` sets the fill order. Every child now gets a cell from `childPoses`; one past the grid is placed past it rather than skipped. A child that joins a non-full grid by an op is placed in the free cell nearest to where it was put. Before, it stayed where its pose put it.
  
  Underneath, the scene has an arrival hook. `scene.setArrivalHandler(fn)` hears every node that joins a container during one live edit. It returns poses to write as part of that edit, or `null` to refuse the edit. A refused `applyBatch` (or `history.applyOps`, or a journal's `applyBatch`) is reverted and does not throw. A refused `scene.batch`, `untracked`, or bare `add` / `move` is reverted and throws `SceneArrivalRefused`. Redo and a restored history replay the arrangement recorded the first time, through the new `'arrange'` op (`createArrangeOp`). `LayoutStrategy` gains the optional `arrive` and `contentExtent`. `layoutArrivalHandler(scene, { layouts })` connects a scene's layouts to the hook, and `<SceneCanvas layouts>` installs it. A canvas wired by hand through `sceneToAdapter({ layouts })` calls `useLayoutArrivals`. A reparent-on-drop the container refuses now leaves the drag uncommitted instead of throwing.
  
  Mostly additive, with these breaking edges. The default-policy change above. `Scene` gains a required `setArrivalHandler`, so a hand-written `Scene` implementation has to add it. While a handler is installed, a bare `scene.add` / `scene.move` into a container is recorded as a one-mutation batch.
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
