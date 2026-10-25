# @weasel-js/path-tools

## 1.13.0

### Patch Changes

- 5f28e9c: A path effect that hides its sources no longer treats a source that was already hidden when the effect was made as one it hid. Release leaves that source hidden, and Expand to Paths, Delete and Cut leave it in the scene; Set Path moving off it leaves it hidden too. The effect records those sources by position in a new `foundHidden` field beside `hideSources`, and a saved effect without one reads as before: it hid them all. `sourcesHiddenBy(scene, id)` in core answers which sources an effect holds hidden, and `sourcesOf(node)` the ids a node names in its `dependsOn`.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- d9f7bb7: Set Spine and Release Spine move the `hidden` flag as Set Path does where a blend hides its sources. Set Spine hides the path it lays the blend along, or records it in `foundHidden` where it was hidden already, and shows the spine it replaces unless another effect still hides it or the blend found it hidden. Release Spine shows the spine on the same terms, counting every selected blend let go of that spine.
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
  - @weasel-js/stroke@1.13.0
  - @weasel-js/cursor@1.13.0
  - @weasel-js/icons@1.13.0
  - @weasel-js/paint@1.13.0
  - @weasel-js/react@1.13.0
  - @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 5f28e9c: A path effect that hides its sources no longer treats a source that was already hidden when the effect was made as one it hid. Release leaves that source hidden, and Expand to Paths, Delete and Cut leave it in the scene; Set Path moving off it leaves it hidden too. The effect records those sources by position in a new `foundHidden` field beside `hideSources`, and a saved effect without one reads as before: it hid them all. `sourcesHiddenBy(scene, id)` in core answers which sources an effect holds hidden, and `sourcesOf(node)` the ids a node names in its `dependsOn`.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- d9f7bb7: Set Spine and Release Spine move the `hidden` flag as Set Path does where a blend hides its sources. Set Spine hides the path it lays the blend along, or records it in `foundHidden` where it was hidden already, and shows the spine it replaces unless another effect still hides it or the blend found it hidden. Release Spine shows the spine on the same terms, counting every selected blend let go of that spine.
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
  - @weasel-js/routing@1.13.0-rc.0
  - @weasel-js/prefs@1.13.0-rc.0
  - @weasel-js/renderer@1.13.0-rc.0
  - @weasel-js/stroke@1.13.0-rc.0
  - @weasel-js/cursor@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 13e597d: Text can follow a path. `@weasel-js/geom` adds a `'path'` track shape (`pathShape`), a `side` override on `trackRun`,
  and `placeAlongRun`, which turns item lengths into places along a run, in `RunOrder` `'reading'` or `'track'`.
  `TrackShape` gains a required `closed` member, so a shape implemented outside geom has to add it.
  `runPlaces` and `runLength` moved there from `@weasel-js/ui`, which re-exports `runPlaces` by name, so its curved rows
  come from geom's placement. `measurePath` takes `keepCorners`. `@weasel-js/text` adds `textClusters`, a line's
  grapheme clusters as outlines with their advances. `@weasel-js/core` adds the `textAlong` path effect; every effect
  takes `hideSources`, effect sources can carry a list of items, curved text is derived again when a font loads, a
  hidden source is edited through its effect, and Delete, Cut and Expand now remove an effect's hidden sources with
  it. A committed in-place text edit is labeled "Edit text" in history.
  `@weasel-js/path-tools` adds Text Along Path (Alt+Shift+X), Release and Set Path. `useTextEdit` in
  `@weasel-js/text-dom` gains `onDraft`.
  
  <!-- bump-approved: minor: maintainer — 1.12.0 release requested 2026-10-22 -->
- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- 24f2495: An absent fill or stroke now means none everywhere, read through `resolveFill` and `resolveStroke`. This breaks three things that used to fill in a default:
  
  - **A text node built without a `fill` now draws no glyphs.** Write `fill: { paint: solid('#000') }`, or `DEFAULT_TEXT_FILL`, now exported from `@weasel-js/text` and `@weasel-js/core`. `DEFAULT_TEXT_STYLE.fill` is `null`. The text insert, the sticky note and SVG import write black themselves.
  - **A derived part with no `fill` or `stroke` no longer takes its node's.** Write `INHERIT` (`'inherit'`) for that; `DerivedPart` allows it, and `resolvePartPaint` is the one reading of a part's paint.
  - **`diagramShape` drops its `defaultFill` and `defaultStroke` options.** An outline paints what its data names; `diagramScene` already writes the default style onto every node. SVG import writes SVG's initial black onto text that names no fill, and SVG export writes `fill="none"` for text that has none.
  
  `setFill` and `setStroke` write None as a record with no `paint` rather than `null`, so a stroke keeps its width and dash; a `paint: null` passed when the gesture starts used to be read as no paint given and painted the default color. The selection panel shows a fill or stroke paint as a paint, None or Mixed, never unset; `nestedPaintValue` is that reading. Booleans, Outline Stroke and the character bar read a fill with no paint as unfilled. Core re-exports `resolveFill`, `resolveStroke`, `INHERIT` and their types.
- Updated dependencies [dbd6711]
- Updated dependencies [f6db995]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [2cf7da4]
- Updated dependencies [92a0f2d]
- Updated dependencies [448065a]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [2c52cc5]
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
  - @weasel-js/paint@1.12.0
  - @weasel-js/stroke@1.12.0
  - @weasel-js/renderer@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/prefs@1.12.0
  - @weasel-js/cursor@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 70b12d1: An action can carry a settings form: `Action.settings` holds a prefs schema, a `read` that gives
  the selection's current values (and which fields it disagrees on), and an optional `params` that
  turns one field's change into the params the action is triggered with. Every surface that lists
  actions draws such an action as its form instead of a button that triggers it bare: a bar or a
  panel opens it in a popover under the action's button, a menu shows it as a submenu of its fields,
  and the command palette opens it in a dialog. Each change is one trigger, so one undo step. The
  form is disabled while the action's `enabled` says no. `readActionSettings` and
  `actionSettingsParams` are what the surfaces read it through; `useActionSettings`,
  `ActionSettingsPopover` and `ActionSettingsDialog` are in `@weasel-js/ui/components/ActionSettings`.
  `BarActionButton` takes `expanded` for a button that opens a dialog.
  
  Warp Settings (`configureWarp`) and Edit Path Effect (`editPathEffect`) carry one each, so Warp
  Settings on a bar now opens Mode, Rows, Columns, Mapping and Tolerance for the selected warps
  rather than doing nothing, and both are disabled with nothing they apply to selected.
  `editPathEffect` takes an optional `kind`, limiting an edit to effects of that kind, and now reads
  `selection`. The forms are exported as `warpSettingsForm` and `pathEffectSettingsForm`.
