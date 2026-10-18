# Calls made without a ruling

For the owner, when ruling, and for anyone about to build on one of these. Each line is a behavior
or API change that an agent or a session made on its own judgment and that nobody has confirmed.
All of it is on `main`, each change is one commit with a changeset that says so, and each is
reversible. A date is the day the call was made. When a call is ruled on, delete its line; a
ruling that leaves work becomes a `docs/TODO.md` entry.

Either/ors an agent settled on 2026-10-11, one commit each: `9dfd8a5aa`, `d3635ee3f`, `87f162fec`,
`e023a51e7`, `d16306d2e`, `cf170b8ea`, `3dff419d8`, and `8261c9c44`.

## Input, tools, and gestures

- 2026-10-11: `useHoverTracking`, `useLassoTool`, `usePenTool`, and `TargetPredicate` changed
  signature; `ContributionsApi.scopedBindings()` is gone; a mode-barred tool stops drawing its
  overlay.
- 2026-10-11: Pen: Enter on one anchor, or a double-click from idle, discards the stub.
- 2026-10-11: The dispatcher's `subscribe` no longer fires for input with no gesture in flight, and
  a throwing `onEnd` is logged, not thrown. `MultiTouchEvent` gained an optional `end`.
- 2026-10-12: Mode eligibility needs every tag allowed. A `<select>` is not a text field. New: a
  `hover` gesture, range selection, and `fixedSeat` in gestures.
- 2026-10-13: Shift snaps a rotate to 15 degrees by default. `multiTouch.rotation` is degrees since
  the gesture began. `ToolBounds` is gone from routing. A marquee or lasso wholly inside a
  stroke-only shape no longer selects it. A `modifierHeld` rule matches on a `<SceneCanvas>` and
  reads modifiers window-wide, a focused text field included.
- 2026-10-07: `gestureViewReader` and `gesturePlaneReader` type their `view`; `FEATURE_ACTION_IDS`
  lost its `pick` and `transform` keys; callback types are bivariant.
- 2026-10-13 (pass 6): One `heldPointers(element)` in `@weasel-js/gestures` answers for the
  dispatcher's hover, `useSurfaceInput`, and `usePointerPublisher`. A move with a secondary or middle
  button held is no longer a `hover`, the `pointer` dep no longer reports a drag that began off the
  canvas, and `PointerInput.heldCount` is gone.
- 2026-10-13 (pass 6): `BehaviorResult.pose` and `BehaviorMoveResult` are gone; `transform` is the
  only way a move behavior moves the drag.
- 2026-10-13 (pass 6): A canvas's `clientToWorld` override reaches its views: `createViewResolver`
  takes `toLocal`, `ViewTarget` carries `world`, and `SurfaceHandle.origin()` is gone.
- 2026-10-13 (pass 6): `HoverSpec.motion: 'leave'`, written `hover(leave)` in a route. Crossing
  between targets is a leave for a binding that targets the first, and a press is not a leave.
- 2026-10-13 (pass 6): Wheel, pinch, and key zoom take `axis: 'both' | 'x' | 'y'`. A `view` prop
  that moves when the runner has written no frame since it last moved cancels a glide.
