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

## Rendering, canvas, and paint

- 2026-10-11: `GlMat3` is `Float32Array | Float64Array`. `PathDrawCommand` takes `CommandFill` /
  `CommandStroke` only. `RectPose.transform` applies to any box pose.
- 2026-10-12: A `LayerGroup` with alpha fades as a group. The image cache has a 256MB budget. A
  full glyph atlas is emptied whole.
- 2026-10-13: An image under a color matrix that only scales channels within 0 to 1 joins its
  batch as a vertex tint. `WeaselRenderer` no longer writes inline `width`/`height` (the removal
  was ruled on 2026-10-11): a kit canvas takes its size from a class in
  `@weasel-js/core/style.css`, and a page without that stylesheet shows it at buffer size.
- 2026-10-07: `{ px }` dashes are screen pixels; `NodeInk.outsetPx`/`insetPx` and `ClipFromPoseFn`
  are exports.
- 2026-10-11 (core split): core's `/renderer`, `/mesh`, and `/patterns-builtin` subpaths stay; the
  renderer's index exports `getProgramSource`, `strokeReachAt`, `boundsMissRect`, and the draw-kind
  registry; `stopsOf`, `fromStops`, `toSvg`, and `colorOf` sit on core's half of a paint kind.

## Text

- 2026-10-11: `BidiResolver.baseLevel` is required; an omitted `direction` is `'auto'`.
- 2026-10-13: An emoji paints as one glyph in its own colors, so text holding emoji measures and
  wraps differently. `GlyphTextureSink` gained required `uploadRGBA` and `subImageRGBA`.

## SVG and paths

- 2026-10-11: SVG import drops hidden content, and `pathFromD` stops at a malformed command.
- 2026-10-12: Trim and Merge are new.
- 2026-10-13: Under `openFill: 'none'` an open subpath is no longer closed by import, export, or
  the booleans. A path mixing closed and open subpaths exports as a `<g>` of two paths.
  `serializeSvg`'s `pretty` indents. `splitByClosure` and `hasOpenSubpath` are new geom API.

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

## Diagram, audio, and labkit

- 2026-10-11: Diagram groups nest and their boxes take presses; the `orthogonal` router turns at
  once after a waypoint where it would double back. Audio has `onDrop`.
- 2026-10-12: labkit's `isEntryShown` takes the resolved schema; `DragState` carries `from`; a
  remote mark write rebuilds the store. `createScore` is new in audio.
- 2026-10-13: The platformer's bed is engine voices, and `voiceLimit` went from 24 to 48.

## draw

- 2026-10-11: A double-click on a path inside an isolated group leaves isolation for path edit.
- 2026-10-12: Open replaces the document and Import appends, and Open adopts the file's background
  color. The grid is off by default.
- 2026-10-13: `App.tsx` is split into `Editor`, `Workspace`, and hooks, and two dev pages were
  split with no entry asking for it.

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