- 3b5750f: Set, swap, or release the spine of a blend that already exists. `setBlendSpineAction`
  (`setBlendSpine`) lays the selected blend along the other selected path, in either selection order,
  replacing any spine it had; `releaseBlendSpineAction` (`releaseBlendSpine`) puts each selected
  blend back on a straight run between its two shapes and selects the spines, ordinary paths where
  they were. Both are in `pathEffectsPreset` and the `pathEffects` group, and each is one undo step.
  
  Core adds `createSetDependsOnOp`, an undoable retarget of a derived node's `dependsOn`, and the
  `setDependsOn` write it goes through on `SceneMutators` and the scene-backed adapter.
- 25a112b: Constraint links follow whole-node drags live, and broken ones are drawn.
  
  - core: move, resize and rotate preview the nodes a constraint link ties as they will commit, every frame, through the same finishing the commit runs, and `transformPreviewFields` gives a drag its preview fields with them added.
  - path-tools: `createConstraintLinkMarks(style)` is a screen-space layer, carried by `constraintsPreset`, that draws every broken link: its constraint's mark by the anchor it holds and a dashed line to where it wants that anchor, in the conflict color. `brokenConstraintLink(scene, id)` and `brokenConstraintLinks(scene)` read the links that do not hold, `constraintLinkMarks` draws a list of them, and `DEFAULT_CONSTRAINT_STYLE` is exported.
- 4d99526: Constraint links now hold through whole-node transforms, preview through every path-edit drag, and have a gesture that makes them.
  
  - core: `PathEditExtension.finishTransform(ctx: PathTransformFinishCtx)` answers the other nodes a move, resize, rotate, flip, nudge or transform-again changes along with the ones it transforms — align and distribute too — committed in the same history entry; the `editAnchors` dep runs it as `transformOps(ops, label)`, and those actions now declare `editAnchors`. An extension may refuse a transform by answering null.
  - core: `pathEditPreview` finishes each frame itself through the new `finishPathEditFrame`, so bend segment and the path-tools drags preview the node's constraints and linked nodes as they will commit. Breaking: its `current` thunk now answers a `PathEditFrame` (`{ path, origins? }`) instead of a bare path.
  - geom: `PathsEditItem.yields` lets a path the edit left alone give way freely.
  - path-tools: the constraints extension carries linked nodes through whole-node transforms; `constraintLinkConflictsOf(scene, id)` reports the links tying a node that do not hold; `linkAnchorAction` (in `constraintsPreset`) links an anchor Alt-dragged onto another node's anchor (`coincident`) or segment (`onPath`), with `linkTargetAt` and `linkConstraint` beside it.
- 6875e54: `cornerControlsState` reports a corner with no keyword (a parameter between them, or a sharp corner) as `shape: 'none'` rather than `null`. A prefs form now reads a `null` value as absent and shows the leaf's default, which would have pressed `round`; `'none'` is a held value the shape leaf's encoding reads as no option.
- 5cdc3d0: `BROWSER_RESERVED_CHORDS` adds Mod+Shift+I, J, C and K: Chrome's devtools, console and inspector on Windows and Linux, and Firefox's Browser and Web Console. Bridge and Bridge anchors move off Mod+Shift+J to Alt+J, which is a breaking change for anyone relying on the old default.
- 1bb4752: Tool sets: a `ToolSet` names a group of tool ids and other sets as one unit (`toolSet`, `toolIdsOf`, `withoutTools`, `toolSetHas`). `<SceneCanvas defaultTools>`, a preset's `tools`, and `ToolPalette`'s `include` each take sets. Core exports one per family, `SELECT_TOOLS`, `VIEW_TOOLS`, `SHAPE_TOOLS`, `DRAW_TOOLS`, `TYPE_TOOLS`, `PAGE_TOOLS` and `RIG_TOOLS`, with `BUILTIN_TOOLS` over them all; `BUILTIN_TOOL_IDS` is derived from it, and a shape kind's new `family` field says which set names it. `@weasel-js/path-tools` exports `WARP_TOOLS`, `RESHAPE_TOOLS`, `PATH_TOOLS_TOOLS`, and `usePathToolsTools()`, which builds every one of its tools keyed by id.
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
  - @weasel-js/renderer@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/stroke@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/cursor@1.11.1
  - @weasel-js/paint@1.11.1
  - @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- 60d8e39: `@weasel-js/path-tools` adds three presets, each also in `pathTools`:
  
  - `anchorSelectionPreset` selects anchors along the path in path edit. `growAnchorSelection` (`]`) adds each selected anchor's neighbors in its subpath and `shrinkAnchorSelection` (`[`) drops the anchors at the ends of each selected run, wrapping round a closed subpath. `selectEveryNthAnchor` (Alt+N) selects every `params.n`th anchor counting from the first selected one; `selectCornerAnchors` (Alt+C), `selectSmoothAnchors` (Alt+M), and `invertAnchorSelection` (Alt+I) select by anchor kind and by complement. They are in the `ANCHOR_SELECTION_GROUP` group, change only the selection, and push no undo step.
  - `resamplePreset` brings `resamplePath`, an ongoing path command: it spreads each selected path's anchors evenly along it by arc length, to `params.count` anchors or at `params.spacing`, holds corner anchors fixed unless `params.keepCorners` is false, and refits the curves through the new anchors within `params.tolerance`, halving any piece that cannot follow the original that closely. It previews on `begin` and every update, and commits one undo step.
  - `addExtremesPreset` brings `addExtremeAnchors` (Alt+X), which splits curved segments at their x and y extremes without moving the shape: the segments whose two ends are selected, or the whole path while no anchor is. It is in the `anchors` group.
  
  `ActionParamSchema` types the params of `selectEveryNthAnchor` and `resamplePath`.
  
  Core exports `livePathEdit`, the builder behind `simplifyPath` and `offsetPath`, for a path command driven live by its params. A live path command now recomputes when any param changes, not only its main number, and reads params a tuning supplies as a thunk.
  
  `@weasel-js/geom` adds `resamplePath`, `addExtremaAnchors`, `segmentExtremaTs`, `cubicAxisExtremaTs`, and the selection walks `growAnchorSelection`, `shrinkAnchorSelection`, `everyNthAnchor`, `anchorsWhere`, `cornerAnchors`, `smoothAnchors`, and `invertAnchorSelection`.