- 2026-10-13 (pass 6): A marquee and an enclosing lasso take a node by its drawn outline.
- 2026-10-13 (pass 6): `useTextEdit` and `useSceneTextEdit` take `onStart(id)` and `onEnd(id)`.
- 2026-10-14: A held-key tool (Space for the hand, draw's `o` opacity scrub) engages only between
  gestures; mid-drag, Space repositions the shape being drawn. A Space still held when the drag
  ends does not engage the hand until pressed again. The pencil and text tools take no reposition.
- 2026-10-14: Cmd+D is Transform Again and Duplicate moved to Cmd+Shift+D; with nothing recorded,
  Transform Again duplicates. Nudges and Alt-drag clones are recorded. A resize repeats by
  proportion with no aspect lock or snapping, a rotate about the new selection's center. The
  memory is per scene and undo does not clear it.
- 2026-10-14: Shift on a control handle drag keeps its angle; the handle shrinks onto its anchor
  but does not flip through it. Retract and Symmetric have no default shortcut.
- 2026-10-18: Create Outlines moved from Mod+Shift+O to Mod+Enter (Affinity's Convert to Curves)
  and Average Anchors from Mod+Alt+J to Mod+Alt+Shift+J, off chords Chrome takes first.

## Scene, move, and history

- 2026-10-11: A node with `derivePose` and a `dependsOn` list hands a drag to its dependencies,
  engine-wide. A `momentum` coast is pose overrides until it rests (`MoveAdapter` gained
  `previewPoses`), and an undo mid-coast stops it only if it moves that node. `Scene` gained a
  required `mintId`, and ids lost their `paste-`/`pn-`/`kit-` prefixes. Paste drops a derived node
  whose function is unregistered.
- 2026-10-11: A broken undo entry throws every time and stays on the stack. `loadState` throws
  inside `batch` or `untracked`.
- 2026-10-12: A removal deselects its nodes. A replayed op whose node is gone is skipped. An
  adapter whose layer list changes must implement `subscribeLayers`. `/clone` exports types only.
  New layouts: `slots`, `pack`, `quadtree`, and `perContainer`.
- 2026-10-13: `TargetTransform` is `{ identity, toWorld, toLocal }` and `annulusSemiAxes` takes
  one, so chrome follows a pose's `transform`. A pre-built `{ layer }` in `<SceneCanvas layers>`
  paints.
- 2026-10-13 (pass 6): Every adapter carries the tree: `getNode`, `getParent`, and `getChildren`
  are required on `MoveAdapter`, `InsertAdapter`, `BooleansAdapter`, and `CreateOutlinesAdapter`,
  `AlignAdapter` and `DistributeAdapter` need `getParent`, and `OrderedAdapter`'s methods are
  required. `BooleansAdapter.getZOrder` is gone. An op applied to an object without the tree
  methods throws where it used to skip.
- 2026-10-13 (pass 6): A duplicate or clone re-points each `dependsOn` id that was copied and keeps
  the rest on the originals.
- 2026-10-13 (pass 6): `<SceneCanvas layouts>` and `sceneToAdapter({ layouts })` are gone, with
  `useLayoutArrivals`, `layoutArrivalHandler`, `LayoutSource`, and `LayoutArrivalOptions`: a
  container's layout is the one its node declares. `useLayoutDepSource` is `(scene, dropTarget?,
  reflow?)`.
- 2026-10-13 (pass 6): A container's `transform` composes into its children under
  `composeRigidPose`, and a group resize writes a turned leaf's shear to its `transform`. The
  default node properties show a pose's `transform` as a Skew switch that can only clear it.
- 2026-10-13 (pass 6): A scene slot's `toPose` is handed the node at its effective pose, and a
  dependency's `path` in a scene that composes frames answers a pose override's path.
- 2026-10-13 (pass 6): Pages are rects in one world space over one scene, in core: `layoutPages`,
  `pageAt`, `pageOfBounds`, `pagesBounds`, `adjacentPage`, `pagesLayer`, and `fitViewToPage`. An
  object is on the page it overlaps most.
- 2026-10-13 (pass 6): A slider drag in `SelectionPanel` is one undo step: moves are written
  through `scene.untracked`, and letting go records one batch. `PropertyRenderContext` gains
  `drafts`.
- 2026-10-13 (pass 6): `overChildren`, `isOverChildren`, and `splitOverChildren` are new core
  exports; a container's `data.label` draws over its children through them.
- 2026-10-13 (pass 6): `SceneCanvasApi.ingest` works from first render.

## Rendering, canvas, and paint

- 2026-10-11: `GlMat3` is `Float32Array | Float64Array`. `PathDrawCommand` takes `CommandFill` /
  `CommandStroke` only. `RectPose.transform` applies to any box pose.
- 2026-10-12: A `LayerGroup` with alpha fades as a group. The image cache has a 256MB budget. A
  full glyph atlas is emptied whole.
- 2026-10-13: An image under a color matrix that only scales channels within 0 to 1 joins its
  batch as a vertex tint.
- 2026-10-07: `{ px }` dashes are screen pixels; `NodeInk.outsetPx`/`insetPx` and `ClipFromPoseFn`
  are exports.
- 2026-10-11 (core split): core's `/renderer`, `/mesh`, and `/patterns-builtin` subpaths stay; the
  renderer's index exports `getProgramSource`, `strokeReachAt`, `boundsMissRect`, and the draw-kind
  registry; `stopsOf`, `fromStops`, `toSvg`, and `colorOf` sit on core's half of a paint kind.
- 2026-10-13 (pass 6): A kit canvas adopts its size rule where it mounts, through a new
  `SurfaceCanvas`; the rule is gone from `@weasel-js/core/style.css`, and a server-rendered canvas
  has none before the first client commit.
- 2026-10-13 (pass 6): A run holds 15 textures (`BATCH_TEXTURE_SLOTS` is 16) and up to 8 color
  matrices (`BATCH_MATRIX_SLOTS`), each vertex naming its own. Synthetic bold rides a glyph's
  vertex data and `u_synthBold` is gone. Solids and glyphs are always color-mapped on the CPU.
  Gradients and color glyphs take a vertex tint under a matrix that only scales channels down.
- 2026-10-13 (pass 6): `bindGradient` measures paint space from the gradient's own start or center,
  and `u_gradP0` is gone; `bindPattern` drops whole tiles from the translation.
- 2026-10-13 (pass 6): geom's six-number affine type is `Affine`, with no `Mat3` alias left.

## Text

- 2026-10-11: `BidiResolver.baseLevel` is required; an omitted `direction` is `'auto'`.
- 2026-10-13: An emoji paints as one glyph in its own colors, so text holding emoji measures and
  wraps differently. `GlyphTextureSink` gained required `uploadRGBA` and `subImageRGBA`.
- 2026-10-13 (pass 6): With `direction` omitted or `auto`, `align: 'start'` and `'end'` light no
  Align segment.
- 2026-10-13 (pass 6): `textToPath` refuses text holding an emoji with a new `'color-glyph'`
  reason.
- 2026-10-13 (pass 6): A base kerns against the next base through a combining mark.
- 2026-10-13 (pass 6): The text tool's percent unit is data,
  `{ scale: 0.01, precision: 1, suffix: '%' }`, and a linear unit's `fromDisplay` stores a short
  decimal exactly.

## SVG and paths

- 2026-10-11: SVG import drops hidden content, and `pathFromD` stops at a malformed command.
- 2026-10-12: Trim and Merge are new.
- 2026-10-13: Under `openFill: 'none'` an open subpath is no longer closed by import, export, or
  the booleans. A path mixing closed and open subpaths exports as a `<g>` of two paths.
  `serializeSvg`'s `pretty` indents. `splitByClosure` and `hasOpenSubpath` are new geom API.
- 2026-10-13 (pass 6): A hard line break exports as a `<tspan x dy>` line pitched at the node's
  font size times its line height, with a `data-weasel-lines` attribute for blank lines; `parseSvg`
  merges a line into the previous run when their styles match.
- 2026-10-13 (pass 6): A marked stroke with several subpaths exports as one `<path>` per subpath in
  a `<g>`, with the fill once underneath; a closed subpath loses its start and end markers.
- 2026-10-13 (pass 6): A `<tspan dx>` list is read as per-glyph letter spacing, so one tspan
  becomes several runs.
- 2026-10-14: Make Symmetric splits the difference between the two handle directions and averages
  their lengths; an open path's ends are skipped.
- 2026-10-14: A star or polygon keeps `data.generator`; a path edit, or any of the path commands,
  drops it, and a parameter edit on a path changed by another writer drops it too. Its rotation is
  stored but not shown. An SVG saved without `wd:params-rotation` opens as plain geometry.
- 2026-10-14: Offset puts a grown outline behind its source and a shrunk one in front, selects the
  result, and draw's slider returns to 0 after each commit. Join (Cmd+J) on one path closes it or
  joins its two nearest open ends; two paths join into the first selected; three are refused.
  Simplify treats a turn over 40° as a corner and keeps a straight edge 4× its neighbors whole.
  The path commands drop a node's `skin`. The cut command is `snipAtCrossings`, "Cut at Crossings".

## Animation

- 2026-10-11: `UseAnimatorOptions.setTimer`/`clearTimer` are gone. Timeline handles need
  `subscribePlayback`.
- 2026-10-11 (targets): a coast commits where it stops; `from` defaults to the committed value; an
  outside write to a moving node's pose wins and stops the move; `sceneToAdapter.getPose` answers
  the pose on screen mid-flight while `scene.get(id).pose` holds the destination; `tweenPose`
  joins its key so successive moves add, and `springPose` interrupts at their summed velocity.
- 2026-10-11 (targets): a coast a `tweenPose` takes over hands the distance it had traveled to a
  spring, under `pose:<id>`. An offset canceled under a hold stays on screen beside the hold and
  is committed as the target's last hold leaves; `target.stop({ commit: false })` drops it. Holds
  on an angle axis meet at their average direction by weight. A target's holds reach blits as one
  voice, and weasel no longer uses blits' `locus` or voice `weight`. `arrayAdapter` holds the pose
  on screen while a node moves, and an outside write to a moving node there is overwritten at the
  next frame. A container under `cascadeContainerPose` moves on its target and stops any move a
  descendant had of its own. `seek` and `edit` on a timeline sample their tracks at once, so a
  track's `onTick` is called from them too. `SceneCanvasApi.camera` hands out the canvas's private
  camera animator. A target table's rows run in a blits mix of the table's own.
- 2026-10-11 (targets): a hold released with a commit takes the share it covered of each move with
  it, and a spring's `setTarget(null)` commits where the spring had brought the value.
- 2026-10-11 (core split): the animator's names left core outright, and core re-exports none of
  them; parallax and minimap went the same way. `animator.stagger(items, delay).springPose(...)`
  is gone, replaced by `staggerSpringPose(animator, adapter, { items, delay, to })` in core.
  `Target` gained `committed()`, `commit(value)`, and `axes`, and the animator exports `axesOf`.
  ui, diagram, d3, minimap, and labkit take the animator as a peer, and labkit keeps it out of its
  bundle.
- 2026-10-11 (skinning): weights are one array per joint name, indexed by point, with curve
  handles weighted like anchors. `autoSkin` gives a joint with no child no weight, so a limb needs
  an end joint. A bent path reaches the canvas as `PoseOverride.path`, with the override's pose
  set to the path's bounds, and a hand-written `RigScene` needs `update`. A live `SampledTrack`
  carries `targetName` and `interpolateName`, and a `TimelineEvent` a `name` and `data`; `toClip`
  throws on an `onTick`. A node holding a skeleton does not stop clipping its children by itself:
  a rig node sets `clipFromPose: () => null`.
- 2026-10-12: `rewind` on the pose animations.
- 2026-10-13: A rig posed with `rig.pose` stays posed across a `useRigNode` rebind. `RigEditState`
  gained `painted()` and `paint(next)`. A spring or coast with no `onTick` is not ticked every
  frame. A paused looping timeline seeked to its `duration` stays at the end. A skinned path's
  weights are spliced through anchor edits, not weighed again with `autoSkin`
  (`EditAnchorsDep.applyEdit` takes `origins`). `DerivedDep.path` answers a pose override's path
  ahead of a derived one. `animateOnSetPose` and `animateLifecycle` take the adapter methods they
  use, with changed type parameters.
- 2026-10-13 (pass 6): `loop: n` skips laps as `loop: true` does: a frame that skips whole laps
  fires the outgoing lap's tail and the lap it lands in, and `animator.watch` gets one `lap` event.
- 2026-10-13 (pass 6): `ClipValue`'s object arm is `object`.
- 2026-10-13 (pass 6): When a rig's joints change, the new seat takes over the placement and
  committed pose of every joint still named; a renamed joint stops moving.

## ui, prefs, and theme

- 2026-10-11: `label` and `separator` are `PrefKind`s in `@weasel-js/prefs` (`cce05ca5f`), which
  reverses an earlier call that a label was a leaf only the UI knew. `applyTheme` returns a
  release. `isPlainObject` rejects class instances in theme, prefs, labkit, and forge.
  `CurveEditor` draws `value` whenever no anchor is held, so a consumer must write `onInput` back.
  `RecordCache.set(name, undefined)` is a delete for every consumer.
- 2026-10-12: `--wzl-z-modal` is 1000; gradient handles are 10px; `Tree` lost `onExternalTarget`;
  `tone` and the plot, curve, and badge colors take a `ColorSource`, in hud and forge too; a rail
  page draws in schema order; a `Timeline` with no `transport` draws the readout and Graph switch
  only. New: `win9xTheme` and `platinumTheme`, unit expressions, and per-axis units.
- 2026-10-13: "None" is offered on every paint nested in an object leaf, and a record with no
  `paint` reads as None. A `ColorList` item may be a `ColorSource`. A closed `PrefsStore` warns on
  its first write. A band's `aria-label` carries its range. The bevel themes reach checkbox,
  radio, switch, popover, tooltip, `Dialog`, tabs, sliders, the segmented control, and toolbars.
  `overflow="menu"` on `Bar`, and `QuantityText`, are new.
- 2026-10-07: `@weasel-js/ui` depends on `@weasel-js/react`.
- 2026-10-13 (pass 6): `GradientEditor` edits one selected stop in a single row under the track.
  The per-stop row and its `Stop N at X%` labels are gone, the blend-space switch sits below the
  row, and `selectedStop`, `onSelectedStopChange`, and `disabled` are new.
- 2026-10-13 (pass 6): `ToggleBar`'s `minimal` is the bare rounded segments the other bars draw,
  and `size` sets a minimal bar's font size on all three.
- 2026-10-13 (pass 6): `ActionBar` is a `Bar` of `action` leaves: `icons` takes icon names, and its
  `data-testid` attributes are gone. `PrefGroup` and `PrefSection` gain `overflow` (`'scroll'` or
  `'menu'`), with `scroll` the default.
- 2026-10-13 (pass 6): `PrefLeaf` gains `heading`: `PrefsForm` draws that leaf's control in its
  group's heading and drops its row.
- 2026-10-13 (pass 6): `QuantityText` gains `mute`, and `Slider`, `BandEditor`, and `Transport`
  draw their numbers through it. `MenuButton` rows take `href` and `isCurrent`, and its trigger
  takes `bare`.
- 2026-10-13 (pass 6): `colorSourceCss` writes a source that only names a theme color as
  `var(--wzl-...)`.
- 2026-10-13 (pass 6): `docs/conventions.md` gains a "Shading" rule: a control's own shading stays
  black or white at an alpha, with no token.
- 2026-10-13 (pass 6): A condition reads a setting of `over` the way the surface reads its own
  leaves.
- 2026-10-13 (pass 6): New: `draftChangedAssets`, `entriesDisabled`, `entryDisabledAt`, and
  `PARAMS_TEXT_WAIT_MS`.

## Diagram, audio, and labkit

- 2026-10-11: Diagram groups nest and their boxes take presses; the `orthogonal` router turns at
  once after a waypoint where it would double back. Audio has `onDrop`.
- 2026-10-12: labkit's `isEntryShown` takes the resolved schema; `DragState` carries `from`; a
  remote mark write rebuilds the store. `createScore` is new in audio.
- 2026-10-13: The platformer's bed is engine voices, and `voiceLimit` went from 24 to 48.
- 2026-10-13 (pass 6): labkit's `dist` inlines no `@weasel-js` package. `LabSwitcher` is a bare
  `MenuButton`, and a trial's viewport controls are kit `Button`s, so their `lk-` classes are gone.
- 2026-10-13 (pass 6): A stored trial or snapshot that fails to load is listed in a strip above the
  workspace with a Discard button. A trial's untouched view is placed again when its viewport
  changes size.
- 2026-10-13 (pass 6): labkit exports `summarizeLeaf`, and its builder gains `.overflow()`.
- 2026-10-13 (pass 6): Audio renders note and noise voices as samples with no `AudioContext`:
  `createNoteKernel`, `createNoiseKernel`, `renderNote`, `renderNoise`, `biquadCoefficients`, and
  `biquadResponseDb`.

## draw

- 2026-10-11: A double-click on a path inside an isolated group leaves isolation for path edit.
- 2026-10-12: Open replaces the document and Import appends, and Open adopts the file's background
  color. The grid is off by default.
- 2026-10-13: `App.tsx` is split into `Editor`, `Workspace`, and hooks, and two dev pages were
  split with no entry asking for it.
- 2026-10-13 (pass 6): The text edit owns `text-edit` mode: it is entered only when an edit opens,
  the text tool and a new insert included. draw no longer strips `lineHeight` from the style it
  exports.

## Build

- 2026-10-07: `react-hooks/set-state-in-effect` is on.
- 2026-10-11 (core split): two size allowlist entries went up one line each (`Specimen.tsx`,
  `createKeyframeLayer.tsx`).
- 2026-10-13: Every store outside the five leaf packages notifies through `createEmitter`, and six
  packages gained a `@weasel-js/registry` dependency. The root and core `tsconfig` `paths` blocks
  are generated (`npm run gen:tsconfig-paths`). `preserve-manual-memoization` is on. Each action's
  code has one directory. New exports to make types nameable: `CameraProps`, `CanvasViewState`,
  `CanvasLayers`, `SceneSlotLayers`, `OpsApplier`, `strokeRegion`, animator's `Naming`, gestures'
  `Point`, and ui's `LiveControl`, `OnTokenChange`, and `OptionKey`.
- 2026-10-13 (pass 6): The release job writes GitHub releases itself with
  `scripts/github-releases.mjs` and cuts a body past 125,000 characters; `create-github-releases`
  is off on the changesets action.
- 2026-10-13 (pass 6): Every package has a page on the site (`#pkg/<name>`), fed by a vite plugin
  from its README, `docs/guides/*.md`, TypeDoc's JSON, and its demos' imports. labkit's VitePress
  site and the `/weasel/labkit/` deploy are gone. The site root no longer scrolls. The demo site
  has a color mode control, defaulting to dark.
- 2026-10-13 (pass 6): `watchProbe()` is a new export of `@weasel-js/forge/vite`, and the site,
  draw, and theme-editor dev servers load it. An isolated story keeps its iframe through a viewport
  change where `moveBefore` exists.