- 6f839dd: A blend can lay its steps along a spine and space them by distance. A blend node whose `dependsOn` names a third path, `[from, to, spine]`, places each step on the spine as far along it as the step is between its sources, and paints nothing while that spine is gone; `orient` also turns each step by how far the spine's heading differs from the straight run between the sources. `spaceBy: 'distance'` puts a step every `distance` from the first source, along the spine where there is one, as many as fit short of the second; `spaceBy: 'count'`, the default, keeps `steps` evenly spread. Blend made with three shapes selected takes the third as its spine, and `blend` and `editPathEffect` take `spaceBy`, `distance`, and `orient` as params.
- 6072e93: A path constraint conflict names every constraint it needs, not only the one left failing. Fixing both ends of an edge and then asking for it vertical reports all three, so the fix — drop either pin, or the new constraint — is on screen.
  
  `@weasel-js/geom` gains `conflictingConstraints(points, constraints, opts?)`: for each group of constraints sharing anchors that cannot all hold, a smallest subset that still cannot, found by dropping each member in turn and keeping it out when the rest still fail. Later constraints in the list are kept over earlier ones that conflict the same way, so the one just added stays in the set. A constraint that cannot apply at all is named on its own.
  
  In `@weasel-js/path-tools`, `constraintConflictsOf` and the overlay's conflict color cover the whole set, and `setConstraints` answers it — empty when every constraint holds, null when the dep cannot store — where it answered a boolean. This changes `setConstraints`' return type.
- 53ba41a: Path constraints can tie nodes together. A constraint link is a scene node: its `dependsOn` names the nodes it ties, and its `data.constraintLink` holds one path constraint whose anchors are numbered over theirs one after another. Being a node, it is saved and undone with the scene, and deleting a node it ties deletes it. Additive, except where noted below.
  
  `@weasel-js/geom` gains `constrainPathsEdit(items, links)`: an edit of several paths finished in one solve, each path's own constraints and each link renumbered through the edit, and the paths the edit left alone held unless nothing else can give way. `constrainPathEdit` is now its one-path case. A solve takes a frame per constraint (`axisAngles`), so paths drawn in different frames solve together. A dragged anchor held on a segment now starts from the nearest point on it and stays there while the rest give way, where before it slid by moving more freely than everything else, which let it drift off the pointer to satisfy unrelated constraints.
  
  In `@weasel-js/core`, a path-edit extension's `finishEdit` gets a fourth argument, a `PathEditFinishCtx` that reads other nodes, their paths and their dependents, and may answer `others`: nodes it changes along with the edited one, each with a new path, data, or `remove`. They are committed in the same history entry, and the anchor drag previews them. The `editAnchors` dep's `finishEdit` now answers `{ path, others }` where it answered the path. This changes its return type.
  
  In `@weasel-js/path-tools`, `constraintLinkNode` makes a link node and `constraintLinkOf` reads one. The constraints extension solves every node links reach from the edited one: an anchor held on another node's segment slides along it when dragged, and follows the segment when that node is edited. Link nodes draw nothing and take no clicks.
- 7162a7a: Corner shape: any corner anchor of a path takes a CSS `corner-shape`, and its radius can be changed later. Additive: `PolygonPath` gains `corners`, an optional `CornerSpec` (`{ shape, radius }`) per flat anchor index, where `shape` is one of the six `corner-shape` keywords (`square`, `squircle`, `round`, `bevel`, `scoop`, `notch`) or a finite `superellipse()` parameter, and `radius` is how far along each edge the cut starts. Following CSS Borders 4, every keyword is a point on one parameter, k: `square` is ∞, `squircle` 2, `round` 1, `bevel` 0, `scoop` -1, `notch` -∞. `cornerShapePieces(k, frame)` draws a corner for any k as the quarter superellipse `|u|^n + |v|^n = 1`, `n = 2^|k|`, spanned from the corner's center for k > 0 and from the outer corner for k < 0, fitted with cubics within `CORNER_FIT_TOLERANCE` of the setback and exact at k = 0, ±1, and ±∞. The command stream keeps the bare anchors, and `resolveCorners` expands the specs into plain geometry, each cut clamped so that the two cuts on a segment never overlap; `resolveCornersWithSources` also answers which source anchor each expanded anchor came from, and `remapPerAnchor` carries a per-anchor array across, so the renderer draws `vertexColors` on a cornered path with every point of a cut in its corner's color. Every reader of a path's geometry calls it first: tessellation, `extractPolylines`, the hit tests, `boundsOfPath`, `pathDistanceToPoint`, the booleans, `offsetPath`, the renderer's path draw, and `serializePathD`, which `@weasel-js/svg` now exports. A spec rides on its anchor through `pathToAnchors` / `anchorsToPath` (`PenAnchor.corner`), so anchor inserts and deletes keep it in place, and `transformPath` scales radii with the geometry. Also new: `cornerFrames` and `cornerFrameAt` (where each corner anchor can be cut, and how far), `withCorner`, `cornerAt`, `cornerSpecAt`, `cornerShapeK`, `cornerKeywordOf`, `isCornerShape`, `nextCornerShape`, and `CORNER_KEYWORDS`.
  
  `@weasel-js/path-tools` adds `cornerShapePreset` (and `createCornerShapePreset(style)`), which edits corners in path edit. Each corner anchor shows a widget just inside it, a small tile cut in the corner's shape, drawn and pressed as `corner:N` (matched by routing's new `isCornerWidget`) while chrome-caps shows `path-edit.corners`, which is on by default. A drag on one (`editCornerAction`) sets the corner's radius live and commits one undo step; pressing the widget of a selected anchor sets every selected corner. `cycleCornerShapeAction`, in the `anchors` group, steps the selected corners through the keywords, and `setCornersAction` sets their shape or radius from its `shape` and `radius` params, typed for `<SceneCanvas tune>`. `CORNER_CONTROLS`, `cornerControlsState`, `cornerControlsParams`, and the `useCornerControls` hook are a prefs-form panel over the selected corners: the keywords, a curvature slider from -4 to 4, and the radius, mixed where the corners differ.
  
  A path-edit extension's part (`PathEditPart`) can carry its own `hitRadiusPx` and a `standoff`, a screen-pixel push along a world-space normal, so it keeps its distance from the path at any zoom.
  
  A `PathEditHost` can own the anchor selection too, through optional `selectedAnchors` and `setSelectedAnchors`, so an app seeds which anchors start selected and shows what is selected. Giving a sharp corner a shape, through `setCorners` or `cycleCornerShape`, also gives it a radius: the call's own, or a quarter of the room the corner has.
- The Envelope mesh tool's key is C, not M, which the Measure tool takes.
- 63b310c: Icons are named, not drawn, by the code that uses them. This is breaking.
  
  `@weasel-js/icons` is new. An icon is a qualified name, `namespace:name` (`core:undo`, `ui:close`, `path-tools:reversePath`), held as an `IconRef`. Each package's `icon()` makes one and qualifies its own bare names: in core, `icon('undo')` is `core:undo`. A registry supplies the glyphs: mount `<IconRegistryProvider icons variants>` from `@weasel-js/core` at the app root, or give `<WeaselProvider>` its new `icons` and `iconVariants` props. Core, ui and path-tools each publish their table at `./icons` (`import { icons } from '@weasel-js/ui/icons'`). A name no registered table holds draws a placeholder and warns in development, and draws nothing in production.
  
  `@weasel-js/icons-plugin` is new too. Its build plugin, `weaselIcons`, ships only the glyphs a build names. In an app's vite, rollup or rolldown build, `weaselIcons.vite({ mode: 'app' })` serves `virtual:weasel-icons`, holding the glyphs named by the app and by the weasel packages it imports, and fails the build on a name no table holds. `virtual:weasel-icons/all`, `/<namespace>` and custom variants each load as their own chunk, asked for with `useIconVariant(name)`. Types for the virtual modules are at `@weasel-js/icons-plugin/virtual`. The plugin is its own package so that installing `@weasel-js/icons` does not install a native parser. Core's and ui's `dist` is no longer minified, so the `@icon` annotations the plugin reads survive; a consumer's bundler minifies.
  
  What breaks:
  
  - routing: `Action.icon`, `ActionVariant.icon`, `ActionItem.icon` and `ToolPresentation.icon` take an `IconRef` from `icon()`, not a React node. So does `useCommand`'s `icon` option, which no longer takes a function read each time the command shows.
  - prefs: `PrefBase.icon` and an enum option's `icon` take an `IconRef`, not a free string. A schema saved with bare names, such as `"icon": "close"`, now draws nothing for them and warns in development; write `"ui:close"`.
  - core, ui and path-tools: the `…Icon` components are removed; draw `<Icon name={icon('core:rect')} />` instead. `NudgeAnchorsIcon` and its `dir` prop become four glyphs, `core:nudgeAnchors` (pointing right), `core:nudgeAnchorsUp`, `core:nudgeAnchorsDown` and `core:nudgeAnchorsLeft`. Core's `PaintKindEntry.icon` and `PaintKindFamily.icon` take an `IconRef`. Core's `ACTION_GLYPHS`, `IconProps` and `ActionGlyphProps` are gone, and so are ui's `ICON_PATHS`, `ICON_FILLS`, `ICON_GROUPS`, `MARK_ICONS`, `IconName`, `MarkIconName`, `FillableIconName` and `ActionIconSource`.
  - ui: `<Icon name>` and `mark`, `actionIcon` and `ActionBar`'s `icons` take `IconRef`s, and `isFillable` takes a glyph. `resolveIcon` draws a ref, or a qualified string read from data. `iconFromData(value)` reads a name from data as a ref, warning once in development about a bare one.
  - labkit: `CommandItem`, `ToolItem`, `ViewportControl` and `TrialTool` take an `IconRef` as `icon`, and so does `ConfigOption.icon`. `IconComponent`, the nine ui icon components labkit re-exported, and its `ICON_PATHS` and `IconName` are gone.
  - forge: `GlobalDeclaration.icon` takes an `IconRef`. `FrameSetup.icons` registers an app's own tables in every frame. A story's `control.icons` argTypes option takes qualified names (`'ui:statusSuccess'`); a bare `'statusSuccess'` now draws nothing.
  
  `@weasel-js/registry` exports `isDev()`, which `@weasel-js/react` re-exports. It reads `process.env.NODE_ENV`, which a production bundle folds to `false`, and the development diagnostics in core, routing, ui, labkit, renderer and animator all read it.
- fb75358: Lengthen: in path edit, turn on the Lengthen path-edit tool and drag an open path's end anchor outward to grow the path from that end, or inward to shorten it along itself. It grows straight along the end tangent, or along a circular arc with the curvature the end has, meeting the path smoothly. The `lengthenPath` action's `mode` param (`'tangent'` or `'curvature'`, typed for `<SceneCanvas tune>`) sets which a plain drag does, and Shift, read on every move, picks the other. A straight end segment grows in place; a curved one is continued with a new segment, one per quarter turn of arc. Each drag is one undo step, "Lengthen path" or "Shorten path". `lengthenPreset` in `@weasel-js/path-tools` registers the action and its toggle, `pathEditTool.lengthen` (`lengthenToolAction`, drawn with `path-tools:lengthen`); `pathTools` includes it.
  
  `lengthenPathEnd(set, end, distance, mode)` (`@weasel-js/geom`) is the edit underneath, with a negative `distance` shortening. `openEndAt` names the open end an anchor is, `pathEndFrame` gives an end's point, outward tangent, and signed curvature, `lengthToward` turns a pointer position into a distance, and `pathEndAnchorIndex` finds the end anchor again after an edit. `lengthenOpenEnd`, which Extend to next path uses, is now `lengthenPathEnd` in tangent mode, so both tools grow a curved end by the same rule.
  
  While a path-edit tool is on, path edit's anchors and handles no longer show their own hover cursor, so the tool's action shows its own.
- 86725ed: An ongoing action can name the modifiers it reads mid-gesture as roles: `Action.modifierRoles` declares each role's default keys, a tuning's `roles` or a binding's `opts.roles` moves one to other keys, and the dispatcher resolves them into `InvocationCtx.roles` on the press, every move, and the release. `roleReader` reads them, falling back to the default keys where nothing resolved them.
  
  Path edit's modifiers are roles now. `editAnchors` declares `selection.add` (Shift), `mirror.break` (Alt), `handle.holdAngle` (Shift), and `handle.holdLength` (Cmd or Ctrl); `marqueeAnchors` declares `selection.add`; the pen's handle drag declares `mirror.break`, `snap.constrain` (Shift) and `snap.suspend` (Ctrl); and `balanceHandles` declares the two handle locks. So `<SceneCanvas tune={{ editAnchors: { roles: { 'handle.holdLength': ['alt'] } } }}>` moves the length lock to Alt.
  
  Breaking: `locksInForce` takes the invocation context in place of its `ModifierState`, so it can read the roles.
- 679138c: A scene node can be hidden or locked on its own, not only through its layer. `SceneNode.hidden` keeps a node and its whole subtree from being drawn; `SceneNode.locked` keeps a node and its subtree drawn but out of reach, the way a locked layer's nodes are. Both are set through `scene.setHidden(id, hidden)` and `scene.setLocked(id, locked)`, each one undo step that neither lock blocks, or through the new `createSetHiddenOp` / `createSetLockedOp` against an adapter's `setHidden` / `setLocked`. Both go on `AddNodeSpec`, ride a snapshot, and come back with an undone removal. Additive.
  
  `scene.isHidden(id)` is new, and `scene.isLocked(id)` now folds in the node flags. Both answer from `nodeGates`, now exported with `isNodeHidden`, `isNodeLocked` and `hidesSubtree`, which every reader asks: painting, point picking, the marquee and lasso, select-all, path snapping, measurement picking and snapping, sibling spacing guides, the slice and Girth tools, and text editing all pass over a hidden node, and the pickers over a locked one. The selection now drops a hidden node as it drops a locked one, so hiding a layer or a node deselects what it hides.
  
  `@weasel-js/svg`: `svgNodesFromKit` writes a node carrying `hidden` with `display="none"`, which `parseSvg(…, { keepHidden: true })` reads back as hidden, and `unpackSvgFiles` now keeps a dropped file's hidden content, inserting it hidden rather than leaving it out.
- a4c99c1: An `onPath` path constraint holds an anchor on a segment of its own path, `{ kind: 'onPath', anchor, segment: [a, b] }`, anywhere along it. Additive.
  
  Each one gives the solve a parameter of its own, the place along the segment, started at the point nearest the anchor and kept between the segment's ends. A dragged anchor held on a segment slides along it rather than pulling the segment after it, and stops at its ends. An edit that splits or breaks the segment drops the constraint, as one that deletes a named anchor does. `segmentBetween(path, a, b)` answers the segment joining two anchors, in the order the path runs it.
  
  In `@weasel-js/path-tools`, `constrainAnchors` with kind `onPath` reads three selected anchors: the first held on the segment the other two end. The overlay marks it with a dot on a line.
- 0677769: Path edit gains soft selection and handle snapping, each a preset in `@weasel-js/path-tools` that nothing turns on by default, `pathTools` included.
  
  - **Soft selection** (`createSoftSelectionPreset(() => ({ radiusPx, falloff, onRadius }))`, its options read as each anchor drag starts; null leaves the drag hard). Dragging anchors also moves the anchors near them, each by a weight falling from 1 to 0 over the radius, which is measured along the path in screen pixels. The falloff is `'smooth'`, `'linear'` or `'sharp'`. The reach is drawn as a band while the drag lasts, and the wheel scrubs the radius mid-drag, reporting each new value to `onRadius`. Under a `pathSymmetry` dep a soft drag moves no symmetric images.
  - **Handle snapping** (`handleSnapPreset`, or `createHandleSnapPreset({ stepDeg, reachDeg, opposite })`, or a thunk of them read on every move). A dragged control handle's angle snaps to multiples of the step (45° by default) and to the line through the anchor's other handle, within the reach (6° by default), keeping its length. The line it snapped to is drawn. A held angle lock wins over the snap; a held length lock keeps the length while the angle snaps.
  
  Both reach the drag through a new member of core's `PathEditExtension`: `drag(start)`, asked as an anchor or handle drag starts, returns the extension's share of it (`PathEditDrag`) — anchors that follow an anchor drag and the share of its delta each moves by (`weights`), where a dragged handle goes after the locks (`handle`), a claim on the wheel mid-drag (`wheel`), and overlays drawn while the drag lasts (`overlays`). `PathEditDragStart` and `PathEditHandleMove` describe what it reads.
  
  `@weasel-js/geom` adds the geometry: `measureAnchorPath`, `softSelectionWeights`, `softSelectionBand` and `softFalloff` for soft selection.
- 66e3696: A derived node inside a container that composes frames paints where its dependencies are painted. Its path is drawn from their world poses, and the walk used to turn it again by the container's rotation; it now turns by the node's own rotation only. A derivation is handed each dependency's pose in the frame of the node deriving, so a path effect, or any `derivePose`, over shapes in another container boxes itself where it paints. `derivedDepOf(source, id, reader)` reads a dependency the way `reader`'s derivation does, and Expand to Paths uses it, so an effect across containers expands where it is drawn.
- 48399c0: `path-tools:bendAlong`'s side stripes stop on the band's edges instead of capping past its inner edge, each running along the band's normal. `path-tools:extremeAnchors`'s tangent reaches nearly across the glyph, 13 units where it was 7.
- 5973184: Every path operation carries `tags` naming the gesture that drives it, so the operations sharing a gesture can be gathered with `actionsTagged` / `taggedActionItems`. Each carries `path` and one of `path-drag`, `path-click`, `path-brush`, `path-box`, or `path-command`, defined once as `PATH_GESTURE_TAGS` and applied with `pathOperationTags(family)` (both new in core). `docs/path-operations.md` lists the operations under each tag. Actions built with `makeHandleCommand` and `joinPathsCommand` now carry `path-command` too. Additive.
- 3378ade: Two path-tools presets for a path's structure, both in `pathTools`:
  
  - `pathStructurePreset` brings `setPathStart` (group `anchors`), which makes the one selected anchor its subpath's start — a closed subpath turns to start there, and an open one reverses when given its last anchor — and `reversePath` (group `path`), which runs paths the other way without changing their shape. In path edit it reverses the subpaths holding the selected anchors, or every subpath, and the anchor selection follows its anchors; outside path edit it reverses every selected path in one undo step. It also draws an arrow at the middle of every segment of the open path, pointing the way it runs, and a ring round each subpath's start anchor, under the chrome id `path-edit.direction` (`PATH_DIRECTION_CHROME_ID`), off until chrome-caps shows it. `createPathStructurePreset(style)` takes their `color`, `arrowPx`, and `ringPx`.
  - `segmentTypePreset` brings `convertSegments` (group `anchors`, Shift+C), which turns the selected segments — those whose two ends are selected anchors — between straight and curved: a line becomes a curve with handles at its thirds, drawing the same line, and a curve drops the two handles that shape it. `params.to` picks `'line'` or `'curve'`; with none it flips the lot. `convertSegmentAt` flips the segment under a Shift+double-click.
  
  Core's `paths` preset gains `setAnchorField`, which writes a typed number into the selected anchors: `{ field, to }` sets every one, `{ field, by }` offsets each. `useAnchorFields()` reads the fields for chrome beside the canvas — the selected anchors' X and Y, `null` where they differ, and a lone anchor's handle X, Y, angle and length — and writes through that action. `segmentUnder` is exported for actions that act on the segment under the pointer in path edit.
  
  An anchor edit now carries a node's vertex colors, `data.vertexColors` and `data.stroke.vertexColors`, and its stroke widths, `data.stroke.vertexWidths`, along with its `data.skin`: an anchor the edit keeps keeps its color and width, one it makes blends its neighbors' (each side of a two-sided width on its own), a deleted one's entry goes, and reordering anchors reorders them. Where an edit reverses a subpath, a two-sided width trades its `left` and `right`, so each edge stays on the side it was drawn on.
- c0d59c6: The path tools gain icons. Smudge brush, Distort, Envelope and Puppet Warp show theirs on the tool and its action; Blend, Bend Along Path, Repeat Along Path, Balance handles and Equalize handles get one each; Expand to Paths and Expand Warp share `path-tools:expand`. All are in the `path-tools` icon namespace. Warp Settings and Edit Path Effect take `core:tune`, and Delete constraint takes `core:delete`.
- f426089: New package, `@weasel-js/path-tools`: the path-editing tricks moved out of core, each family a `FeaturePreset` an app turns on beside core's (`features={['draw', pathTools]}`, or one preset at a time). It holds the Simplify brush, the handle-lock toggles, Bridge and Bridge anchors, Trim segment, Extend to next path, Smudge brush, Harmonize curvature, the curvature comb, Balance handles and Equalize, path constraints, Blend / Bend along / Repeat along, and the warp actions and tools (distort, envelope, puppet, expand, configure). Their action and tool names are unchanged; they are imported from `@weasel-js/path-tools` now, and core's `paths` preset no longer registers them.
  
  Core keeps basic path editing and gains the extension point these are built on: `PathEditExtension`, carried by a preset's `pathEdit`, draws marks on the open path, adds grabbable parts (an `AffordanceRegion` may name a `chromeId` of its own), selects and deletes its marks, and finishes every edit (`finishEdit`). A preset's `chromeRules` sets default visibility for chrome of its own. Breaking for code reading the `editAnchors` dep: `constrainEdit` is `finishEdit`, `selectedConstraint` / `setSelectedConstraint` are `selectedMark` / `setSelectedMark`, and `setConstraints` is gone (`setConstraints(dep, …)` in the package); the dep adds `store` and `extensions`. The overlay slot's `comb` and `balance` options, `PATH_COMB_CHROME_ID`, `PATH_BALANCE_CHROME_ID`, and the constraint colors in `PathEditingOverlayStyle` move to the package's presets. Core now exports what a path command or path-edit feature built outside it needs — `selectedPathNodes`, `withPath`, `reshapeOps`, `commitOps`, `joinPathsCommand`, `makeHandleCommand`, `commitAnchorEdit`, `GEOMETRY_BOUND_DATA`, and the rest — plus `flipAction` and the anchor actions (`selectAnchorAction`, `deleteAnchorsAction`, `nudgeAnchors*Action`), and `makeEditAnchorsDepForTests` and `useEditAnchorsDepSourceForTests` in `@weasel-js/core/test-seams`. The path-effect scene nodes and their derivations stay in core, so a saved document renders without the package.
- ddbb431: `ToolPalette` takes `include`, a filter over the registered tools, and `ariaLabel`, the toolbar's accessible name (default `"Tools"`). Two palettes over one `tools` with complementary filters split a canvas's tools between two toolbars; WeaselDraw shows path-tools' tools in a strip of their own this way.
  
  Envelope mesh's tool key is now Shift+F, beside Distort's F. It was C, which WeaselDraw's crop mode already holds, so the key never reached it there.
- 5f12888: A puppet warp bends through the shape rather than across the plane. The shape's fill is triangulated with its outline as triangle edges (`puppetMesh`) and deformed as-rigid-as-possible (`createArapSolver`), so two limbs that nearly touch no longer move together when a pin on one is dragged. Both linear systems are factored once per pin set; a drag frame only re-solves them.
  
  Breaking: the warp API moved out of the root `@weasel-js/geom` entry into a new `@weasel-js/geom/warp` entry, because a puppet needs the optional `earcut` peer to triangulate. `pathWarpMap` now takes the source path as its second argument, and `rigidPuppetMap` is gone; `puppetMap(source, pins)` replaces it.
- cc11671: More tools and actions gain icons. In core, the Bone and Weight tools (`core:bone`, `core:weight`) and Bend segment (`core:bendSegment`). In `@weasel-js/path-tools`, Trim segment and Extend to next path get their own (`path-tools:trim`, `path-tools:extend`) in place of the Slice knife, on both tool and action; Reverse path, Set path start, Set corners and the corner radius drag, Next corner shape, Convert segments with a straight and a curved variant, and Add extreme anchors get one each; and `path-tools:girth` is drawn for the Girth tool.
- 0430dcc: Every type a public signature names is now exported, so the API reference links it. Signatures that named a file-local point alias (`Pt`, `XY`, `Vec`) take geom's `Point`, and ones that named a local `AnyScene` or `AnyNode` say `Scene<unknown, string, unknown>` or the node type outright. Newly exported: core's `AnnotationFlag`, `AnchorEdit`, `JoinPlan`, `PathEditPreview`, `PathStorageKind`, and `ViewPoseAdapter`; diagram's `RoutedScene`; prefs' `UsePrefsStoreOptions`; symmetry's `SymmetryKindDef`; path-tools' `WarpToolOptions`; and ui's `SceneLayerListProps`.
- f3398d4: The `@experimental` designation is retired. Everything that carried it is now ordinary public API: the actions registry and its built-in action descriptors and icons, the ambient pointer and selection contexts, `CanvasView`, the canvas extension API, the view resolver and viewport layer, the affordance helpers, path-tools' commands and icons, and `registerEffect`. No signatures changed.
- 86a5ec7: The shape builder lives in `@weasel-js/path-tools`, in a directory of its own, rather than in core: import `useShapeBuilderTool`, `planShapeBuilder`, `facesAlong` and their types from there, and mount the tool with `<SceneCanvas tools>`. It carries its own actions, so it needs no preset. Its behavior is unchanged, and core has no code of its own for it.
  
  Core opens its Boolean pipeline to an operation of the caller's own, which is what the shape builder now runs on: `resolveBooleanOperands(adapter, opts)` answers the selection's operands back to front, resolved as the built-in operations resolve them (text outlines, a counted stroke's region and the paint it leaves), and `commitBooleanPieces(adapter, operands, pieces, label)` replaces them with the caller's pieces as one undo step, each minted from the source it names and stacked in that source's slot. `PATHFINDER_STROKES`, what a stroked operand gives the Pathfinder actions, is exported, and `@weasel-js/core/test-seams` adds `rootsTreeForTests`, the flat tree of a fake adapter.
- c2048de: `@weasel-js/path-tools` adds `useShapeBuilderTool` (Shift+M), which builds shapes from the faces two or more selected paths cut each other into. The face under the pointer is shown; a drag unites every face it passes through into one path standing in for the first face's source, so it wears that source's paint, and an Alt-drag deletes them instead, Alt being read live through the drag. A click takes a single face. Every face not taken becomes a path of its own, and each gesture is one undo step. With fewer than two paths selected, a drag marquee-selects. `mode: 'delete'` swaps the two, so a plain gesture deletes and Alt unites. It reads the `booleansAdapter` dep the Pathfinder actions use, and counts an unfilled stroke as the region it covers, as they do.
  
  Core's `<SceneCanvas>` now publishes a `booleansAdapter` of its own over its path leaves (`data.path` drawn through the pose's box), so the Pathfinder actions and the shape builder work on a canvas whose consumer publishes none. A result is minted from the source it stands in for, keeping its layer, parent, frame, and data. A consumer's `useBooleansAdapter` under the canvas still replaces it — for text operands, which this one does not read. `useBooleansAdapterSource` is the hook behind it.
  
  `planShapeBuilder(adapter, opts)` is the engine under it: the faces, `faceAt(x, y)`, and a `commit(picked, 'merge' | 'delete')` that writes the batch. `facesAlong(plan, run, step)` answers the faces a run of points passes through, in the order it enters them.
  
  Core's `createPathOverlay({ id })` holds paths that are not nodes and gives a world-space `RenderLayer` drawing them over the scene, for a tool's `overlay` or a canvas's `layers`. Each path names a role, styled by `PATH_OVERLAY_ROLES` (`'chrome'`, `'picked'`, `'remove'`) or the caller's own.
  
  `@weasel-js/geom` adds `pathFacePieces(...paths)`: `pathDividePieces` with a region that falls apart split into one piece per connected part.
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
- Spiro curves: a curve drawn by its on-curve points alone. `@weasel-js/geom` solves one with `solveSpiro(points, closed)`: an Euler-spiral segment, whose curvature changes evenly along it, runs between each pair of points, and the segments are solved together so tangent and curvature carry straight through every `smooth` point. A `corner` lets its two sides turn independently, `left` continues the straight segment arriving at it, and `right` runs the curve into the straight segment leaving it. `spiroToPath(contours)` writes the solved curve as cubics, splitting a segment wherever one cubic would stray more than a ten-thousandth of its length, and reports which anchor each point became; `spiroContoursOf`, `spiroControlPath` and `spiroContoursFromControl` read the points back out of such a path and in from an edited control path. The `spiro` curve representation in `@weasel-js/geom/curves` now uses the solver.
  
  Breaking: `SharedAnchor.spiroType` takes a `SpiroKind` (`'smooth' | 'corner' | 'left' | 'right'`) where it took `'g2-smooth' | 'g4-smooth' | 'corner'`. G4 points were never solved as such.
  
  `@weasel-js/core` lets a path be drawn from another form it keeps beside it. A node's `data.representation` holds the form, named by its `kind`, and a `PathEditExtension`'s new `representation` (a `PathRepresentation`) says how path edit reads and writes forms of that kind: `editPath` gives what path edit shows and moves in place of the drawn path, `store` turns an edit of it back into the drawn path and the form, the live drag preview included, `anchorMarkers` shapes each anchor's marker (`AnchorMarkerShape`), and `segmentPress` takes a press on the outline in place of Bend segment. A form no representation on the canvas reads is edited as its drawn path and dropped, and `representation` joins `GEOMETRY_BOUND_DATA`, so a path command that replaces the geometry, such as Join or Simplify, leaves plain geometry. `pathEditPathOf` and `storeEditablePath` take the extensions to consult; the `editAnchors` dep's new optional `getOutlinePath` gives the drawn path the segment affordance hit-tests. The insert dep's `'path'` extras take a `data` laid under the path, and `createPointerFollower` is exported for tools that trail the pointer.
  
  `@weasel-js/path-tools` draws and edits spiro curves, all from `src/spiro`. `spiroPreset`, in `pathTools`, brings the spiro representation: a spiro node, `data.path` plus a `{ kind: 'spiro', kinds, at }` form (`spiroNodeData`, `spiroOf`, `withoutSpiro`), is edited through the straight-sided control path through its points, and every edit solves the curve again. Each point draws by its kind: a circle for smooth, a square for a corner, a half-disc facing away from the line for `left` and `right`. Dragging the curve between two points adds a smooth point there and drags it. The preset also brings `setSpiroKind`, which sets the kind of the points selected in path edit, and `releaseSpiro` ("Convert to path"), which turns a spiro curve into an ordinary path. The spiro tool, `useSpiroTool` (Shift+P), mounted through `<SceneCanvas tools>`, places points by clicking, each of the kind its `spiro.placePoint` action's `params.kind` names, Alt-click for a corner, and inserts the curve through the `insert` dep as a `'path'` carrying its form. Its glyph is `path-tools:spiro`.
- 365ab72: Spiro curves have a `g4` point kind: tangent, curvature, and the curvature's first two derivatives all carry through it, so a run of `g4` points bends more evenly than `smooth` ones. A segment with a `g4` point at either end is a cubic-curvature segment rather than an Euler spiral: `fitEulerSegment` takes the two higher terms (`k2`, `k3`) as optional arguments, `EulerFit` carries them (zero on an Euler spiral), and `eulerCurvatureDerivativesAt` answers the curvature's first two derivatives. Where such a segment meets a point that is not `g4`, its curvature's second derivative is zero there. `setSpiroKind` gains the kind as a variant, and path edit marks a `g4` point with a diamond.
- 4cec295: A `tangent` path constraint keeps an anchor's two handles on one line through it, pointing apart — G1 continuity — with their lengths free. Additive.
  
  The solver now works over handles as well as anchors: each handle is an offset from its anchor, so it rides with the anchor as before, and becomes a variable only where a `tangent` reads it. `ConstraintPoint` carries `inHandle` and `outHandle`, `pathAnchorPoints` reports them, `solvePathConstraints` writes the turned handles back, and `solveConstraints` takes `heldHandles` beside `held`. `constrainPathEdit` holds the handles an edit moved, so a handle drag finished through it turns the other handle and leaves the dragged one where the pointer put it. A tangent on an anchor missing a handle cannot hold and is reported as unsatisfied; one the solve could satisfy only by shrinking a handle to nothing is a conflict. `constraintApplies` says whether a constraint can be solved over a set of points.
  
  In `@weasel-js/path-tools`, `constrainAnchors` with kind `tangent` constrains each selected anchor that has both handles, and the overlay marks a tangent anchor with a line touching a circle.
- d705830: A stroke can be drawn with a broad nib. `Stroke.nib` is `{ angle, ratio }`: the nib's edge in radians counterclockwise on screen, and its thinnest width as a fraction of its widest. The stroke is its full width moving across the nib and `ratio` of that moving along it, an elliptical pen's width in between, and it multiplies `vertexWidths` where both are set. Each side of a corner keeps its own width, so a square drawn with a level nib has thin level sides and full upright ones right up to the joins; a round join's arc runs between the two. `strokeToPath`, the renderer's ribbon cache, and SVG export follow it, and since a nib only ever narrows a stroke, bounds and culling are unchanged. `@weasel-js/stroke` adds `nibWidthScale`, the nib as a `WidthScale`, and `widestStrokeWidth`, which culling, picking, and flattening now share; picking used to ignore `vertexWidths`. Draw's stroke properties gain a Nib switch with its angle and thinnest ratio.
  
  A `vertexWidths` entry is a `VertexWidth`: a number, the full width centered on the path as before, or a `{ left, right }` pair giving each edge its own distance from the path, `right` being the side the normal `(−dy, dx)` points to, below a path running in +x on screen. Every reader resolves an entry through `vertexHalfWidths(entry, fallback)` in `@weasel-js/paint`: the tessellator, which carries the difference between the sides as the new `Polyline.offsets` through trimming, dashing, and the nib, and centers caps between the two edges; `strokeToPath`; the inner and outer ribbon; bounds, culling, and picking, through `widestHalfWidth`; and SVG, which writes a pair as `left/right` in `wzl:vertex-widths`. `vertexWidthFromSides` writes equal sides back as a number, and `scaleVertexWidth` scales either form. An entry of zero is now a zero width; it used to take the stroke's `width`.
  
  `useGirthTool` (Shift+W), in `@weasel-js/path-tools`, edits `vertexWidths` by dragging the stroke's edges. Hovering near either edge marks the grab point on it and the width point a press there moves: the anchor at that spot, or one inserted between two with `insertAnchorOnSegment`, so the path keeps its shape. The grabbed edge follows the pointer along the path's normal and the other mirrors it, writing a number; dragging inward pinches the stroke, down to zero. Alt-drag moves the grabbed edge alone and writes a pair. The drag moves the edge as drawn, so under a nib the stored width changes by more. Every drag is previewed live and committed as one undo entry. Alt-click on a width point clears it, so it takes the stroke's `width` again. The stroke last touched shows its anchors, with a line across the stroke at each that has a width. `strokeEdgeNear` in `@weasel-js/stroke` is the hit test behind it: the edge of a stroke nearest a point, measured along the path's normal, with each side's distance as drawn.
  
  A dashed stroke now keeps its per-vertex widths, which it used to drop. The anchor-parameter rule that trimming and dashing share is `anchorParamsBetween` in `@weasel-js/geom/tessellate`.
  
  SVG has no variable width. `serializeSvg` writes a stroke with `vertexWidths` or a `nib` as its outline: the path keeps its stroke attributes at `stroke-width="0"`, which draws nothing, with the real width, the per-vertex widths, the nib, and its markers in the `wzl` namespace, and the outline follows as a filled path in the stroke's paint that draws the marker heads. A node with an opacity wraps both in one group carrying it, so they composite as one layer. Other viewers draw the outline; `parseSvg` drops it and reads the stroke back off the path, and a transform it bakes in scales the per-vertex widths with the width.
- 329aa39: A polygon-pose node rotated after a warp keeps its warp. `resolvePathWarp` used to recover only a move or a resize of the stored coordinates; it now recovers any affine rewrite of them, with the new `fitAffine` in `@weasel-js/geom` (the least-squares affine map between two point sets, falling back to a similarity for points on one line).
- d944b4b: Paths warped together no longer drift apart once one is moved alone. Each keeps its own copy of the shared warp, carried with it; the warp tools now treat paths as sharing a warp only while their copies put the same controls in the same places. A path moved or edited on its own comes back under an id of its own, shows its own controls, and is no longer driven by the others' — and its next edit writes that id to it.
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
- Updated dependencies [275714b]
- Updated dependencies [4da5998]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [89271a6]
- Updated dependencies [72a0ea2]
- Updated dependencies [14b7551]
- Updated dependencies [eec8a5b]
- Updated dependencies [1774dc4]
- Updated dependencies [0a30bde]
- Updated dependencies [8ff3b4b]
- Updated dependencies [02cbe1d]
- Updated dependencies [d2749ce]
- Updated dependencies [a988460]
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
- Updated dependencies [b36ceac]
- Updated dependencies [34f8b09]
- Updated dependencies [ebb8804]
- Updated dependencies [c6a0a52]
- Updated dependencies [628c62d]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [98870f1]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [e4642bb]
- Updated dependencies [3246831]
- Updated dependencies [5eda461]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [e901a2b]
- Updated dependencies [da45b33]
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
- Updated dependencies [1be2ea9]
- Updated dependencies [925dde2]
- Updated dependencies [a322444]
- Updated dependencies [39f86d1]
- Updated dependencies [f3398d4]
- Updated dependencies [86a5ec7]
- Updated dependencies [c2048de]
- Updated dependencies [e562d4b]
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
- Updated dependencies [3318cf7]
- Updated dependencies [70fe7cc]
- Updated dependencies [c4e499e]
- Updated dependencies [5ebf7e7]
- Updated dependencies [ecdf4d0]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1efa251]
- Updated dependencies [1faab2d]
- Updated dependencies [e40a56f]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [329aa39]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/registry@1.11.0
  - @weasel-js/routing@1.11.0
  - @weasel-js/prefs@1.11.0
  - @weasel-js/core@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/renderer@1.11.0
  - @weasel-js/stroke@1.11.0
  - @weasel-js/icons@1.11.0
  - @weasel-js/react@1.11.0
  - @weasel-js/paint@1.11.0
  - @weasel-js/cursor@1.11.0
