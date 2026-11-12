# Calls made without a ruling

For the owner, when ruling, and for anyone about to build on one of these. Each line is a behavior
or API change that an agent or a session made on its own judgment and that nobody has confirmed.
All of it is on `main`, each change is one commit with a changeset that says so, and each is
reversible. A date is the day the call was made. When a call is ruled on, delete its line; a
ruling that leaves work becomes a `docs/TODO.md` entry.

Either/ors an agent settled on 2026-10-11, one commit each: `9dfd8a5aa`, `d3635ee3f`, `87f162fec`,
`e023a51e7`, `d16306d2e`, `cf170b8ea`, `3dff419d8`, and `8261c9c44`.

## Input, tools, and gestures

- Ruled 2026-11-10: a release past the drag threshold from its press still clicks when no move crossed
  it first; only a move spends the buffered press.
- Ruled 2026-11-10: a press on a pointer the recognizer already holds reads as a lost release. It cancels
  the stale press first (`pointercancel`, and a multitouch cancel if it was a finger of one), then presses.
- Ruled 2026-11-10: `specificity` ranks a named channel at any phase (`[rect:*]`) 1, above `[*:*]`'s 0,
  though both match every context: naming the channel is the more specific route.
- Ruled 2026-11-10: `keySpecRoute` writes a spec's phase in the route's phase slot, and gives `null` for a
  spec with a physical key `code` or more than one key, which the route grammar has no form for.

- 2026-10-20 (overnight pass): The pointer recognizer measures the double-click window and the
  multitouch tap's hold from a sample's `timeStamp` (the pointer channel passes `e.timeStamp`),
  falling back to handling time when the stamp is missing, 0, or later than the clock (jsdom stamps
  `Date.now()`). Long-press, pan inertia and the stylus readout cap stay on handling time.
- 2026-10-20 (overnight pass): `HoverSpec.held` (`true | 'optional'`, the values `mods` takes;
  `hover ?held` / `hover +held` in a route) keeps reporting a held pointer's moves as hovers marked
  `held`, without claiming them. Leaving the surface is a leave pressed or not; a target-to-target
  leave during a press reaches only a `held` binding. A new dispatcher channel, `channels.hover`,
  attaches hovers without the pointer channel. The loupe aims through `loupe.aim` and
  `loupe.leave`, so `useLoupe` alone no longer aims; it needs `<LoupeGestures>`.
- 2026-10-20 (overnight pass): The bone and weight tools left core with their actions for a new
  `@weasel-js/rig` (`RIG_TOOLS`, `useRigTools`, glyphs `rig:bone` and `rig:weight`), not for
  animator, which core depends on. Core keeps `animation/rig` (`useRigNode`, `bindRig`,
  `skinBinding`) as the runtime binding. Rig declares its two kit settings at their old paths.
  `useRigTools` reads `scene.getSelection()` unless handed one. The rig demo is filed under the rig
  package rather than Animation.
- 2026-10-20 (overnight pass): `selectTool.rotate: false` is decided once, in `resolveFeatures`
  (`selectRotates`): every enabled preset loses its ambient `rotate` bindings and
  `selection.rotation-handle`, while the `rotate` action stays registered. A tool that binds
  `rotate` rotates from the handle, a partial `actions.rotate` merges onto the default, and a
  handle a consumer re-shows with `chromeVisibility` does nothing when dragged and warns nothing.
- 2026-10-19: A tool lives in the package that owns the action it binds, written into CLAUDE.md's
  "What gets its own package". `ToolSet` is the composition unit (`defaultTools`, preset `tools`,
  and `ToolPalette`'s `include` take one); `BUILTIN_TOOL_IDS` is now derived from `BUILTIN_TOOLS`,
  and a shape kind's `family` decides which set names it. draw's `usePathToolsTools` moved into
  path-tools and now also builds spiro and the shape builder.

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
- 2026-10-18: `ModeDefinition.entry.targets` names the routing kinds a `'double-click-target'`
  entry takes (`PATH_EDIT` `['path']`, `TEXT_EDIT` none), and core's
  `modeTriggers(registry, { enter, canEnter })` binds them: ambient tier, so a tool that binds the
  double-click itself (pen, spiro, slice finishing) now wins where draw's `onDoubleClick` observer
  used to enter path-edit alongside it.
- 2026-10-18: `<SceneCanvas isPointerInteractive>` now gates every point hit, not only the
  `onClick`/`onDoubleClick` observers: a rejected node is left out of the select tool's pick,
  the dispatcher's `kind:` classification, `hitAt` and `nodeAtPoint`, and whatever is beneath it
  answers. A click on a node a mode dims no longer selects it.
- 2026-10-18: Routing entries are handed the node beside its data, and `inferredNodeRouting` (the
  default when `routing` is unset) leads with `groupNodeRouting`, which routes a container as
  `'group'` where it was `'unknown'`. `defaultNodeRouting` stays the shape-kind table; a consumer
  spreads `groupNodeRouting` ahead of it.
- 2026-10-18: A double-click on a grouped member names its outermost group inside the entered
  group, so repeated double-clicks drill in a group at a time. Only a node routed `'group'` is
  named, so a container routed otherwise is passed over; the `onDoubleClick` observer still reports
  the node hit, not the group named.
- 2026-10-23: While a group is entered, only what is inside it is reachable, in every
  `<SceneCanvas>` whether or not the consumer dims the rest: presses, marquee, lasso and Select
  All pass over everything else, and over the entered group itself, whose empty box is empty
  canvas. Under the select tool a press outside the group's box, with any modifiers, leaves every
  group the box does not hold (`group.leave.press`) and selects nothing; a double-click there
  leaves on its first press, and its second reaches the node under it. Under any other tool the
  press is the tool's: a Rect drag outside the group draws into it. Double-click entry and Escape
  work under every tool. What is drawn or pasted lands in the entered group, unless a symmetry
  group is active, which takes it first. The frame's color is the `--wzl-entered-group` hook,
  which no theme sets.
- 2026-10-18: Whether a single click on a grouped member selects the group is still open. A single
  click is unchanged and picks the member.
- 2026-10-18: Create Outlines moved from Mod+Shift+O to Mod+Enter (Affinity's Convert to Curves)
  and Average Anchors from Mod+Alt+J to Mod+Alt+Shift+J, off chords Chrome takes first.
- 2026-10-19: Bridge and Bridge anchors moved from Mod+Shift+J, Firefox's Browser Console, to
  Alt+J, beside the Alt-letter anchor selections.
- 2026-10-19 (pass 7): A carry's moves are walked, while nothing is in flight, only for `carry`
  bindings with a `target`: an untargeted ongoing binding is still asked once, as the carry comes
  over, and one whose `enabled` refused that point does not start later where it would accept.
  Asking every binding on every move would re-run a declining `start` per move.

- 2026-10-19 (pass 7): `GroupTransform` is only the translate: its `scale` and `rotate` arms are
  gone, since nothing produced them and resize and rotate behaviors answer bounds and angles of
  their own, which a pivot scale cannot fully say.

- 2026-10-26/27 (agent batches 2–10): Alt+P opens the Pathfinder keymap, with U/I/M/X/D/C/T/R inside it.

- 2026-11-10 (property tests): `findConflicts` compares bindings phase by phase at the dispatcher's
  specificity: one of either phase meets an `initial` or `engaged` one of the same rank, and two of
  different ranks never tie. The separator `mergeMenuDefs` puts between contributions takes the next
  free `~sep<n>` key rather than overwriting a child that holds it.
- Ruled 2026-11-10: two owners' bindings that tie only while one owner is engaged and the other idle
  (`&:engaged` against `&:initial`) conflict, and `findConflicts` reports them.
- Ruled 2026-11-10: key bindings whose `code`s overlap fire on one keystroke whatever their `key`s, and
  `findConflicts` reports them.
- Ruled 2026-11-10: anything one keystroke can fire twice is a conflict. A chord typing no Latin
  character matches by its code's letter or digit, so `findConflicts` reports a modified `key: 'a'`
  binding against one naming `code: 'KeyA'` (and `Digit*` likewise) wherever both take a chord.
- 2026-11-11 (my call, kernel3d second property pass): a camera drag reads a host that answered with its own
  write at once as caught up, so any other camera the dep answers with at the next move is another writer's and
  the drag rebases onto it, even one it saw before (a `home` returning one camera object, pressed mid-drag). A host
  that lands its writes on its next render is still read by what it answers: a camera it showed at the previous move
  is taken for its lag.
- Open (kernel3d second property pass, 2026-11-11): such a lagging host cannot be told apart from another writer
  setting that same camera object again; the drag then moves on from where it was and undoes the write.
- 2026-11-11 (my call, kernel3d second property pass): `orbitBy`, `dollyBy`, `panBy`, and `dollyToward` return the
  camera as it was for an input that is `NaN` or would carry its target, angles, or distance past the double range.
  An infinite or zero dolly factor still reaches the distance limits, as before.

## Snapping

- 2026-10-20 (overnight pass): `SnapBegin` and `SnapCollect` take `parent`, the container a subject
  not yet in the scene lands in; insert and click-to-place pass it, worked out by `insertParent`,
  the container check the insert dep already used (a leaf or missing `insertInto` passes none).
  `gridSnapSource` reads scope from `ids`, else `parent`, else the root. kernel3d passes `parent`
  through, unlike `sources`.
The snap pipeline ([snapping.md](./snapping.md)) landed on 2026-10-18 with these calls in it.

- 2026-10-18: Every `<SceneCanvas>` snaps point gestures (pen and spiro clicks, pen handles, anchor
  drags, line and box insert, click-place, measure ends, the symmetry center) to other nodes'
  anchors, through a default `'path-snap'` source; move, resize and rotate do not get it.
  `snap.omit: ['path-snap']` turns it off.
- 2026-10-18: A rotate snaps to quarter turns and to other nodes' angles without Shift; Shift adds
  the 15° steps. Near the pivot its reach is capped at 30°. `rotate: { behaviors: [] }` no longer
  turns rotation snapping off; `snap.omit: ['rotation']` does.
- 2026-10-18: Shift on a move locks it to the horizontal, vertical or 45° line through the press,
  and Shift on an anchor drag does the same (both new).
- 2026-10-18: Shift on a line insert, a measurement or a pen handle puts the end at the pointer's
  nearest point on the stepped line through the start, rather than keeping the drag's length, and
  that line meets snap targets.
- 2026-10-18: Ctrl suspends snapping on every snapping gesture, a pen drag and an anchor drag
  included; a handle drag keeps Ctrl as its length lock.
- 2026-10-18: One reach, `targets.snapPx`, default 8, replaces `targets.guideSnapPx` (6) and
  `targets.penAnchorSnapPx` (8): guides and alignment now reach 2px further.
- 2026-10-18: A grid is a fallback: alignment or any other target in reach wins its axis, where
  alignment used to add its delta on top of the grid's. A point target beats a line.
- 2026-10-18: An anchor drag meets every point-gesture source, a grid included, and a pen anchor
  joins an open end within `targets.penCloseHitPx` before any snap.
- 2026-10-18: Alignment and equal spacing measure siblings by their drawn box, stroke included, as
  the dragged subject already was.
- 2026-10-18: A measurement end drag keeps its offset from the press, and no longer snaps to its own
  measurement's ends.
- 2026-10-18: A move's behaviors run on the snapped delta and their translate stands, so a
  container's slot preview wins over a snap target in reach.
- 2026-10-18: The symmetry axis knob and a repeat's step handle turn through a `rotate` session:
  they snap to quarter turns and other nodes' angles without Shift (new), Shift keeps the 15°
  steps, Ctrl suspends, and the angle readout draws. With no `snap` dep they do not snap at all,
  Shift included.
- 2026-10-18: Where a move's `geometry` probe sits, the subject's own geometry nearest the press,
  is looked for within the canvas's reach (`targets.snapPx` or `snap.reachPx`), not a fixed 8px.
- 2026-10-18: Snap ties break by source order, then by the order a source yields its targets. A
  point target on the gesture's own `origin` is never offered.
- 2026-10-18: The snap session factory is test-only (`createSnapSession2dForTests` in
  `@weasel-js/core/test-seams`); a host without `<SceneCanvas>` builds its own session from
  `gatherSnapCandidates` and `resolvedSnapMarks`.
- 2026-10-18: The debug overlay's `snap` feature draws every candidate the resolver weighed each
  frame, the ones the result meets filled.
- 2026-10-18: `matchAlignment` and `MOVE_ANCHORS` are removed with the alignment behaviors;
  `matchSpacing` and `measureGaps` stay, built from the same offers as `spacingSnapSource`.
- 2026-10-18: `<SceneCanvas snap={{ originProjection }}>` is new, the one place a pose that is
  neither a rect nor a `Path` says where its origin probe is (it was `gridSnapStrategy`'s `origin`).
- 2026-10-18: kernel3d's `translate` puts its plane at `up · position`, and its insert builds the
  footprint from the two drag ends cast onto the ground.
- 2026-10-18: The site demo `point-snap` is renamed `resize-snap`; links to the old id break.
- 2026-10-19 (pass 7): `resolveSnap`'s `members` is the smallest set that pins the move: a member
  the others already imply (a line taken before a point on it) is dropped, and so cannot decide a
  tie on its order. It still shows in `satisfied`.
- 2026-11-10 (property tests): `resolveSnap` measures a target's reach where the targets alone put the
  probe, so a fallback snapping another axis (a grid line across a guide) never carries a target in
  reach out of it; before, the grid could take both axes from a guide in reach.
- 2026-11-10 (property tests): `measureGaps` measures a box's gap to every box tied for nearest on its
  right, rather than to whichever came first.
- Ruled 2026-11-10: after `matchSpacing` snaps both axes, each axis's spacing is checked again where
  the box ended up, and a snap whose gap the box no longer has is dropped with its marks; a marked gap
  is always one the box has.
- Ruled 2026-11-10: no equal-spacing placement is offered across a gap another box blocks, a sibling
  the box overlaps included.
- 2026-11-11 (my call, kernel3d second property pass): kernel3d's `groundGridSource` offers no line along an axis
  whose line index (the probe's coordinate over the step) is past a safe integer, as guides' `linesIn` lists none
  there: lines a step apart are one number, or none is finite.
- 2026-11-11 (my call, guides second property pass): `roundToCell` leaves a value as it was on a cell size that is not
  a positive finite number, the rule a grid pitch already follows (such a pitch gives an axis no lines). Before, a
  zero, `NaN`, or infinite cell sent every value to 0, and a negative one rounded on its size, ties the other way.
- 2026-11-11 (my call, guides second property pass): `gridSlots` rounds `cols` and `rows` down, and a grid of
  under one column, or of columns that are not finite, has no slots, so `slots` refuses every child; rows under one, or
  not finite, are the default 1. A negative column count placed slots outside the container, and zero or `NaN`
  placed them at `NaN`.
- Open, 2026-11-11 (guides second property pass): snapping a point already snapped can move it again, because reach
  is a disc about the pointer, not about where it lands. A pointer whose two axes are each in reach of a guide but
  whose crossing is not snaps one axis; snapped again from there, the other comes in reach and snaps too. A grid
  fallback can carry a pointer into a guide's reach on its own axis (a guide 18.06 out of 18, the grid moving the
  point 0.125 toward it), and the second snap takes the guide. An axis that comes in reach this way can also carry a
  box off the equal gap its other axis snapped to, so that axis moves too. Otherwise an axis a snap took stays
  (property tested); whether a snap should be a fixed point everywhere, reach measured from the landing, is undecided.
- Open, 2026-11-11 (guides second property pass): the alignment and spacing tolerances are world lengths, not
  relative ones: lines within 0.001 merge, and gaps or overlaps under 1e-6 count as none. A scene snaps alike moved
  anywhere and scaled by 1/4 to 8 (property tested), but drawn at a millionth of its size its lines merge and its
  gaps vanish. Whether they should scale with the boxes, or the view, is undecided.

## Scene, move, and history

- 2026-11-11 (my call, audit round 16, history lane): `scene.jumpToHistoryIndex` (draw's History panel) does nothing
  and returns false while a journal is open, where it walked the scene stack beneath the journal's applied edits.
  Rejected: committing the journal first, which would end the user's mode from a click on the panel.
- 2026-11-11 (my call, audit round 15, scene lane): `sceneToAdapter(scene)` and `useSceneAdapter(scene)` given no
  `selection` read and write the scene's own selection, where they answered `[]` and dropped writes. The boolean,
  outline and shape-builder actions read `adapter.getSelection()` and acted on nothing through such an adapter.
- 2026-11-11 (my call, core actions second property pass): a drag's pointer that is no finite number lands nowhere,
  as routing's sweep and kernel3d's camera already had it. Every drag `inPlane` wraps, the marquee, and the lasso
  decline a press at such a point; move, resize, rotate, clone, insert, the marquee, and the lasso skip such a move
  and go on from the last frame that landed, and the transform drags skip a move whose poses would leave the double
  range the same way. Rejected: dropping such points in the dispatcher, which every package's drags would then rely
  on without any of them checking.
- 2026-11-11 (my call, same pass): a resize that would rewrite a locked node, as a group's resize rewrites its
  members, does not start, after the 2026-11-09 ruling for commands; the press goes on to the next binding. Rejected:
  resizing the members around the locked one, which move and rotate do not do either (they carry it with the group).
- 2026-11-11 (my call, same pass): Nudge, Flip, Group, Align, and Distribute are disabled with `NotApplicable` where
  they would write a pose past the double range or, for Nudge, move nothing; Group also where its members are on more
  than one layer, where it used to be enabled and do nothing.
- Open (core actions second property pass, 2026-11-11): within a few doublings of the double range's edge, Duplicate
  of a node in a turned group writes `NaN`, since the copy's frame inverse overflows, and other immediate actions may
  overflow the same way. Whether the scene should keep poses inside a margin of the range, or each action refuse what
  it cannot write. The stateful property in `dragActions.pbt.test.ts` skips immediate actions once a coordinate is
  past 1e300.
- Open (same pass): a resize of members of a group scaled below about 1e-12 remaps their boxes in world, where they have
  no precision left, so where the group sits decides the result: two members of a group scaled 1e-200, resized by one
  unit, land 1e14 apart for the group moved 3 units. Whether resize should remap in the members' own frame.
  `dragLaws.pbt.test.ts` leaves such resizes out of its translation law.
- Ruled 2026-11-10 (my call, overnight sweep): geom's `tagTypedArrays` and `typedArrayReplacer` escape a plain object
  `reviveTypedArrays` would read as a tagged typed array or a wrapper by writing it inside a `{ "__raw": … }` wrapper,
  the one the editor's snapshots use, since a writer must not write what its reader misreads. The cost: an older
  file holding a plain object whose only key is `__raw` now reads as what that key holds. headless's `sceneToWire`
  reads a snapshot back before tagging it, so one already tagged is still taken as tagged.
- Ruled 2026-11-10 (my call, overnight sweep): the editor's `serializeReplacer` writes a value of the document's
  that `reviveTypedArrays` would take for something it wrote (a plain object shaped like a tagged typed array, plain
  numbers under `commands` or `coords` as an older save's path wrote them, or a `{ "__raw": … }` object) inside a
  `{ "__raw": … }` wrapper, which the reader takes off and reads nothing into. Those had come back as typed arrays.
- Ruled 2026-11-10 (my call, overnight sweep): a save whose node is not an object, or has no string `id` or
  `layer`, or (from version 2) a `kind` other than `mark` or `group`, is refused by `specsFromSerialized` with an
  error naming the node; `sceneFromJSON` refuses `systemLayers` that are not a list of layers with string ids, and
  the editor's `adoptSnapshotPages` a `core:pages` value that is not a `PagesDoc`. Each had failed with a
  `TypeError`. A pose's shape is still not checked: it is the app's pose descriptor's to read.
- 2026-11-11 (my call, editor second property pass): the editor's `docFromSnapshot` and `nodeSpecsFromSnapshot`
  read a copy of the snapshot they are handed and leave it as it was, so the same parsed snapshot reads the same
  every time; `revive` is handed a copy of each node's data. Document values are now revived as node data is.
- Open (editor second property pass, 2026-11-11): `usePages`' `goTo` on a page narrower than the view is wide, beside
  a wider one, leaves `current` naming the wider page, which shows more of its area once the narrow one is fitted:
  pages 100 × 1000 and 1000 × 1000 in a 1000 × 1000 workspace, `goTo('a')` reads back `current: 'b'`, and `add` and
  `step` then work from `b`. Whether `current` should follow the last page gone to until the view moves.
- 2026-10-20 (overnight pass): The document stores every pose in world units; a container's unit
  scope converts only for display, entry and snapping. Grid snapping (`gridSnapSource({ scopes })`)
  and length fields (`measure: 'length'`, `prefLeafInScopes`, `SelectionPanel`'s `units`) use the
  scope every subject node shares. Inside a scope a bare `spacing` counts that scope's base units;
  the grid's origin stays in world space. Only box position, size and text padding are lengths.
  The drawn grid and an insert gesture's snap still use the root scope (filed under Units).
- 2026-10-20 (overnight pass): A transform preview carries pose once, in the scene's overrides:
  `move`, `resize`, and `rotate` handles drop `previewPose` (read `effectivePose(scene, node)`), the
  ghost resolves through `effectivePose`, and selection chrome boxes an in-flight id at its effective
  pose (`useInFlightBounds`). `PoseOverride` gained no `data`; `previewData` stays on the handle. A
  transform follower that previews a node away from its own pose publishes that pose as an
  override; one answering the node's own pose pins nothing, so a derived edge keeps deriving.
- 2026-10-20 (overnight pass): A node's kind has one classifier, the routing kind (`routeKind`, new
  in core; `NodeRouting.classify` calls it). The kind published with the selection is the routing
  kind, so the command palette says "2 paths selected"; a node the table calls `'unknown'`
  publishes none, and `describeKind` still overrides. `SelectionPanel` classifies through
  `routeKind`, passes the node, and has no container case of its own, so a panel given a table
  without the group entry shows a container as `'unknown'`.
- 2026-10-20 (overnight pass): `moveNodes(deps, ids, delta, label)` and `moveNodesOps` in core
  move ids the way a drag commits them, and the move action, nudge, Transform Again, and the
  measure tool's Move By share its op builder. The delta is in gesture coordinates and the
  `poseDescriptor` dep maps it, so it is not 2D-only. A zero delta commits nothing (nudge used to
  write identity ops). `ingest` and paste now declare `poseDescriptor`, `geometryProjection`, and
  `transformFollowers`. A dropped stencil's undo entry reads "Drop".
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
- 2026-10-19 (pass 7): The symmetry guide's angle knob moves out past the farthest corner of the
  group's contents, plus twice its hit radius, when they reach past `knobDistancePx`. With a large
  group that can put it off screen; nothing clamps it to the canvas.
- 2026-10-19 (pass 7): A canvas's `poseDescriptor` stays on the canvas rather than moving into
  `useScene` beside `layoutFrame`. They measure different things: `layoutFrame` measures a
  container in the scene's own coordinates so a layout can run with no view, while a descriptor
  measures for a view. `Kernel3dDemo` builds its descriptor from the scene and the camera, so it
  answers with a projected screen rectangle that no scene could own. A 2D scene whose poses are not
  rects still states both.

- 2026-11-09 (ruled by the maintainer through weasel-8f): Ungroup, Delete, and Cut are disabled, with
  `ActionDisabledReason.Locked` ("Contains a locked item"), while any node they would move, rewrite, or
  remove is locked, and their `run` reads the same answer.
- 2026-11-09 (ruled by the maintainer through weasel-8f): Ungroup never deletes anything through a dissolved
  group's dependents. It removes the dissolved group from every dependent's `dependsOn`, as undoable
  `setDependsOn` ops in the same batch, whether or not the dependent holds a freed child. A node elsewhere
  that derives from the group now survives too, where before it was deleted.

- 2026-11-10 (ruled by the maintainer through weasel-8f): An edit action that would change nothing is
  disabled with `ActionDisabledReason.NotApplicable`, and its `enabled` asks the same question its `run`
  answers. So `deleteAnchors` is off where the path refuses the delete (a two-anchor line keeps its two),
  `constrainAnchors` where the selection makes no constraint of its kind, `unconstrainAnchors` where there
  is none to remove, `setCorners` without a shape or radius or with the corners' own, and `nudgeAnchors`
  and `reversePath` where the selection names no anchor of the path (as an undo that shortened the path
  can leave it). A selection command stays enabled when its result is the selection already held.
- 2026-11-10 (property tests): Align, Distribute, Flip, and the reorder commands follow the ruling above:
  `NotApplicable` where they would change nothing, through the same plan their `run` commits.
- Ruled 2026-11-10 (my call, overnight sweep): a reorder that would shift a locked node's place in the stack
  is disabled with `Locked`, after the 2026-11-09 ruling (a node it would move is locked). It used to throw
  from the scene partway through.
- Ruled 2026-11-10 (my call, overnight sweep): Align and Distribute take a move within rounding of where a box
  already is (1e-9 of the coordinates' magnitude) as no move, so a second run is disabled rather than
  recording an invisible step.
- Ruled 2026-11-10 (my call, overnight sweep): Distribute by centers orders the boxes, and picks its two fixed
  ends, by center rather than by leading edge, so the outermost centers stay and a second run does nothing.
- Ruled 2026-11-10 (my call, overnight sweep): a duplicate or clone of a locked node is locked: the copy goes in
  unlocked, its children under it, and the lock last, in the same batch. A writer never drops data.
- Open (2026-11-10, property tests): Distribute by gaps over boxes that overlap past fitting between its ends
  leaves negative gaps, takes the boxes starting first and last as its ends though another may reach further,
  and can reorder them, so a second run moves them again.
- Ruled 2026-11-10 (my call, overnight sweep): `addPage` (and `addTemplatePage`, which hands its index on) holds an
  `index` past either end of the page order to that end, as `movePage` already did, rather than reading a negative
  one from the end as `splice` does: one rule for an index into the page order.
- Ruled 2026-11-10 (my call, overnight sweep): Trim segment and the Girth tool's `girth.clear`, click commands, are
  enabled outright by a click's point, as Extend to next path is, so the tool keeps the click and the run decides; with
  no click, `enabled` asks whether the press in their params reaches a piece to cut or a set width point to clear, and
  answers `NotApplicable` otherwise. Before, both were always enabled.
- Ruled 2026-11-10 (my call, overnight sweep): `extendToMeet` takes an end within float32 rounding of a stroke (1e-6 of
  its coordinates' magnitude) as already meeting it, so a second Extend to next path is disabled rather than recording
  an invisible step, after the Align ruling above.
- Ruled 2026-11-10 (my call, overnight sweep): `toolStacksOf` reports no stack for a stacked set that names no tool, as
  `withoutTools` leaves one cut to nothing: a palette has no button to draw for it.
- 2026-11-11 (my call, kernel3d second property pass): `POSE3_COMPOSITION.decompose` reads a frame axis whose
  quotient is not finite, a subnormal scale say, as collapsed, the rule it had for a scale of 0. A world pose rebased
  into such a frame lands on the frame's origin along that axis when composed back, not where it was.

- 2026-11-11 (my call, core second property pass): `unionBounds` and `unionAABB` skip a box with a corner that is
  not finite (a `NaN` or infinite field, or an edge past the double range), as `unionAABB` skips a hole, and a union of
  only such boxes is `null`. Before, a `NaN` width counted the box's `x` and not its far edge, and a union of such
  boxes alone came back with a width of `-Infinity`.
- 2026-11-11 (my call, core second property pass): `createMoveToIndexOp` holds its index as the finite integer that
  places alike: `Infinity` as `Number.MAX_SAFE_INTEGER` (the top), `NaN` as 0 (the bottom, where `moveToIndex` already
  put it), a fraction truncated. JSON wrote `Infinity` as `null`, which a reloaded history read as 0.
  `scene.add`, `scene.move`, and `scene.reorder` record the index the node lands at by the same rule (`slotIndex`:
  truncated, held to the ends, `NaN` at the start), so a reorder at `NaN` of a node already first is no edit.
- 2026-11-11 (my call, core second property pass): a box remap from a box of subnormal width or height keeps that
  axis's scale, as one from a box of no extent does: geom's `extentScale`, which `boxToBox`, the rect pose descriptor,
  and `remapRotatedLeaf` share. The true factor is past the double range.

## Rendering, canvas, and paint
- Open (2026-11-11, audit round 16, errors lane): whether a node whose `drawOne` throws should cost only that node.
  Today it costs the frame, on the page and in the render worker alike (each retries once, then waits for a change),
  while a contribution's `beforePaint`/`afterPaint`, an outline glyph, and an ingest handler each cost only
  themselves. Isolating it means a try in the command build, which every `drawOne` call site in core shares.
- 2026-11-11 (my call, core canvas second pass): `reconcileSpecs` puts a group's member back on its own layer after
  the group's spec changes layer and the member's does not, wherever the group's new layer allows; `setLayer` alone
  still carries the whole subtree (fef31b751). The member's spec says where it stands, which is what the render
  worker's copy needs, but a consumer reconciling to specs that expected the old carry would see members stay put.

- Ruled 2026-11-10 (my call, overnight sweep): a marquee or lasso takes a node under several clips only where
  the clips' common part meets it and the region (`PickQuery.intersectClips`), not where each clip alone does:
  the walk's own rule is that a pick never answers for a node the renderer put nothing of on screen.
- Ruled 2026-11-10 (my call, overnight sweep): `markerReach` is a head's farthest box corner from its vertex in
  any direction, since a head turns with its segment. Grab reach and paint boxes for marked strokes grow to
  match; an axis-aligned head reads larger than before by up to √2.
- Open (2026-11-10, property tests): an ellipse a few pixels across flattens, at the renderer's half-pixel
  tolerance, to a few facets whose miters stand off its even outset by up to a pixel, and its drawn box follows
  the true curve instead. Whether the drawn box should follow the mesh at that size is unsettled; the property
  holds the drawn box to the mesh only for ellipses at least 8 px across.
- Ruled 2026-11-10 (my call, overnight sweep): kernel3d's `headFor` gives a head whose `maxShare` is 0 no length
  on a line of unknown (infinite) length, reading `0 · ∞` at its limit: a head allowed no share of the line has none.
- Ruled 2026-11-10 (my call, overnight sweep): kernel3d's `aimSpace3d` unprojects onto the ground at height 0 when
  `up` lies just off an axis, as `createInsert` lays its footprint at 0: the hit is on the ground by construction, so
  rounding left in `up` is no height.
- 2026-11-11 (my call, core second property pass): `zoomAt` takes a `NaN` or negative factor as no zoom on that axis
  (a negative one had turned the axis over, `NaN` had dropped it to `ZOOM_FLOOR`), and a factor of 0 as the clamp's
  minimum, keeping a flipped axis flipped. An anchor that is not finite, or whose world point overflows, zooms about
  the canvas's top-left corner, as the keyboard zoom does. `wheelPan` leaves an axis where it was when its delta is not
  finite or would carry the view past the double range. `hasExtent` reads bounds whose far edge overflows as nothing
  to fit, so `fitViewToBounds` answers `null`.
- Ruled 2026-11-10 (my call, overnight sweep): the minimap fits content too thin for any finite scale (a line
  5e-324 long) at the largest double scale, as an input past the double range is handled at its limit. It was
  fitted at the zoom floor, 1e-9, because an infinite scale normalizes to the floor.

- Ruled 2026-11-10 (my call, overnight sweep): a parallax plane whose view has no finite transform (a `pan` or
  `zoom` so large the camera's offset overflows) draws none of its world sources, tiled ones included: a plane
  that far away is infinitely far, and its screen sources still draw.
- Ruled 2026-11-10 (my call, overnight sweep): `createParallaxPlane`'s `set` with a patch that changes nothing
  neither notifies nor replaces the object `get` returns, as an edit that changes nothing does nothing; the
  plane keeps its own copies of `pan`, `zoom`, and `anchor` pairs, so a caller's later edit to an object it
  passed is not a change the plane misses.
- Open (parallax second property pass, 2026-11-11): `createParallaxPlane`'s `set` compares opts by shape, so a
  write that means the same plane notifies: `pan: 1` over `{ x: 1, y: 1 }`, `zoom: 1` or `zoom: undefined` where none
  was set, `anchor: { x: 0, y: 0 }` where none was. Whether "changes nothing" means the derived view or the opts.
- 2026-11-11 (my call, parallax second property pass): a `space: 'screen'` source inside `createTiledLayer` draws
  nothing under a view with no finite inverse (zoomed to 0 or a denormal on an axis), which collapses the lattice to
  a point; it had been drawn through a transform holding `Infinity`.
- Ruled 2026-11-10 (my call, overnight sweep): loupe's `placeBand` never answers a factor below `ZOOM_FLOOR`, the
  floor the loupe model holds its own factor to: on a host with no room it gives a lens of no size rather than a
  factor of 0 that a point in the lens could not be mapped back through.
- Ruled 2026-11-10 (my call, overnight sweep): the loupe model's `setFactor` asks the surface for no redraw when the
  factor it clamps to is the one it has, as `setMode` already did.
- 2026-11-06 (WebGPU backend): A program with no WGSL, registered after a canvas went WebGPU, draws
  nothing there and is reported once, mirroring a WGSL-only program on WebGL; the canvas is never
  swapped for one of the other context kind, which would lose its listeners and layout.
- 2026-11-06 (WebGPU backend): `pickAt` and `readIds` return promises on both backends;
  `readIdsSync` answers on WebGL and is `null` on WebGPU, where `geometry.picking: 'pixels'` walks the
  shapes instead, because the pick answers inside the pointer event.
- 2026-11-06 (WebGPU backend): A tile of a shared canvas stays on WebGL whatever its `backend`: a WebGPU
  renderer presents its whole buffer, which would wipe the other tiles.
- 2026-11-06 (WebGPU backend): A multisampled WebGPU canvas resolves into a texture of its own and copies
  it to the canvas, one full-canvas copy per frame, so `WeaselRenderer.readPixels` can read the last frame
  as WebGL's preserved drawing buffer allows.
- 2026-10-20 (overnight pass): The lint rule against a bare `getContext('webgl2')` also refuses an
  attributes object with no `stencil: true` and no spread, so `{ ...CANVAS_CONTEXT_ATTRIBUTES, x }`
  passes. labkit's 3D example and its loupe test open shared buffers with those attributes; whoever
  paints a shared buffer first sets its attributes for every tenant.
- 2026-10-20 (overnight pass): `CANVAS_CONTEXT_ATTRIBUTES` is public core API, the one place the
  renderer's WebGL2 context settings are written, since a consumer sharing a buffer with the renderer
  needs them. Test pixel reads go through `@weasel-js/core/testing/canvasPixels` (`canvasGl`,
  `readCanvas`, `pixelAt`), and a lint rule refuses a `getContext('webgl2')` with no attributes in
  browser tests and `testing/` helpers.
- 2026-10-20 (overnight pass): `DrawBatch.pushGlyph` (internal) takes its quad and color as
  objects, since numbers passed to it were boxed. Text layout does not cache a repeated readout
  string's layout: it would flatter `hud-vs-dom.spec.ts`, whose labels cycle through 100 values, and
  do nothing for a real readout. `resolveTextStyle`'s defaults stay read in one place, though they
  cost about 0.2 MB a frame. The allocation profile is `HVD_ALLOC=1` on the existing spec.
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
- 2026-10-18: `<Canvas retain>` takes `false` or `{ minCommands, budget }`, with `false` beating a
  layer's own `retain: true`; `WeaselRenderer.setRetainBudget` is new, and lowering the budget
  below what is held frees every surface.
- 2026-10-18: `retainBudget` counts only kept surfaces; the multisampled scratch buffer is left out
  and freed after a frame that redraws nothing, so a redrawing frame can exceed the budget by one
  canvas-sized multisampled buffer.
- 2026-10-18: Views nest: `<CanvasView parent>` measures `bounds` from the parent's rect, hands a
  thunked `bounds` / `view` the parent's camera and size, cuts the view to the parent, and paints
  only the layers the parent paints. `SceneCanvasApi.viewAt` (with `ViewAt`) is new, a loupe on a
  canvas host magnifies the camera of the view under its aim, and `ResolvableView` and
  `createViewportLayer` take an optional `clip`.
- 2026-10-19 (pass 7): `renderSceneToPixels` leaves annotation layers out unless passed
  `annotations: true`, as the SVG export does; `renderDebugSnapshot` defaults it to `true`, since it
  reproduces the canvas.

- 2026-10-26/27 (agent batches 2–10): The default retain budget is 384 MiB (was 256), with surfaces drawn
  in 1024-px tiles. Rect clips on a single-sampled target snap to 1/16 px.

- 2026-11-10 (property tests): `hslToSrgb` reads a hue of any number of turns, as CSS `hsl()` does.
  `srgbToHsl` caps saturation at 1, so a color past sRGB's gamut, which its doc does not take, no
  longer reports more. `lerpPaint` and `lerpStroke` answer `b`'s numbers exactly at `t = 1`.
- Ruled 2026-11-10: `paintKey` keys every fully transparent solid as one, whatever its color; none draws anything.
  It still keys apart from no paint (`'none'`).
- 2026-11-10 (property tests): `RetainedSurfaces.reserve` drops the surface's key, so until `commit` names a new
  one a lookup redraws rather than compositing pixels from a draw that never finished (043db55ad).
- 2026-11-10 (property tests): Given a width scale (a `{ px }` stroke in a stretched transform), `populatePolylineWidths`
  splits each corner into one point per edge, as a nib does, so a corner's two edges can take different widths and
  a join between them may bevel where one factor drew a miter (5bc9b9479).
- Ruled 2026-11-10 (my call, overnight sweep): the PDF writer writes a miter limit below 1 as 1. PDF refuses
  one below 1, and the renderer bevels every corner under one, as a limit of 1 does.
- Ruled 2026-11-10 (my call, overnight sweep): a PDF dash whose every length rounds to 0 where it is written
  strokes solid, as a dash too fine for the renderer's dash cap does; PDF forbids an all-zero dash array.
- Ruled 2026-11-10 (my call, overnight sweep): the PDF writer drops and reports a path or group clip holding a
  non-finite coordinate before any geometry runs, as it already dropped one `num` refused. A writer refuses bad
  input with its documented report, never a `TypeError` from the stroke outline.
- Ruled 2026-11-10 (my call, overnight sweep): the PDF writer writes each number as finely as the matrices
  around it need: four decimals of each matrix axis's own scale, and coordinates, dashes, and gradient geometry
  to 1e-4 of a page unit. A group scaled to 1e-5 was written as a singular matrix and drew nothing, which loses
  data. Texture tiles are a unit square scaled by the pattern matrix. Dictionary numbers outside a pattern or a
  shading (a form's `/BBox`, `/MediaBox`) keep four decimals.
- 2026-11-11 (property tests): the PDF writer leaves out groups nested more than 512 deep, the SVG reader's
  `NESTING_LIMIT`, reporting `groups nest more than 512 deep; what is deeper is not drawn` once per group cut;
  some tens of thousands deep overflowed the stack (ee3cfe48b). The two limits are separate constants.
- 2026-11-11 (property tests): `writePdf` refuses the whole document, naming the page, when a page's width or
  height is not finite or writes as 0 at the media box's four decimals (below 0.00005). Before, a non-finite side
  threw the internal number error and a side of 0 or less wrote a page its drawing missed (f39af93d3). Clamping
  to a least size instead would write a file where now there is none.
- 2026-11-11 (property tests): text in a TrueType face whose tables the subsetter cannot read whole is drawn as
  outlines with no report, as a CFF or restricted face is; such a face failed the whole file (b368c6537).
  Embedding it whole when `subsetFonts` is false would still hand readers the damaged program.
- Open 2026-11-11: coordinates past PDF's customary real range (about ±3.4e38) are written as plain integers of
  up to 309 digits, which some readers cannot hold. Whether to drop such a command as `num` drops a non-finite
  one is unasked.
- Ruled 2026-11-10 (my call, overnight sweep): the `.lbx` writer writes each of UAX #14's hard breaks in a text
  box (`\r\n`, `\r`, VT, FF, NEL, U+2028, U+2029) as one `\n`, the break P-touch reads; a bare `\r` read back
  as a second line feed.
- Ruled 2026-11-10 (my call, overnight sweep): text an XML document cannot hold even escaped (C0 controls
  other than tab and the breaks, a lone surrogate, U+FFFE, U+FFFF), or a font name holding any control
  character, makes the `.lbx` writer rasterize that text box, or report it skipped without a rasterizer,
  rather than write a placeholder: the box is still drawn, and nothing reads back changed.
- Ruled 2026-11-10 (my call, overnight sweep): `tagTypedArrays` writes a typed array's `NaN`, `Infinity`,
  `-Infinity`, and `-0` as those strings, since JSON writes them as `null` and `0`; older files, holding
  `null`, read as before. An animation clip still refuses a non-finite typed array value, as it does a number.
- Ruled 2026-11-10 (my call, overnight sweep): headless refuses a render request (in Node before a browser
  starts, and again in the page) whose scene is not an object, whose `sourceRect`, `scale`, or `screen`
  entries are not finite numbers, whose `screen` is not nine of them, or whose `format`, `background`,
  `annotations`, or `overlay` has the wrong type, with an error naming the field. Fields it does not know
  pass through.
- 2026-11-11 (my call, kernel3d second property pass): `projectPoint` gives `null` for a pane with no area, and
  `projectAabbToScreen` for a rect with no area, as `rayAt` names no ray there; both give `null` for a camera whose
  near plane is its far one, where every clip depth is `NaN`.
- Open (kernel3d second property pass, 2026-11-11): a camera with a near plane at 0, a field of view of π, or its eye
  at a pole still projects points (all to one depth, or all to the middle of the pane) though `rayAt` names no ray
  through any of them, so it draws what nothing can pick. Whether projection should refuse those cameras too, or
  `rayAt` cast from the eye for a near plane at 0, is unsettled. A near plane past the far one draws depth mirrored,
  and its rays run back toward the eye.
- 2026-11-11 (my call, icons second property pass): headless also refuses in Node a `sourceRect` whose width or
  height is zero or less and a `scale` with a zero axis, which the page's `renderSceneToPixels` refuses, so such a
  request no longer starts Chromium to fail there.
- 2026-11-11 (my call, icons second property pass): the `.lbx` writer rasterizes a command whose object would hold a
  number that is not finite (a group transform with `NaN` or `Infinity`, an infinite stroke width, a scale past the
  double range) and skips such `lbxObjects` with a reason, and `writeLbx` throws a `RangeError` for a `length` that
  is not a positive finite number. A `-0` position is written and reads back as `0`.
- 2026-11-11 (my call, core canvas second pass): a marquee rect with a negative width or height (`rectRegion`,
  `hitTestArea`) is the same rect named from its other corner, as the marquee drag's `rectBetween` already makes it,
  rather than an empty area (5f06b1f0d).

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
- 2026-10-18: `textToPath` outlines synthetic-bold text instead of refusing it: each glyph grows by
  the distance the renderer's field shift moves its edge (0.01 em a side on Inter's atlas), corners
  mitered, curves kept. The `'synthetic-bold'` failure reason is gone. The grown contours overlap
  where they meet and fill once under `'nonzero'`; they are not merged.

- 2026-10-26/27 (agent batches 2–10): A run's `lang` reaches SVG (`xml:lang`), the edit overlay, and
  `textTransform`. A multi-cluster ligature's advance is split evenly, not by the face's caret list.
- Ruled 2026-11-10: the wrap breaks only at a UAX #14 opportunity, so a tab that a line may break before
  (after a space or a zero-width space) opens the wrapped line with the ink after it when no opportunity
  falls between them (`\t!`).
- Ruled 2026-11-10: the wrap follows UAX #14 as written, which lets a line break between a space and a
  combining mark or ZWJ set on it; the next line then opens inside that grapheme cluster, and a caret at
  its start may sit there.
- Ruled 2026-11-10: styling never cuts a code point. `applyStyleToRange`, and so `setFlagOverRange`,
  widens a range end that falls inside a surrogate pair to take the whole character, and `styleAtRange`
  reads a range the same way; a combining mark still styles alone. A pair that authored runs split anyway
  lays out, and case-maps, as one character in the style of the run holding its high surrogate.
- 2026-11-10 (property tests): `gposPairKerning` skips a `kern` feature or lookup whose offsets run past the end
  of the font, as it already skipped such a pair subtable, and keeps the rest of the font's kerning. The default
  outline parser rejects a font that states no units per em or no ascent, so the SDF tier keeps its text, rather
  than handing back a face that measures `NaN`.
- 2026-11-11 (font, second property pass): the default outline parser checks a CFF face's `CFF ` table before
  opentype.js reads it (`outline/cffCheck.ts`) and refuses the face when an INDEX runs past the table, has offsets
  wider than 4 bytes or out of order, or does not start at offset 1, or when a top DICT offset operator holds other
  than its one integer (two for `Private`). The first-offset rule refuses some faces opentype.js would read. The `cmap` subtable opentype.js reads is refused when its records, segments, or groups run past the table or
  name more code points than the format maps (65,536 for format 4, 1,114,112 for 12 and 13), overlaps included. A CFF
  glyph whose outline holds a non-finite coordinate is refused as one glyph, which the registry warns of and serves
  from the SDF tier. A TrueType glyph's path data now keeps the line back to its contour's start before the `Z`.
- 2026-11-11 (font, second property pass): `parseBmFont` refuses an atlas whose glyph or kerning entry is not an object
  or holds a non-finite field, naming it; a `kernings` that is not an array is still read as none.
- Open (2026-11-11, font property tests): a face whose `cmap` maps any code point to a glyph id past its last glyph
  fails to load whole, since opentype.js throws a `TypeError` while naming its glyphs; text in it falls back to the
  SDF tier. Browsers' font sanitizer refuses such a face too. Whether the outline tier should instead drop the stray
  mappings and load the rest is a call about how forgiving the tier is.
- Open (2026-11-11, font property tests): a family name holding U+0000 cannot be written as a CSS string, which reads
  any NUL, escaped or not, as U+FFFD; `cssFamilyName` writes it raw, and CSS names another family.
- Open (2026-11-10, property tests): text set in italic, or in a weight, that has no outline face of its own
  while the upright face does lays out no glyphs at all on the outline tier, so neither the renderer nor the PDF
  writer draws it; the atlas tier fakes the style instead. Whether the outline tier should fall back to the
  upright face with a synthetic slant and weight is a call about the font tiers. pdf's text property registers
  an italic face and draws only weight 400.
- Open (2026-11-10, property tests): a combining mark opening a run, when the run's locale mapping drops
  it (`tr`'s dot after `I`), sends the paragraph to mapping code point by code point, since the mark has
  no piece in its own run to join. Code point snapping does not reach it.
- Ruled 2026-11-10 (my call, overnight sweep): `textClusters` hands clusters back in the line's visual order, not
  sorted by pen, and its first slot opens at the line's start. Tracking tighter than a cluster's advance gives that
  cluster a negative `advance`, since its doc counts tracking in; sorting by pen put a lone mark's following letter
  before it, and the first slot started left of the line.
- Ruled 2026-11-10 (my call, overnight sweep): `runsToMarkdown` checks each change it writes by reading it back, and
  in a grammar whose markers fuse into another marker spells it another way, else drops the flags it cannot say there,
  never styling text with a flag it lacks. A writer never writes what its reader can't read back; dropping follows the
  writer's documented handling of a flag no marker spells.
- Ruled 2026-11-10 (my call, overnight sweep): the edit overlay carries every key a run holds through an edit,
  `fontScale` beside an absolute `fontSize` and `bold` beside the run's own `fontWeight` included, though the other
  key wins what draws, and a solid fill's color as it was spelled. A writer never drops data, so this reverses the
  earlier choice to let the losing key go (2c2d6638b).
- Ruled 2026-11-10 (my call, overnight sweep): styling armed at a collapsed caret is the change it makes to the
  styling the caret sits in, so it can take a flag, a script, or a valued key off (`pendingStyle` holds that key as
  `false` or `undefined`), and the character typed under it lands as a write of the same patch would, bold and a
  weight each dropping the other. Cmd+B at the end of a bold word used to arm nothing (d13b75728).
- Ruled 2026-11-11 (my call, overnight sweep): a character typed at a collapsed caret with nothing armed takes the
  styling `rangeStyle` reports there, the character before it or the first at the start, by one rule both read
  (`runStyleAt`), a caret between two run spans included. An armed style is spent on its first character and the
  ones typed after follow it, so Cmd+B then a word bolds the word; Cmd+B again ends it. It used to style the first
  character alone and type the rest with no run styling at all.
- Open (2026-11-10, property tests): a character typed with nothing armed at a caret between two run spans, where the
  caret sits after a character typed under an armed style, gets a text node of its own and so no run styling at all,
  while `rangeStyle` at that caret reports the character before it. After an armed character in a bold run, the next
  one comes out plain. The session model test puts the caret into a text node before typing there.
- Ruled 2026-11-10 (my call, overnight sweep): text-shaping's `shape` reads its feature settings before its cache,
  so a setting it cannot read (`'smcp,liga'`) is refused every time; it used to come back with the glyphs cached for
  `['smcp', 'liga']` when those were shaped first. A reader refuses bad input with its documented error, never
  sometimes (50b4730c9).
- Ruled 2026-11-10 (my call, overnight sweep): bidi's `analyze` reads a paragraph separator mid-text as UAX #9 does,
  as the end of its paragraph: X8 closes every embedding and isolate there, BD9 pairs no `PDI` past it, and `'auto'`
  takes its direction from before it, so `'\nא'` reads left to right where it read right to left. text's layout cuts
  paragraphs before calling it, so only a separator text does not cut at (U+001C–U+001E) meets this (f533898fb).

## SVG and paths

- Ruled 2026-11-10 (my call, overnight sweep): `serializeSvg` writes a character XML 1.0 cannot hold (a
  control, U+FFFE, U+FFFF, or half a surrogate pair) as U+FFFD and warns once, where it used to drop it
  silently: a writer never silently loses data.
- Ruled 2026-11-10 (my call, overnight sweep): `parseSvg` draws at most 100,000 elements through `<use>`
  references per document (`USE_ELEMENT_BUDGET`), and walks elements at most 512 deep (`NESTING_LIMIT`),
  warning once at each; a doubling chain of references hung, and a deep chain overflowed the stack. Both
  numbers are mine.
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
- 2026-10-18: `svgNodesToKitDrafts` takes `keepEmpty`, which keeps an empty group it is true for
  (drafted at its clip's box or a zero box) and the groups holding it. Draw keeps an effect's empty
  group, so a blend of no steps reopens live; one whose sources were not exported opens as nothing.
- 2026-10-18: `serializeSvg` takes `textLayout` (pass `layoutTextPose`), and `svgNeeds` / `warmSvg`
  take it too. A laid-out `<text>` drops `dominant-baseline`, carries `data-weasel-layout="lines"`,
  puts each line on its baseline with a `y`, marks a wrapped line `data-weasel-lines="0"`, and
  states `data-weasel-line-height`, since its pitch no longer does. A line the layout justified
  writes every word with its own `x`; `LaidOutLineBox.justified` (new text API) says which lines
  those are. Draw's exports and clipboard SVG pass it.
- 2026-10-18: A puppet warp's solve runs five local/global rounds after its two linear steps, then,
  only when a triangle is left turned over, an injective pass (untangling energy of Garanzha et al.,
  2021) with the pins held. Every puppet-warped shape redraws differently, and a drag that starts to
  fold jumps to the injective shape rather than easing into it. The solve is deterministic from the
  pins: it does not warm-start from the previous frame, so a reopened document draws what the drag
  last drew. A pass that runs out of rounds still tangled returns the folded result. Uniform edge
  weights, not cotangent ones, so each system stays the one already factored.
- 2026-10-18: A puppet warp's map is smooth across its mesh (Clough–Tocher) where it was affine
  per triangle, so every puppet-warped shape, saved ones included, redraws slightly differently:
  its bends lose their small corners.
- 2026-10-19: Constraint links on whole-node transforms. The transformed nodes are held as
  transformed and every node a link reaches gives way, its own constraints kept; their own
  constraints are carried unsolved, as before, and so is a link whose nodes all moved. A link that
  cannot hold does not stop the transform: it commits alone and `constraintLinkConflictsOf`
  reports the link. Core's hook is `PathEditExtension.finishTransform`, run as one of the
  `transformFollowers` dep's followers, which the `editAnchors` dep source adds.
- 2026-10-19: A path-edit drag that only previews until release (bend segment, corner, Lengthen,
  Balance, Simplify brush, spiro insert) shows nothing for a frame its constraints cannot hold,
  since that frame commits nothing; the anchor drag still holds its last good frame.
- 2026-10-19: A constraint link is made by Alt-dragging an anchor in path edit (`linkAnchor`): it
  reads where the anchor was released, nearest anchor within 6 screen px first, then a segment,
  rather than asking the snap for what it held to, and puts the anchor exactly there. The link
  goes on the scene's first annotation layer, else on the edited node's.
- 2026-10-19: Linked nodes follow a move, resize or rotate drag through the drag's preview
  (`previewIds`/`previewPose`/`previewData`), as path edit's other nodes do, not through the
  scene's pose overrides, so mid-drag hit-testing and snapping still read them where they were. A
  frame an extension refuses previews the transform alone. A resize's frame is read from poses
  only, so a `data.path` node it scales previews its links from the unscaled path; the commit
  reads the scaled one.
- 2026-10-19: A broken constraint link is drawn on every canvas with `constraintsPreset`, in or out
  of path edit, by a screen-space layer of its own (`createConstraintLinkMarks`): the link's
  constraint mark by the anchor it holds and a dashed line to where the link wants that anchor,
  both in the conflict red. A link that holds draws nothing there. The layer reads the committed
  scene, so a drag that breaks or mends a link shows it on release.
- 2026-10-24: With `svgNodesFromKit`'s `mark` decorator, a mark with children is written as a
  `<g>` of its own element and one `<g>` of its children, even when it neither clips nor copies,
  so a reader never mistakes a clipped child group for the mark's clip. Copies follow as baked
  groups and read back as further children of the mark. Draw tags that outer `<g>`
  `wd:role="mark"`. A mark whose own element is itself a group (text with a background or a
  clip) is not tagged and still reopens as a group.

- 2026-10-26/27 (agent batches 2–10): `transformPath` gives a far-out result an origin by default
  (`autoOrigin: false` opts out).

- 2026-11-09 (property tests): `parseSvg` drops a shape whose geometry it cannot store, a coordinate past
  float32's range from the path's origin either as written or once a transform carries it there, with the
  warning "reaches past the coordinates a path can store", as it drops a `<path>` with an empty `d`. Until
  then such a shape was kept with `Infinity` and `NaN` in its coordinates.

## Animation

- Ruled 2026-11-10: a hold of weight 0 released with a commit commits nothing, even under holds that
  cover the target outright, where a hold that weighs anything gives the committed value its own.
- Ruled 2026-11-10 (my call, overnight sweep): a simulation's alpha decays toward `alphaTarget` without passing it.
  An `alphaDecay` above 1 acts as 1 and lands on the target, and a negative one as 0, which never moves it; d3-force
  takes either unchecked, and above 2 alpha grew without bound to `Infinity`, which no finite input may give.
- Ruled 2026-11-10 (my call, overnight sweep): a tween with its own `interpolate` or `interpolator` is handed exactly
  1 on its last frame (0 when it ends at its start, played backward), whatever its easing answers there, as a tween
  of numbers already ends at `to`: an easing such as `1 - cos(t π/2)` gives 0.9999999999999999 at 1. A d3
  transition's pose and numeric tweens then end exactly at their targets rather than at `a + (b - a) · 1`.
- Ruled 2026-11-10 (my call, overnight sweep): `d3Bind`'s `join` refuses a key the scene already gives a node other
  than a mark on the binding's layer with an error naming the key and the node, before changing anything, where it
  had failed partway with core's "id collision".
- 2026-11-11 (my call, d3 second property pass): a d3 transition's `duration(NaN)` throws a `RangeError` where it is
  set, as the animator's own tweens refuse one; an infinite delay never starts the item, and an infinite duration
  holds it at its start until interrupted. A delay past 2³¹ − 1 ms is waited out, through registry's new
  `after(ms, fn)`, which editor's `useAutosave` uses for its `delayMs` too.

- 2026-11-11 (my call, second property pass): an endless clock whose frames would move it past the double range
  stops at `Number.MAX_VALUE` and keeps its rate, rather than ending or throwing; a frame gap past the range counts
  as the largest double.
- 2026-11-11 (my call, animator second property pass): the animator's own clock takes the clock package's rule: a
  frame gap past the double range counts as the largest double, and the clock stops at `Number.MAX_VALUE`. An endless
  timeline there keeps its playhead inside its lap. A timeline's `duration`, root or nested, throws a `RangeError` on
  `NaN`, as d3's `duration(NaN)` does, and one below 0 plays as 0.
- 2026-11-11 (my call, animator second property pass): an event handler that cancels or seeks its timeline stops the
  rest of that frame's crossings; one that pauses it does not, and the events the frame already crossed still fire.
- Open (animator second property pass, 2026-11-11): a spring or a coast ends at the first frame that finds it under its
  rest threshold, so where it ends depends on the frames: one at 0 → 1 (stiffness 120, damping 14, velocity 18.5)
  ends at a frame at 892 ms, but a single frame at 1062 ms finds it 1.0009 and still moving, and it runs on.
- Open (animator second property pass, 2026-11-11): a `loop` or `tweenLoop` starts each pass on the frame after the
  last pass ended, so every pass drops that frame's overshoot: 3 passes of 100 ms on 100 ms frames end at 350 ms, and
  on 1000 ms frames take a frame each. A timeline's loop carries the overshoot into the next lap.
- Open (animator second property pass, 2026-11-11): a tween, a sampled track, or a target tween between finite values
  whose difference passes the double range (`-1e308` to `1e308`) shows `-Infinity`, `Infinity`, or `NaN` midway. A
  tween's and a track's blend is blits', outside this repository; a target tween's offset, `from - to`, overflows in the
  animator's own offset arithmetic. The second pass's properties keep such endpoints out.
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
- 2026-10-18: `<SceneCanvas poseTransition={{ transition, glides?, enter? }}>` glides what the
  scene writes through the same kind of transition `reflowTransition` takes, reading the new
  `scene.onPoseWrite`, which reports each change's net pose per node with an origin (`'call'`,
  `'ops'`, `'undo'`, `'redo'`, `'layout'`, `'untracked'`) and the edit's label. By default it glides
  calls, undos and redos, not action commits (`'ops'`); a node another override is showing — a
  drag's preview, a pose-target animation — is left to it. `enter` grows in added nodes. `onReflow`
  moved onto a `ScenePoseReports` interface `Scene` extends. AnimationDemo no longer uses
  `animateOnSetPose` or `animateLifecycle`, which stay exported.
- 2026-10-18: `scene.onPoseWrite` listeners take a second argument, the nodes the change removed
  (an undone add among them) as `PoseRemoval`s carrying the node, the pose it was shown at and its
  descendants. The seat's `exit` sees each off as a ghost — drawn on a `departureGhost` layer just
  above the scene, never in the scene, so nothing picks, selects or records it — fading to alpha 0
  through `transition.over(...)`, a new `AnimatedReflow` method; a plain `ReflowTransition` has no
  `over`, so with one a removal still vanishes. `exits` defaults to every removal but an untracked
  one. A node that comes back mid-exit returns from where its ghost was, at full opacity.

- 2026-10-28: `useAnimator` and `useSimulation` take `clock?: ClockHandle` and then run no frame
  loop of their own. The animator plays backward to a clock that goes back, but an animation that
  ended during a scrub is gone and a later seek does not bring it back; one started while the clock
  runs backward ends at once, as under `setTimeScale(-1)`. Changes made between clock frames still
  get one frame from the animator's own loop, and clock frames are skipped while nothing is active.
- 2026-10-28: A simulation on a clock takes one integrator step per `handle.step` ms (else
  1000/60), so `ClockSpec.step` is also the integrator's period; `onTick` fires per step. Its clock
  is meant to be `seekable: false`: time going back owes no steps and the nodes stay put, rather than
  replaying from the start. Time stopped or settled owes none either, and changing `clock` restarts
  a `stop()`ped simulation like a remount.

## ui, prefs, and theme

- Open (2026-11-11, audit round 15, leftovers lane): which minus sign a formatted number uses, and one formatter
  for both. quantity writes a negative with U+2212 (`MINUS_SIGN`, `packages/quantity/src/number.ts`), and plot's
  `formatTick` (`packages/plot/src/scales/tickFormat.ts`) writes `toFixed`'s hyphen-minus, so a chart's tick reads
  `-5` beside a readout of `−5`. Left as it is: the fold is either plot formatting ticks through quantity, or both
  reading one shared sign, and which sign a tick label should carry (U+2212 also changes a copied label) is a call.
- Ruled 2026-11-10 (my call, overnight sweep): a tiling's `columns` is held to at most 2^24, so an `Infinity`
  count lays its items out in one row with finite, whole tracks; past that, a stretched row's tracks stop being
  whole numbers. Why: an input past the double range is handled at its limit.
- Ruled 2026-11-10 (my call, overnight sweep): an ordered slider thumb whose neighbor leaves no room for the gap
  it keeps sits between its neighbors, and failing that inside its bounds, never past them; a drag and a track
  click clamp it to the thumb's own bounds as its keys already did. Why: the bounds are the thumb's limits, and
  the old answer, a gap past the neighbor, left them.
- Ruled 2026-11-10 (my call, overnight sweep): a `range` sweep rounds a step to twelve digits only where that
  is within float drift of it, and walks its ends exactly, so a start of `123456.7890123` is not shortened.
  Labels still show twelve digits, and `frames` of a run that ends always shows that end. Why: "both ends
  included" names the ends given.
- Ruled 2026-11-10 (my call, overnight sweep): `encodeUrlHash` writes a lone surrogate as U+FFFD with a
  warning, and the JSON adapters write a `bigint` as its decimal digits with their usual loss warning. Why: a
  writer writes a placeholder and warns rather than throw on a value it cannot keep.
- Ruled 2026-11-10 (my call, overnight sweep): `urlHashAdapter.delete` of a key the fragment does not hold
  leaves the fragment alone, and `RecordCache.delete` of a record whose delete is still queued does nothing
  and reports nothing. Why: an edit that would change nothing does nothing.

- 2026-11-11 (my call, second property pass): a highlight index that names no item (past the end of a list that
  shrank, negative, or not a whole number) steps, types, and keys as no highlight does in ui-input's `stepStop` and
  `typeaheadMatch`, so Down from past the end lands on the first stop even without wrap, as `tabStep` already reads a
  target gone from the order.
- 2026-11-11 (my call, second property pass): a slider key back into the range from an endless end's stop moves a
  press at a time from the range's end and lands on the step grid, which starts at the range's start; one that would
  cross the whole range stops at its far end, not on the far end's stop.
- 2026-11-11 (my call, second property pass): a record cache that hears another writer change a record while only a
  write of its own is on its way reads the record back from storage once that write lands, and takes what it reads
  as a remote change; the change still reaches `onOverruled` when heard. Open: a value `deepEqual` cannot compare (a
  `Map`, a `Date`) read back unchanged reports as a remote change of the same value.
- Open (2026-11-11): a record cache with `retryMs: 0`, or a negative one, tries a failed read or write again every
  tick for as long as storage fails, since doubling 0 leaves 0; nothing floors the backoff.
- 2026-11-11 (my call, modes/registry/select/menu second property pass): `matchQuery`, a menu's access letters,
  and ui-input's typeahead compare text composed (NFC), so `é` and `e` followed by U+0301 read alike. A query that
  is a lone combining mark no longer finds one the text composed into the letter before it.
- 2026-11-11 (my call, same pass): select's presses, ranges, and store read ids as a `Set` does, `NaN` one id and
  `-0` the same as `0`, as ui-input's selection values do.
- 2026-11-11 (my call, audit round fifteen): a menu takes a space typed within the typeahead window of a letter
  as part of the search, as `rowKey` lists and the hud list do, so typing "save a" finds "Save As…" rather than
  choosing "Save" at the space. A space with no live search still chooses.
- Open (2026-11-11): `matchQuery` and typeahead lowercase rather than case-fold, so `STRASSE` does not find `Straße`.
- Open (2026-11-11): `deepEqual` over values that hold themselves (an array whose item is the array) overflows the
  stack rather than answer.
- Open (2026-11-11): `holderOf` and `outermost` never return on a `parentOf` whose parents loop without reaching a
  selected id.
- Open (2026-11-11): a range whose `between` lists an id twice selects it twice; a selection store holds it once.
- 2026-10-20 (overnight pass): `useRovingTabIndex` swaps Left and Right under right-to-left, in
  `horizontal`, `both` and grid layouts, reading the container's computed `direction` at each key
  unless the new `dir` option says otherwise. ui declares its own `RovingDirection` rather than
  depend on `@weasel-js/text` for `TextDirection`.
- 2026-10-20 (overnight pass): Every params surface reads a leaf's value through `prefLeafValue`
  (`@weasel-js/prefs`): the held value, else the default, with `undefined` and `null` both absent,
  except a paint's `null`, which means no paint. A clearable leaf holding nothing shows cleared,
  so labkit now draws a clearable number empty where its key is missing. `SelectionPanel` keeps its
  unset state for a node without the property. `Bar` and `MenuBar` still draw a missing path unset.
  path-tools' corner panel reports `shape: 'none'` where it passed `null`.
- 2026-10-20 (overnight pass): In `PrefSchemaEditor`, only a node added in this session takes its
  key from its name; a baseline pref keeps its key when renamed, and Changes and `onSubmit` carry the
  name change alone. The Key field stays the way to change a key deliberately.
- 2026-10-20 (overnight pass): `useLeafAction`'s `reason` is renamed `disabledReason`, the prop
  `BarActionButton` reads, so a bar button and a panel row explain themselves the same way. A bar
  button disabled with a reason (ActionBar, BarAction, the loupe) is now focusable and
  `aria-disabled` rather than natively `disabled`; pressing it still does nothing.
- 2026-10-20 (overnight pass): `useRovingTabIndex` takes `columns` and `groupSelector`, and
  `ToolPalette`'s `columns` uses them, each `[role="group"]` starting a row. Left and Right step in
  reading order and wrap; Up and Down stop at the first and last rows (APG grid) and leave the key
  to the page; moving into a short row lands on its last item; a disabled target makes Up and Down
  skip that row; Home and End stay whole-set (toolbar, not APG grid); `orientation` is ignored when
  `columns` is set. The grid is read from DOM order, not measured layout. `rovingTarget` and
  `rovingGridTarget` are now exported.
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

- 2026-10-25 (overnight batch): When a `Bar`'s ordered `actions` run lists one action twice, both copies
  sit at that key's place in the order.
- 2026-10-25 (overnight batch): `Bar` and `MenuBar` conditions read a leaf's default where `values` lacks
  its path, as `PrefsForm` does.
- 2026-10-26/27 (agent batches 2–10): `Tree`, `ItemList` and `LayerList` typeahead cycles on a repeated
  letter, as menus do. Jog and Transport stay left to right in every locale.
- 2026-11-10 (property tests): A `duration` in the units form reads a seconds decimal in either mark, as the
  clock form does, so `1.500s` is a second and a half in `de-DE` though the locale groups with a period.
  `parseUnitExpr` throws on a literal past the range of a number.
- Ruled 2026-11-10: `parseUnitExpr` reads adjacent terms as one value only when every term carries a unit;
  `2 3` and `1ft 2` throw, as `parseNumber` refuses `5ft 3`, rather than supply an operator nobody typed.
- Ruled 2026-11-10: `resolveUnitExpr` throws on a division by zero, and on any result past the range of a
  number, as `parseUnitExpr` already did for a literal.
- Ruled 2026-11-10: a split pref read under `weights` gives an infinite weight the whole blend, the
  limit of an ever-heavier weight. Several infinite weights, a nested product that overflows to
  `Infinity` among them, blend among themselves at equal weight, and the finite ones drop out; the
  blend is never `NaN`. Members whose nested product underflows to 0 everywhere share it equally.
- 2026-11-10 (property tests): `parseTokenValue` unwraps a font family only from a matched pair of quotes, so
  a half-typed `'Open Sans` keeps its quote rather than losing it. Not ruled: chosen so a stack read back
  from what it wrote is unchanged.
- Ruled 2026-11-10: a theme name or axis value holding U+0000 is written with U+FFFD in its place, CSS's own
  reading, both in the attribute theme stamps and in the selector `wzlAttr` builds (`wzlValue`, `axes.ts`).
- 2026-11-10 (property tests): `blendTheme` follows the split-pref ruling above: an infinite share takes its
  whole axis, split equally among several infinite ones, and the finite shares on that axis drop out. It
  used to blend to `NaN`. Not ruled: chosen to match prefs.
- Ruled 2026-11-10 (my call, overnight sweep): `byRank`, and with it the tool palette's group and tool orders,
  ranks a key that its order names twice by the first place it is named; it used to take the last. Why: an
  earlier mention in an order list is the one a reader would take as meant.
- Open (2026-11-10, property tests): the timeline's `insertKey` seeds a new key with what the track reads there,
  which leaves a linear stretch's motion as it was, but in an eased stretch each side runs the easing again
  (`easeInQuad` from 0 to 100 reads 56.25 at 75 ms, and 43.75 after a key at 50). Its doc said an insert never
  changes the motion and now says linear stretches only. Whether an insert should split the easing, where the
  easing allows it, is open; the property draws linear tracks only.
- Ruled 2026-11-10 (my call, overnight sweep): registry's `isPlainObject` takes a prototype from another realm
  as its `Object.prototype` only when it holds its own `hasOwnProperty` and `isPrototypeOf`, so a bare
  `Object.create(null)` standing in as a prototype is not one. storage's JSON check had the stricter test; the two
  are now one definition.
- Ruled 2026-11-10 (my call, overnight sweep): `deepEqual` reads an array's hole as `undefined`, so `[, 1]` equals
  `[undefined, 1]`: a hole reads as `undefined`, and JSON cannot tell the two apart either.
- Ruled 2026-11-10 (my call, overnight sweep): `matchQuery` folds `ς` to `σ`, as Unicode case folding does, so a
  text holding the query exactly matches it wherever the sigma falls.
- Ruled 2026-11-10 (my call, overnight sweep): an emitter's unsubscribe releases only the subscription it came
  from: called again after its listener subscribed anew, it does nothing.
- Ruled 2026-11-10 (my call, overnight sweep): a listener subscribed both to a mode registry and to a
  `createScopingDim` or `createModeDecorations` built on it holds two subscriptions, so it hears a mode change
  from each, and leaving one keeps the other. Sharing one subscription is what let leaving one drop both.
- Ruled 2026-11-10 (my call, overnight sweep): `freshId` throws a `RangeError` when counting from `from` would run
  past the largest number, rather than loop.
- Ruled 2026-11-10 (my call, overnight sweep): a menu number row's default display stops at 20 decimal places,
  quantity's cap, so a value with more reads back within half the twentieth place, and one under 5e-21 as 0. Left
  as is: a row that needs finer values names its own display.
- Ruled 2026-11-10 (my call, overnight sweep): `UnitField`'s default display stops at 20 decimal places too, so
  text it shows for a finer value (5e-324, 1.0000000000000001e-7), typed back, commits the rounded value. Left as
  is, as the menu row's ruling above leaves it; its property retypes only values the display holds exactly.
- Ruled 2026-11-10 (my call, overnight sweep): `sampleByInterpolation` takes a fractional samples-per-segment as
  the whole count below it and a `NaN` or infinite one as 1; `sampleEasing` takes a fraction the same way and a
  negative or non-finite count as 0. Why: the count is of samples, and a fraction dropped every anchor after the
  first, `NaN` gave no points, and a negative count threw.
- Ruled 2026-11-11 (my call, theme second pass): `theme` and `variant` cannot name an axis. `defineTheme` throws and
  `derive` reports it, because `applyTheme` stamps `data-wzl-theme` and `data-wzl-variant` itself and such an axis's
  rule matched nothing. `applyTheme` does not check a `Theme` built by hand. Renaming the attributes instead was
  the other way out.
- Ruled 2026-11-11 (my call, theme second pass): axes loaded malformed are reported, and the rest derives: an axis
  named `__proto__` (a selection cannot hold it, as a record cannot hold a token of that name), and one whose
  default is not a string, which gets no value in a full selection, so a `by` on it reports a missing axis value.
  An axis with no values enumerates no selections, so it bakes nothing.
- 2026-11-11 (theme second pass): `derive` reports a semantic rule whose fields have the wrong types as `invalid`
  (`engine/ruleShape.ts`), and `axisDependencies` leaves it out, where both threw. A categorical ramp's `surface`
  gate takes a 6-digit hex only, as its anchors do. Not ruled: chosen to match the shape checks derive already made.
- Open (2026-11-11, theme second pass): a token a theme produces at only some selections still shows at the others
  in the stylesheet, which cannot unset it: a reference to it there reads the value from where it is declared, while
  `resolveTheme` has no token. Only a definition with issues does this. The same holds across `extends`: a child
  that redefines a ramp with fewer steps still shows the parent's dropped steps at runtime, and `derive` of the
  child lists none of them, with no issue. Whether derive should report a step it drops from the parent is open.

## Diagram, audio, and labkit

- Open (2026-11-11, audit round 15, leftovers lane): how close together two edits must be to undo as one step,
  and who sets it. labkit merges a trial's config writes to one path within a hardcoded 500 ms (`GESTURE_MS`,
  `packages/labkit/src/trial/useTrialWrites.ts`); ui exposes the same idea as the kit setting `history.coalesceMs`,
  default 800 (`packages/ui/src/kitSettings.ts`), read by `PrefSchemaEditor`; ui's Badge lab uses its own 300
  (`packages/ui/src/components/Badge/lab/useLabState.ts`). Left as they are: folding them means picking one default
  and whether labkit reads the kit setting.
- Ruled 2026-11-10 (my call, overnight sweep): the avoid router reroutes a connector its last commit
  found no path for only when something it depends on changes (its ends or stops, an attached shape, an
  obstacle meeting the line it falls back to), so an unchanged scene answers nothing. A commit retries
  such a connector once the others have moved their labels. Why: an update that changes nothing does
  nothing, and the retry keeps a label's interim spot from leaving a path unfound until the next edit.
- Ruled 2026-11-10 (my call, overnight sweep): nudging spreads a bundle only within every obstacle's
  clearance, as `clearance` promises, so parallel runs beside a shape sit closer together than
  `spacing` where the room is short; a run already inside a clearance keeps out of the obstacle itself.
- Ruled 2026-11-10 (my call, overnight sweep): `diagramScene` refuses data in which two specs would
  share an id, with `diagramScene: two things would share the scene id "…"`: a node named for another
  item's part (`a/1` beside a node `a`, `G/label` inside a titled group `G`), or an edge whose `id` is a
  node's. An explicit edge `id` given to two edges with different ends, ports, or label is refused too
  (`edge id "e" names two different edges`); a true repeat is still dropped. Why: these built specs the
  scene then refused with its own id collision, and the second edge under a repeated `id` was dropped
  silently. Escaping node ids in part ids instead would rename every part id that holds a `/`.

- 2026-10-20 (overnight pass): In a forge story test, a story's viewport sizes the story's box, as
  the workshop's stage does, rather than resizing the page: a Chromium resize took 6–13 s on a loaded
  node and timed out Prefs' Rail Filterable. `viewport` is gone from `RunStoryOptions` in
  `@weasel-js/forge/test`, and inside a story with a viewport `window.innerWidth` and media queries
  see the test page's default 414×896.
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
- 2026-10-18: A locked diagram node shows no ports at all, rather than drawn ports that cannot be
  dragged, matching the kit putting no selection or hover chrome on a locked node. A connect cannot
  land on a hidden or locked node's port either.
- 2026-10-18: Audio's `synthVoices: 'worklet'` renders `playNote` and `playNoise` in an
  `AudioWorkletProcessor` from events posted at the call; default `'nodes'`. Until the processor
  has loaded (`unlock()` waits for it), or where it cannot, synth voices play on nodes rather than
  being dropped. A worklet voice is never dropped as `stale`.
- 2026-10-18: Audio's `Scheduler.schedule` takes a fourth argument, `{ reportLate: false }`, so
  `onLate` stays quiet for a worklet voice: the scheduler reaching it late does not make it sound late.

- Ruled 2026-11-10: A Mermaid writer drops, with a warning, a row its kind would not read back: an ER row that is
  not a type and a name, a class member that is blank or a lone `}`, and a blank line past a state's name. A
  mind map node's text that would not read as a node is quoted instead. A sequence participant id that is not a
  plain name, or is `title`, is renamed, its text kept as its label, as the graph kinds rename one.
- Ruled 2026-11-10: A Mermaid timeline period with no label is written as `(untitled)`, with a warning, and reads
  back so, its events kept; a line with no label would add them to the period above.
- Ruled 2026-11-10: Draw-style XML numbers on an edge's cell id (`edge:a->b-2`) when another cell has it, where two
  edges with the same ends, ports, and label were written under one id. The Diagram JSON reader refuses a page
  that is not an object or whose `kind` it does not know.
- Ruled 2026-11-11 (my call, property tests): Mermaid writes a title or name its kind holds on one line with each line
  break as a space, with a warning; a quoted string the kind reads entities in keeps the break as `#10;`. A journey step
  whose name opens with `title` or `section` is dropped, with a warning, since Mermaid reads the line as that statement
  and journey text has no escape; a step with no name is written as `(untitled)`, as a timeline period is. A packet
  field with an empty label reads back as the gap the writer spells the same way. DOT refuses subgraphs nested more
  than 1000 deep, so a document whose containers nest deeper writes DOT its own reader refuses. Containers that hold
  each other in a loop are written apart by DOT and Mermaid, with a warning, as draw-style XML already wrote them.
- 2026-11-10 (property tests): plot draws a quadrant point held to the unit square, as a drag holds it, and no point
  with a `NaN` coordinate; a radius or stroke width that is negative or not finite takes the default, and a radius
  past the plot is cut to it. A radar value short of the center's sits at the center, as `valueAt` holds it. A journey
  step scored `NaN` keeps its name and actors and draws no face. A packet field's fractional bit is the bit it falls
  in. A sankey in a box narrower than a node starts every column at the box's left edge.
- 2026-11-10 (property tests): A log axis over more decades than twice its tick count keeps every `n`th decade, about
  twice the count, rather than one tick a decade. A tick label past the places `toFixed` writes (below 1e-100) takes
  an exponent (`1e-300`), in linear and log scales. A linear span among the subnormals is ticked at multiples of
  itself. A gantt duration of months past the last `Date` runs 30 days a month, and any end is held to the double
  range.
- 2026-11-11 (property tests, second pass, my call): plot's `ordinalScale` and `bandScale` keep a key their
  domain names twice at its first place and list it once. A band padding of `NaN`, and an outer padding that is
  not finite, take the default. `formatTick` holds `decimals` to 0..100. A clip area with no inside keeps what lies
  on its segment or point. A git graph commit with no id takes the first free `#n` from its place, and a branch
  `order` of `NaN` places it as one with none. Where two gantt tasks hold one id, a dependency names the first:
  taking either out, or clearing its id, keeps the dependency while a task still holds the id, and renaming moves it
  only with the first. Open: a reorder that puts the second holder first moves such a dependency onto it silently.
- Ruled 2026-11-10: an xychart's and a radar's data are clipped to the plot area at compile time: a bar is cut at the
  plot's edge, its handle on the cut end; a line is clipped to the plot rect, a radar's outline and fill to its rim;
  a point whose center falls outside is not drawn. Nothing past the area is drawn, and any value stays finite.
- 2026-11-10 (property tests, my call): audio's `biquadCoefficients` clamps a shelf or peaking gain to ±1541 dB, the
  most a `BiquadFilterNode` takes, on both sides (the node clamps only the top); a lowpass or highpass Q far enough
  below 0 dB that 10^(Q/20) underflows is read as 10^-300, so its pole sits at -1 rather than at `NaN`.
- 2026-11-10 (property tests, my call): `spatialize` puts a source further from the listener than a double reaches
  at an infinite distance: silent, or at whole gain under a rolloff factor of 0, and panned along its halved offset.
  A reference distance of 0 silences a source past it even with a rolloff factor of 0, as the option's doc says it
  cliffs. `patternVoicePeaks` leaves out an event on a step the pass never reaches.
- 2026-11-11 (second property pass, my call): a score's `bar` counts the bars since `start` by the steps its
  pattern player has passed, skipped ones included, so a stall past whole bars reports a later bar (a run's first
  report can be bar 1 or more), and `cueBar` counts the skipped bars. A bar whose first steps were skipped is
  reported, and written from its mood, at the first step it books, with that step's time; the steps of it already
  booked play the bar before's notes. The pattern player's `onStep` gets that count as a third argument.
- 2026-11-11 (second property pass, my call): `impulseResponse` refuses a `decayDb` below -770, where the rising
  tail ends past float32's range, as well as one that is not finite, and a `channels` that is not a whole number
  above 0.
- 2026-11-11 (routing second property pass, my call): a sweep skips a move to a point that is not a finite number,
  and hit-tests at most 4,096 points along one move, so a jump longer than 16,384 px is sampled more sparsely; each
  move still hit-tests the point it went to. One Shift+wheel event steps a tool's size at most 1,000 times. A
  long-press's `progress()` reads 0 at a clock or start of `NaN`; a duration that is not above 0, `NaN` included,
  still reads 1. `steppedOption` sheds float noise to 12 significant digits rather than 6 decimal places, and a
  finite option stepped past the double range stops at the largest double.
- Open (routing second property pass, 2026-11-11): a `times` step never moves an option at 0, and grows a negative
  value further below zero. Where a host has no `elementFromPoint`, two overlapping carry surfaces neither of which
  holds the other are picked between by registration order (read from `surfaceAt`, not tested).

- 2026-10-28: `useEffectRunner` takes `clock?: ClockHandle`, treated as seekable, and seeks the
  runner (new `EffectRunner.seek(seconds)`) each clock frame. With a clock, `runner.play()`/`pause()`
  set the clock's rate to `speed` or 0, and `runner.reset()` resets only the runner, which the next
  clock frame moves back to the clock's time. A seek behind a running pass queues one more.
- 2026-10-28: In a `direction: 'down'` rack a branch symbol is its row form mirrored across the
  diagonal; `controlSide` takes `'left' | 'right'`, and a side on the axis the signal runs through
  counts as the default. Hexagon, demux, fork and comparator turn into path outlines with no content
  box; a turned diamond's second exit leaves by its side vertex.

- 2026-10-25 (overnight batch): The Loupe's "Aim: glass" action is bound to `b`.
- 2026-10-26/27 (agent batches 2–10): Plain text is taken by every ingest canvas by default; image paints
  store the picture inline as a data URI.

- 2026-11-10 (property tests, my calls): labkit refuses a stored lab whose version is a number but not a whole one
  of 0 or more (`NaN`, `-1`, `2.5`) as unreadable, which sets it aside, while a version that is not a number still
  reads as 0. A stored `layout` or undocked-panels record that is not a plain object, a list included, starts empty.
  In the settings rail, a root section whose slug a loose root key already holds takes the next free one
  (`grid-2`); a key a root section claims stays free for its slug, as before.
- Ruled 2026-11-10: `.section('')` is no section, exactly as no `.section()` at all, so it reads back unchanged
  through `prefsFromConfig` and `f.prefs`.
- Ruled 2026-11-10: a config write of the value a path already holds changes nothing and records no undo step, as an
  edit that would change nothing does nothing. A gesture whose writes bring the trial's config and state back to
  where it began takes back the step its first write recorded, where that step is the trial's own snapshot; an
  instrument's own history and the lab's `over` keep theirs, since the trial cannot take back their steps.
- Ruled 2026-11-10 (my call, overnight sweep): a mark's share of a side too short to divide by, 0 or so small the
  share overflows a double, reads 0, in its content-box fractions and in its shape alike, as a side of no length
  already did: no `NaN` or `Infinity` from finite input.
- Ruled 2026-11-10 (my call, overnight sweep): `validateConfigSchema` refuses a slider whose `min` or `max` is not a
  finite number, and a number field whose bounds are `NaN`, whose `min` is above its `max`, or whose default lies
  outside them; an absent bound is unbounded. Its own doc names fields whose constraints do not hold as what it is
  for, and a slider's range check already caught the finite cases.
- Ruled 2026-11-10 (my call, overnight sweep): `Hud.add` of a widget already in the HUD changes nothing, and does not
  move it to the top: an edit that would change nothing does nothing.
- Ruled 2026-11-10 (my call, overnight sweep): a HUD menu's text row types any key that is one grapheme cluster, a
  multi-code-point emoji included, and a word move or delete widens to the cluster boundary past where the word run
  stops, since `editKey`'s doc makes a character a grapheme cluster.
- Ruled 2026-11-10 (my call, overnight sweep): a shadow's spread changes its corner radius by CSS Backgrounds 3's rule
  (`spreadRadius`, renderer): a radius under the spread grows by the spread times 1 + (r/spread - 1)^3, so a square
  box casts a square shadow; a HUD inset layer's hole follows the same rule with the spread negated, as the spec
  says for inner shadows.
- Ruled 2026-11-10 (my call, overnight sweep): a symmetry guide handle dropped where it was pressed leaves the group's
  spec and center as they were and records no step, as an edit that would change nothing does nothing. The axis,
  step, and row still follow the pointer's own direction and distance once it moves, so a knob pressed off its line
  turns the axis onto the pointer at the first move.
- Ruled 2026-11-10 (my call, overnight sweep): `bakeCursor` and `cursorFor` bake a size that is not a finite positive
  number at the default 24, as `resolveCursorTier` already reads a spec's size, one rule for both; a size past the
  cap, `Infinity` included, still throws. `brushRing` gives a radius of 0 or more a size of at least one pixel, so a
  brush too small to round to one draws a one-pixel ring rather than the default 24; a negative or `NaN` radius still
  falls to the default.
- Ruled 2026-11-10 (my call, overnight sweep): `protectMask` reads a rect whose size is `Infinity` as running to
  infinity from wherever it starts, minus infinity included, as an input past the double range is read at its limit.
- Ruled 2026-11-10 (my call, overnight sweep): forge's static indexer names a story whose `name` (or
  `storyName`) is the empty string by the next of `storyName` and its export name, as the CSF loader
  already did, where it had named it `''`. Why: the tree and the trial name one story alike, and the
  loader follows Storybook's runtime, which treats an empty name as absent.
- Ruled 2026-11-10 (my call, overnight sweep): forge's URL gives no param to a schema key that is the
  empty string, as it gives none to a key holding a dot. Why: its dotted path reads as its parent's, so
  one param set two leaves.
- 2026-11-11 (forge second pass): theme refuses a token named `__proto__` as an unsafe name, an `invalid`
  issue like any other, where `derive` had dropped it unreported (37e090748). Supporting it instead would mean
  every record of tokens built without a prototype.
- 2026-11-11 (forge second pass): forge's CSS variable save pins an edit to a component or semantic that varies
  on an axis but has no branch for the trial's value, over just that value, where it refused with "which mode this
  trial shows is not known" (b8171e74a). A pin that already leaves the value out was saved this way before.
- 2026-11-11 (forge second pass): in the components view, folders that two libraries open at one path list as
  two rows, keyed apart by a number (507b51f5a), and still share one fold state, which forge stores by path.
- Open (forge second pass, 2026-11-11): a title whose story files sit in two libraries is one component row,
  tagged with its first story's library, while the package filter lists both libraries. No ruling on whether such
  a title should be one row or one per library.
- 2026-11-11 (my call, hud second pass): a HUD button reports each press, hover, and leave through registry's
  emitter, to the listeners held when the report starts: one added mid-report hears the next report, one taken off
  mid-report is skipped, and one that throws is logged and leaves the rest heard (c40e88c77).
- 2026-11-11 (my call, hud second pass): a HUD window ignores a drag's move to a point that is not finite and reports
  no content click for a release at one, and `zoneAt` names no zone for such a point (6c0bec5e0, c7dc1f33a).
- 2026-11-11 (my call, hud second pass): a HUD drops a focus report for a listener once focus has moved past it,
  so a listener that moves focus mid-report leaves the rest hearing only the newer focus (9a6ff1efe). A listener can
  hear the current focus twice when focus moves away and back within one report.
- Open (hud second pass, 2026-11-11): `createRect`, `createImage`, and `createButton` refuse a width or height that
  is not positive, but every widget's `setBounds` takes any bounds, zero, negative, and `NaN` included. Either the
  factories refuse a size `setBounds` would take later (a progress bar's rect at zero width), or `setBounds` should
  refuse what the factories do.
- Open (hud second pass, 2026-11-11): `attachMenuHost`'s detach takes the menu widget off the HUD and gives focus
  back, but leaves the host's menu open, so a later attach on the same host shows it again. No ruling on whether
  detaching should close the host's menu.
- 2026-11-11 (my call, symmetry second pass): a symmetry copy whose transform is not finite is left out, in
  `symmetryTransforms` and every `SYMMETRY_KINDS` row (ce0289dd1). That includes a point turn about a center near
  the double range's end, whose copy would draw at finite places but whose affine's translation overflows; the
  original still draws. Rejected: throwing, which would fail every draw of a group a far drag put there.
- 2026-11-11 (my call, symmetry second pass): `specOfData` reads a field of the wrong type at its default, a kind
  `SYMMETRY_KINDS` does not hold as its own as `mirror`, and a cell that is not a wallpaper cell as `none`
  (b686c535b). It does not report them; nothing in symmetry has a place to.
- 2026-11-11 (my call, cursor second pass): `placeCursorPath` throws a `RangeError` for a scale or move that makes a
  coordinate `NaN` or infinite (e3481a9d2), as `bakeCursor` refuses an infinite size, rather than dropping the point.
- Open (dither second pass, 2026-11-11): `dither()` takes an output grid whose pitch is 0, `NaN`, or infinite, as
  `gridOnScreen` gives for a view scaled to 0, and passes it to the shader, which divides by it. No ruling on whether
  it throws, draws nothing, or falls back to the screen grid.

## draw

- 2026-10-23: Inside an entered group every tool and command works as outside one, page edits
  included, where isolation mode allowed none. The breadcrumb's Exit leaves every entered group at
  once; Escape leaves one.
- 2026-10-12: Open replaces the document and Import appends, and Open adopts the file's background
  color. The grid is off by default.
- 2026-10-13: `App.tsx` is split into `Editor`, `Workspace`, and hooks, and two dev pages were
  split with no entry asking for it.
- 2026-10-13 (pass 6): The text edit owns `text-edit` mode: it is entered only when an edit opens,
  the text tool and a new insert included. draw no longer strips `lineHeight` from the style it
  exports.

- 2026-10-18: "Snap to grid" also snaps resize corners, inserts and pen clicks, as its description
  already said.
- 2026-11-11 (my call, audit round 16, errors lane): a stored document `readStored` cannot parse is copied to
  `<key>:unreadable` with a `console.error`, then the app starts from its fallback as before, and nothing tells the
  user. Open: whether draw and chart should toast it, and whether anything should offer the copy back.

## Build

- 2026-10-20 (overnight pass): labkit keeps `@weasel-js/icons` as a types-only dependency (the
  icon plugin leaves its JS importing nothing from it), and its smoke lists it so. devtools does
  not declare `@weasel-js/renderer`: the importing helper never ships. The root smoke's own
  declaration audit is gone; `check:imports` is the one check, and counts a `testing/` module as
  shipped when the manifest's `exports` names it.
- 2026-10-20 (overnight pass): `@weasel-js/icons-plugin` walks oxc-parser's tree itself from the
  public `visitorKeys` (`src/walk.ts`) instead of `Visitor`, whose `require()` of an ES module fails
  under vitest's vm pool on Node 22 and turned CI's Node 22 leg red from 2026-10-19.
- 2026-10-20 (overnight pass): Five `@weasel-js/ui` subpaths, named in kebab-case after their
  source module as `./paint-value` and `./kit-icons` are: `./stance`, `./portal-host`, `./color`
  (the whole color module, oklch and ramps, from a new `color/index.ts`), `./paint-gradient-track`,
  and `./kit-settings`. Only labkit's `passthrough/weasel-ui.ts` still imports the barrel.
- 2026-10-07: `react-hooks/set-state-in-effect` is on.
- 2026-10-11 (core split): two size allowlist entries went up one line each (`Specimen.tsx`,
  `createKeyframeLayer.tsx`).
- 2026-10-13: The root and core `tsconfig` `paths` blocks
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
- 2026-10-18: icons-plugin's relative imports carry `.ts`, not the `.js` its TODO entry asked for:
  Node's native loader does not map `.js` to a `.ts` file, so `.js` would silence vite's warning
  and still fail `configLoader: 'native'`. tsup bundles them away, as with forge's. An eslint rule
  on `packages/icons-plugin/src` requires the extension.
- Ruled 2026-11-10 (my call, overnight sweep): icons-plugin writes a lone surrogate in an `icon()` name as a
  `\u` escape, since written bare it reaches a bundle's UTF-8 as U+FFFD and names another glyph. A library
  chunk holding any `\u` or `\x` escape is parsed for refs rather than passed over for not spelling one.
- Ruled 2026-11-10 (my call, overnight sweep): the icon registry's `add([])`, and a `provideVariants` naming no
  variant it does not already know, change nothing: no version step, no notice, the same `entries()` array.
- 2026-11-11 (my call, icons second property pass): the icon registry's `add` refuses with a `TypeError` a batch
  holding a table without a string namespace and owner and an object (not an array) of icons, checked before any
  claim. An app build reads its tables in module id order, so where two tables of one namespace and owner disagree
  on a glyph, the one beside the later module id wins every build; a virtual module's variant name is written
  `%uXXXX` per code unit outside `[A-Za-z0-9_.-]` in its placeholder.
- Open (icons second property pass, 2026-11-11): the registry and icons-plugin take a table whose namespace, or a
  glyph's name, holds a colon or whitespace, which no `splitIconRef` reads: namespace `a` with glyph `b:c` and
  namespace `a:b` with glyph `c` share the slot `a:b:c` under two owners. Whether such a table is refused.
- Open (icons second property pass, 2026-11-11): in dev, icons-plugin's tables still follow the order modules were
  transformed in, so `virtual:weasel-icons/all` lists them in that order; the build path sorts by module id.
- 2026-10-19 (pass 7): The rule forbidding the `@weasel-js/ui` barrel covers site, theme-editor,
  and forge's and labkit's `src` as well as draw and chart. Files importing a name no subpath
  publishes are exempted by path in `eslint.config.js` rather than given new ui subpaths, whose
  names are a call not made; labkit's `weasel-ui` passthrough is exempt on purpose.

## weaselchart fourth arc

The arc's design is `docs/superpowers/specs/2026-10-20-chart-fourth-arc-design.md`. These are the
calls its builds made where the spec was silent.

- 2026-10-20 (arc 4, PDF): Text with neither font bytes nor outlines (the canvas text tier, emoji)
  is left out of the PDF and reported through `reportFileWarnings`. CFF/OTF faces and faces whose
  OS/2 `fsType` forbids embedding are drawn as outlines. Spaces are written as glyphs, so copied
  text keeps them.
- 2026-10-20 (arc 4, PDF): Effects, shader and custom-paint groups go to an injected `rasterize`
  hook, which gets a wrapper group carrying the effects and the page view as a fourth argument;
  without a hook they are skipped. Porter-Duff composites draw source-over and are listed in
  `skipped`. `writePdf([])` throws. `exportPagesPdf` lives in `@weasel-js/diagram-formats`, so
  `@weasel-js/pdf` stays free of core.
- 2026-10-20 (arc 4, PDF): `resolveStrokeLengths` takes `{ quantize: false }`, so `{ px }` stroke
  widths resolve at the exact scale in a PDF. `markerDrawCommands`, `syntheticBoldOffset` and
  `emboldenGlyphD` are now exported rather than copied.
- 2026-10-20 (arc 4, audio graph): `connect` refuses any cycle, delay or not. A connect that closes
  a cycle only through an edge still fading out is wired once that edge has closed. The graph's
  output starts at gain 0, so the first `start()` fades in. `apply` validates the whole list first,
  but a `set` that throws lets the rest apply and then rethrows. `dispose()` fades out over `fadeMs`
  while sounding. `delayNode`'s `maxTime` defaults to 2000 ms. `impulseResponse` lives in
  `@weasel-js/audio`, and `reverbNode` builds its impulse from `seconds` (default 2).
- 2026-10-20 (arc 4, live runner): Audio stage types are prefixed `audio.`, and pipeline mode splits a
  mixed pipeline so the image runner never sees them. The runner ships from
  `@weasel-js/diagram/effect-audio`, with `@weasel-js/audio` an optional peer. Stages on a feedback
  loop get the error "on a feedback loop" and no patch. Two wires into one input are summed (the
  editor only allows one; see `docs/TODO.md`). The engine is made lazily on Play or Choose Source
  Audio…. View › Show Spectrum toggles the previews and is off while Show Previews is off.
- 2026-10-20 (arc 4, label drag): Pipeline mode can't drag labels (filed in `docs/TODO.md`). A
  click on a label selects its connector; a double-click edits its text. Reset label skips locked
  and hidden labels and labels on locked edges. Near an outside route corner the dropped label
  sits on the nearest normal, not exactly under the pointer. The menu item reads "Reset label".
- 2026-10-20 (arc 4, groups): Under `rack`, a group whose line members are split by an outsider
  keeps a box over the outsider and can't be dragged; a group with no stage on the main line can't
  be dragged either. Reordering a group rewires the pipeline under both looks. An untitled group's
  grip is the top band of its box, and its rename field opens above the box.
- 2026-10-20 (arc 4, pages): A data-backed diagram reassigns its off-page letters in edge order on
  every build. Pipeline mode gets Page › Add Page and Delete Page (Delete removes the last page and
  leaves its stages). Export puts a shape between pages on the nearest page (`pageHolding`, ties to
  the earlier one) and sends every connector the split splits to `crossPageEdges`. `fitDiagram`
  takes optional extra bounds. `documentBoundsOf` is a new export of `@weasel-js/diagram`.
- 2026-10-20 (arc 4): The `browser` vitest project's `testTimeout` is 45 s, because a chart drag
  test runs 10–24 s on a loaded node; the case rests on one one-process failure on keiei.

## Audit round five (2026-11-07)

Calls the round made:

- `parseColor` throws on a channel that is not a plain CSS number (`rgb(255, 0, 0,)`, `rgb(1 2 3 / foo)`,
  `rgb(0x10, 0, 0)`), where it read them as 0 or alpha 1.
- renderer's mesh writer keeps 6 decimal places, as svg does (`trimNumber`), where it kept 4.
- theme's ramps blend hues through paint's `lerpHueDeg`. Round eight corrected its half turn to CSS Color 4's
  (the sign of `h2 − h1` decides), so two exactly opposite hues go the way they did before round five.
- ui-logic's `clampTo` stays as a deprecated alias of geom's `clamp` rather than being removed.
- `useDragHandle` ignores a second press during a drag; `useHandleDrag` lets one cancel the drag.
- A tiled layer's source still draws without its `effects` and without `drawOneLayer`'s throw
  guard, unlike `createParallaxLayer`'s. Left as is: running effects per copy or once over all copies
  changes how sources stack.
- After `close()`, the storage cache's `flush()` still sends what is queued, against `close()`'s doc.
  Left as is: it may be the intended retry path (`packages/storage/src/records.ts`).
- `VoiceHandle.setPan` keeps the distance attenuation the voice's position last gave it. Left as is:
  dropping it matches a voice started with `pan` but jumps in loudness.
- `createGridPreset({ snap: { origin } })` snaps from `origin`, but `createGridLayer` has no
  `origin` and draws from world zero or its `bounds` corner, so such a preset draws one grid and snaps
  to another. Left as is.
- guides' `quadtree` gives a child bigger than its container the whole container, where an arrival
  with no free cell of its size is refused. Left as is.
- Gradients and animations blend through the 8-bit `lerpColorArray`; `color-mix` through the
  full-precision `interpolateSrgb`, with its own gray-hue rule. Left as is, as the comment there asks.
- `contrastLineColor` reads only hex (a test pins `papayawhip` to black); `contrastRatio` beside it
  reads any CSS color. Left as is.
- Rotate and resize fire `onGestureStart` at press; move fires it on the first movement. Left as is.
- core's `unionBounds` drops a NaN coordinate; geom's `unionRects` passes it through. Not folded.
- forge's `ForgeLoupe` clamp, audio's `scoreMood` clamp, plot's `freshName` and editor's page-run id
  keep their own copies: folding each adds a dependency on geom or registry.
- theme-editor's `#/theme` route is not in `LABS`, so it has no lab switcher. Left as is.

## Audit round six (2026-11-08)

- `HandToolInertiaConfig` and `ActionDisabledReasonValue` stay exported although each duplicates another
  name (`InertiaConfig`, `ActionDisabledReason`): removing them breaks consumers in a patch release.
- `withAlpha01(c, NaN)` writes `'#rrggbbNaN'` and `paintWithAlpha(p, NaN)` sets opacity NaN. Left as is:
  NaN could leave the color unchanged, mean 0, or mean 1.
- A flick's coast canceled from outside (`cancelAll`, or the animator going away) over an adapter with
  `previewPoses` and no pose targets leaves its last frame as a preview and records nothing, as the code
  says it means to. Left as is: it could record where the coast stopped, or clear the preview.

## Audit round seven (2026-11-08)

- `fitViewToBounds`, `fitViewToPage`, `fitZoom`, `fitToBounds` and `computeFitViewport` return `null` for empty
  content, and the viewport's owner resolves it to the reset view (Mike ruled that an empty fit goes to Cmd-0's view;
  the `null` return type, a breaking change, is the agent's way of getting there). Fit Content on a lone point now
  goes to the reset view rather than centering the point.
- Cmd-0 with no `recenter` resets to `HOME_VIEW`, not to the `defaultView` a canvas opened on. Left as is.
- A WebGPU program binds only uniforms holding a struct; `var<uniform> t: f32` fails with "no struct undefined".
  Left as is: support it, or refuse it with a clear message.
- Fill tessellation's `crossingParams` (`stroke/tessellate/sweep.ts`) keeps the exact-zero parallel test; edges
  collinear only up to rounding can take the slower crossing path. Not folded into geom's `nearlyParallel`.
- forge's CSS vars report updates only an overridden var, not the vars defined through it, now in-page as well as in
  frames (the 2026-09-13 no-rescan choice). Left as is.
- draw saves the background (in the scene) and the filename (its own key) on separate paths, with no guard keeping
  them in step if one save lands without the other.

## Audit round eight (2026-11-08)

- loupe's `pixelHex` and `sourcePixel` are gone and `CanvasSource.sample` became `pixel`, folding three samplers
  into one for the eyedropper: breaking, said in the changeset. Not yet ruled whether deprecated wrappers come back.
- A list or menu counts a typed key by code point (`isOneChar` in ui-input), so an emoji types and an access letter
  can be one.
- `lerpHueDeg` with `longer` and two equal hues stays put, where CSS goes a full turn, because an achromatic endpoint
  takes the other side's hue and a full turn would spin a ramp to white or black. Left as is.
- Marquee and lasso extend the selection only with Shift, whatever key the selection extends with. Left as is.
- `ActionSettingsDialog` stays editable when its action turns disabled; the popover disables. Left as is.
- `CommandPalette`'s `reasonLabels` replaces the default wording rather than merging with it. Left as is.
- `createMarkdownRenderer` ignores a run's own `fill`, and under a `textBaseline` other than alphabetic places each
  run by its own font's metrics. Left as is. `PositionedRun.lineSize` is new, after `size` was removed.
- `onClick`, hover, `getNodeAtPoint` and press classification take the topmost hit, not `selectTool.pickBest`, whose
  docs say they name the node a click selects; `pickBest` cannot see the asking view's camera or the live Alt key.
  Left as is.
- `ActionSettings` is exported from `@weasel-js/ui`'s root barrel, the one component folder that was not.
- Group puts the new group in its frontmost member's place and keeps its members' stacking, as Make Boolean Group did.

## Audit round nine (2026-11-08)

- `createIndexedDbAdapter` upgrades an existing database by one version to add a store it lacks, where it used to
  leave every read and write of that store rejected. Like any upgrade, it waits for the database's other connections
  to close.
- A loupe's `onColorChange` takes `string | null`: a sample of nothing clears the color, including from a surface that
  cannot answer yet (hud before its first frame). Breaking for a handler typed `string`, said in the changeset.
- `polarScale().valueAt` and `radarValueAt` take an optional `open`, so a radar with no `max` grows past its rim when
  dragged. A `PlotView` whose `theme` prop is removed draws in `PLOT_THEME`.
- A quadrant chart keeps an optional `classOrder` beside `classes`, rather than `classes` becoming an array; code
  walking classes reads them through `quadrantClassEntries`.
- A local face styled `W0` reads as weight 100, the same as `W1`. A glyph contour followed by a relative `m` stays
  open, rather than being closed and its `m` rewritten. A shaped run starting with a closing bracket takes its
  script's direction.
- symmetry's radial, kaleidoscope and repeat counts are held to `MAX_WALLPAPER_COPIES`, and a NaN kaleidoscope count
  draws one wedge. A tiled parallax layer draws its sources one layer at a time, each with its effects.
- `sceneContentBounds` is new in core: content bounds that include the copies a group draws, used by zoom to fit and
  the minimap. The minimap's fit now leaves hidden nodes out, as zoom to fit does.
- `parseSvg` ignores a whole `transform` list that does not parse, CSS units (`10px`, `45deg`) and infinite numbers
  included.


## Audit round ten (2026-11-08)

- An op that writes what a node already holds (flags, layer, data, `dependsOn`, transform, a reorder to its own slot,
  `scene.move` to its own place, an equal parallax factor) records nothing. The check reads through the adapter's
  `getNode`, so an adapter without one records as before. Reparenting to the same parent still records: `scene.move`
  appends, which can be a real reorder.
- `move`, `reorder` and `moveLayer` with a NaN index still put the node or layer at the front. Left as is.
- `cycleVertexColors` refuses a negative `msPerCycle`, which used to run the cycle backward (`direction: -1` does
  that). A bus or voice `setGain` throws on a non-finite gain or ramp; a NaN `rampMs` used to mean no ramp.
- A simulation on a clock declared seekable catches up every owed step in one frame after a long seek. Left as is; the
  docs say to declare such a clock `seekable: false`. kernel3d's `groundHit` accepts points past the far plane, which
  panning near the horizon needs.
- A `miterLimit` of NaN or 0 bevels every join, where canvas ignores the value. Left as is.
- An empty protect mask in dither makes an inert 1-pixel texture rather than an error.
- A self-loop naming at most one port leaves ELK's route out of `ElkPlan.routes` and is drawn by the diagram's own
  `selfLoop` rule; ELK still reserves space on the side it chose.
- labkit's palette keeps a group's tools where the group first appears, as the other regions do, which reorders
  palettes whose groups interleaved; no separator is drawn.
- A pref's `disabledReason` replaces an action row's own when the pref disables it, as forms do. In `SelectionPanel` an
  action inside a top-level object still never shows pressed: its `active` set is keyed by leaf key, not path.
- A parametric action leaf drops its `shortcut` from each variant but keeps its `description` and `activeIf`.
- A disabled control with a `disabledReason` stays focusable, but `useRovingTabIndex` skips `aria-disabled` items, so
  arrows never land on one in a `ToggleBar`, `Bar` or `ToolPalette`. Not ruled: either arrows reach it (APG allows it)
  or it stops promising to stay focusable.
- Removing an `EffectList` card hands focus on through `useRemovedRowFocus`; removing the last drops it to the page.
  `ListEditor` (previous entry first) and `GradientEditor` (neighboring stop) keep rules of their own.
- gestures' `CONTROL_SELECTOR` has no `radio`, `tab`, `menuitemcheckbox`, `menuitemradio` or `slider` role. Widening it
  changes press ownership in `ItemList`, `Tree` and the reorder lists. Left as is; nothing breaks today.
- The eyedropper and the hand tool target `THROUGH_CHROME`, so they sample and pan through exclusive chrome claims
  (measurements, selection handles). The hand always pans (Mike, 2026-11-08).
- `check:size` covers `packages/*/src` only, where `check:frame-loops` covers `apps/` too. Left as is.
- `stripComments` (`scripts/lib/cssBlocks.ts`) skips strings; a regex literal holding a quote reads the rest of its
  line as a string, which can only raise a false alarm. weaselchart's audio Play rejection stays console-only.

## Audit round eleven (2026-11-09)

- The image cache owns the bitmaps it decodes and closes each one it drops: evicted, released mid-load, replaced,
  or released (Mike, 2026-11-09). A `bitmapSrc` bitmap stays its maker's. Work that keeps draw commands across an
  `await` takes `holdImageBitmaps()`; PDF, pages-PDF and LBX export do. A consumer layer that caches commands
  through `deps` without a hold draws a closed bitmap as nothing until it rebuilds.
- plot's editors and specs clamp the sizes that drive a loop (Mike, 2026-11-09): packet bits per row ≤ 128, a
  packet field ends by bit 4095, radar rings ≤ 20. guides' `snapPoint` offers at most the 129 × 129 grid points
  around the dragged child.
- Non-finite input to audio (voice gain, rate, detune, pan, position, the listener and its options, a pattern
  start), `clock.sync`, `tween({ ms })` and a stagger's delay throws `RangeError`, extending round ten's `setGain`
  call. A stagger asks its delay for every index before the first item starts. An `ms` of `Infinity` still never
  arrives.
- A timeline seek lands in `[0, duration]` unless laps remain, when it lands in a later lap.
- A selected node that a selected group's frame carries goes with the group under align, distribute, flip,
  rotate and resize. Under `IDENTITY_POSE_COMPOSITION` both are still written.
- A key binding needing Ctrl or Meta alone shows no shortcut chip; forge's keys panel labels it "Key".
- A tuned action's `enabled` and `active` get the tuning's params, as `run` does.
- An ongoing action's `start` that throws at a press is caught and logged, and the press counts as handled. One
  deferred by `dragThresholdPx` is not caught. Not ruled: logging it retries `start` on every move; ending the
  gesture changes how an in-flight drag ends.
- Undo in a lab steps whichever of the marks and the trial's history changed last. A `TrialHistorySource`
  without `undoStamp` keeps marks first.
- A trial's writes to the lab's `over` (`f.alias` rows) are undo steps, so Undo rewrites the app's own values.
- Trim and Extend pass over locked and hidden strokes; a locked stroke still cuts and stops, a hidden one does
  neither. Link anchor ties to no hidden or locked path.
- Arrows in ui's widgets (`PageTabs`, `TokenField`, `ItemList`, the icon picker, `PrefsRail`, `Tree`) follow the
  direction read from computed CSS at the key press, through ui-input's `arrowDir`. `ResizeHandle` stays physical.
- A `Tree` drop with a zero, negative or NaN indent keeps the row's depth.
- A pasted table keeps a tab per empty cell before one with text; a trailing empty cell still pastes nothing.
- A chunks or dots tile with a size that isn't positive draws nothing.
- `version-packages` and the site's Releases view read changesets through `@changesets/parse`, which arrives through
  `@changesets/cli` and is not declared at the root. `import { type A }` counts as a run-time import in
  `scripts/lib/imports.mjs`, as `verbatimModuleSyntax` builds it.
- `resolveStroke`'s doc says a stroke of base width 0 draws through its per-vertex widths; `tessellateStroke`,
  `strokeToPath` and `strokeHasInk` draw nothing. Not ruled which one changes.
- A drag spanning containers with equal grid spacing but different corners snaps to a world-aligned lattice, which
  is neither container's grid. Left as is; `gridSnapSource`'s doc may intend it.

## Audit round twelve (2026-11-09): gestures

Rulings and TODO pickups that landed in the same batch are here too.

- A drag whose `start`, deferred by `dragThresholdPx`, throws ends as a cancel, and `start` is not retried (Mike,
  2026-11-09). An ongoing action on a key, click or wheel commits the handle a second firing replaces; the latest
  stays in flight until the next firing or a cancel-all. A `start` that tears the dispatcher down has its handle
  canceled.
- A stroke with base width 0 draws, hits and edits as nothing, its heads and per-vertex widths included (Mike,
  2026-11-09).
- Cmd-click (Ctrl off macOS) toggles, Shift-click ranges, `select.deep` is Cmd+Alt-click. A range takes what a
  plain click there could select: whole groups at the root, nothing outside an entered group, rotated nodes by their
  drawn center, parallax layers in their own coordinates. `extend: 'shift'` keeps the old Shift-toggle with no
  range. The `selectRange` dep carries the rule to other surfaces (diagram's edge labels).
- Inserting a text box or sticky and typing is one undo entry; a text node inserted with text (a paste) is not
  joined. An empty box left with Escape folds its removal into the insert's entry, which then stays on the stack
  doing nothing.
- forge's API panel merges typedoc's JSON (`dist/typedoc.json`) over its own reader's rows, and reads a component
  edited since the JSON was written with its own reader alone.
- Keys match a Latin chord by physical key only while Ctrl, Alt or Cmd is held, so single-letter tool keys don't
  fire on a Cyrillic layout and AltGr+E (€) doesn't fire `e`. A shifted character needs `shift` in its binding.
  Only a second finger abandons a held long-press; a touch or mouse beside a held pen does not (palm rejection).
- A held key ends in the view that took its keydown. A carry cancels on window blur. A press on a keyboard-off
  dispatcher leaves the keys where they are but still moves the chrome scope.
- Mode keys (entry and leave) sit at the ambient tier, so an active tool's own key comes first. The conflict check
  reports a hotkey-tier action shadowing a tool binding; keymap leaders and tool keys are hotkey-tier on purpose and
  will warn when a tool binds the same key.
- The hand pans on a drag with any modifier held. The pencil draws over shapes. kernel3d's camera actions pass input
  on when they have no camera.
- `describeKeymap` names pointer modifiers as the platform prints them (Cmd-click, Ctrl-click).
- Open, not ruled: File › New's Mod+N, Free Transform's Meta+T and Meta+Escape, the eyedropper's default `alt`
  hotkey shadowing other tools' Alt-clicks, MenuBar's Alt+F/E/V/H off a Mac, spiro and pen unable to place a point
  with snapping suspended (Ctrl), and `TrialTransport keys` taking Space, the arrows and `r` page-wide. The
  reserved-key tests list the browser collisions as known.

## Audit round thirteen (2026-11-09)

Key rulings and the per-view camera TODO landed in the same batch.

- Key choices (Mike, 2026-11-09): File › New is Alt+N. Free Transform enters on Mod+Alt+T, because Mod+Shift+T
  reopens a closed tab. The eyedropper has no default hotkey. MenuBar's Alt+letter opens a title only while focus is
  on a title. `TrialTransport keys` skip fields, controls and any focused canvas. Snapping toggles on Mod+Shift+;
  (`<SceneCanvas snap={{ enabled }}>`, draw's View › Snapping), matched by physical key; held Ctrl still suspends one
  drag.
- SVG export embeds a runtime-bitmap image as a PNG data URL, drawn through a DOM canvas synchronously, and keeps
  the old href with a warning where no canvas can draw it (Mike, 2026-11-09).
- Each `<CanvasView>` takes `deps` of its own, read ahead of the surface's, so a 3D host gives each view its own
  camera, picker and pose descriptor; the dep contracts take no view. `Action.enabled` gets the view id as a fifth
  argument, so a double-click and hover resolve in the view the pointer is in. 2D presses routed to a view still
  pick with the surface's camera.
- An unchanged selection write notifies nobody, and an id given twice is held once. The loupe learns that a press
  re-selected its lens from the press itself, around the dispatcher's own listeners.
- `History.dropRedo()` takes the redo stack and keeps undo. A trial drops the other side's redo when marks or its
  history change, and stamps scene edits with `editStamp`. A `TrialHistorySource` without `undoStamp` or `dropRedo`
  keeps marks-first order.
- Next from a view never shown a page goes to the first page; `add` there puts the page after the last.
- Cut at Crossings, Join and Release Compound Path carry per-anchor widths and colors to the pieces (blended at a
  cut, reversed with a reversed path); any command leaving them out of step with the anchors drops them.
- Warp and smudge on a group skip its locked and hidden members, as trim and extend do.
- Far from the origin, where a step index passes 2^53, the ruler, grid lines and tiled layers draw nothing;
  `snapPoint` still offers points. A repeated Mermaid architecture name is an error; a repeated mind-map id is
  renamed.
- Non-finite input to animator frames, IK, voice fades and audio param writes throws `RangeError`.
- A `readPixels` rect that isn't whole device pixels throws. Empty paths and sprite runs bound as empty, so an empty
  clip path clips everything.
- `scripts/lib/imports.mjs` and the consumer smoke check read imports through the oxc reader; `check:frame-loops`
  and `check:listener-sets` count each use, not each line.
- path-edit's and text-edit's discard is Cmd+Escape on a Mac and has no default key elsewhere, since Ctrl+Esc
  opens the Windows Start menu; Ctrl+Esc is a reserved chord off a Mac (Mike, 2026-11-09). A mode shortcut can
  name a key per platform (`{ apple?, other? }`).
- Open: whether a scope below a `mute` may re-register the muted id.

## Audit round fourteen (2026-11-10)

Calls the lanes made without a ruling:

- A tool-option tuning that keeps its params (`keep`) owns them: the last-operation panel stores no session params
  for that action, so a value set in the options row after a run reaches the next run. Rejected: laying session
  params under every `under` tuning, which contradicts tool options lying under the panel's params.
- A last-operation change made after a tool switch is written to the tool whose options the operation read. Open: an
  enabled check that reads the action's params while another tool is active makes that tool the last reader.
- An `endless` number tool option holds Infinity; `[`/`]` step from `max` to ∞ and back.
- Text fill, sticky paper, and sticky ink set to none draw none, which can leave a shape invisible, rather than
  falling back to the defaults.
- Painting skin weights compares the falloff against each joint's share (`jointShares`, animator), not its raw weight.
- Fraction and ratio displays parse in their locale; `compact` and `zoom` still parse `en-US`, as they display it.
- Alignment guides whose offsets round to one 3-decimal name get a `~2` suffix rather than longer names.
- A lab page whose `href` is a directory's `index.html` counts as that directory.
- A sweep cap or a `frames` loop count that isn't a whole non-negative number throws `RangeError`; a NaN recent-colors
  limit falls back to 12. An image pattern's preview ignores `opacity`, which a CSS background can't fade.
- Text wraps with a relative tolerance of 1e-9, so a box sized to fit its text doesn't wrap it.
- A Mermaid flowchart keyword line's `;` inside double quotes doesn't end the line. Sequence participant ids hold no
  whitespace in messages, notes, and activations, as in declarations. Numbers past the double range are refused at
  read; `niceDomain` keeps an end that would overflow, and a span too fine to cut.
- Open: `lerpStroke` drops `vertexWidths` and `vertexColors`, since the two strokes can differ in anchor count.
- Open: a clearable number pref with a numeric default reads back as the default once cleared in a store.
- Open: negative stroke widths pass through the draw.io, DOT, and Mermaid readers unchanged.
- Open: `Slider` commits through `onChange` when a press or keystroke moves nothing.
- Open: which edge an RTL menu favors when it fits on neither side, or is wider than the viewport. menu's placement
  property skips both cases (2026-11-10).

## Audit round sixteen (2026-11-11): contracts

- Open: a mixed number slider in `PropertyField` disables its track and reads out a dash that takes no focus, so it
  cannot be edited, while `PrefsForm`'s `mixed` says editing one calls `onChange` as usual. A test pins the disabled
  track ("parks a mixed slider").
- Open: `Slider`'s region drag moves the two thumbs beside it by one track distance with no `step` or stop snapping,
  and a shift-all drag snaps to `step` even under `snap: 'strict'`, which says `step` no longer applies and every
  stop is a detent. Under strict stops spaced unevenly, both thumbs cannot land on stops and keep their gap.
- Open: a `ControlPanel` group drawn `as: 'bar'` hands its cells no `errors`, `changed` or `auto`, so an error, a
  changed mark or an auto readout on a bar leaf does not show. A paired row shows errors and `changed`, not `auto`.
- Open: `selectTool.pickBest` steers only the internal select tool's own pick; the dispatcher, hover and `onClick`
  pick the topmost hit, so with alt-cycling `onClick` can name a different node from the one the press selected.

## Audit round sixteen (2026-11-11): leftovers

- A raw `History`'s `undo`, `redo` and `goto` throw while a journal is active, as `beginJournal` does, rather than
  stepping into the journal as the scene facade's `undo` does (2026-11-12).
- A snapshot in an unsupported version throws `SnapshotShapeError`, checked before any node; an unregistered
  function key throws a new `SnapshotKeyError` carrying `id`, `field` and `key` (2026-11-12).
- A text edit takes focus back from a checkbox or a slider in its chrome after styling, as from a button, since
  text-dom now asks gestures' `isEditableTarget`; arrow keys on a slider then reach the text, not the slider
  (2026-11-12).
- Open: whether Mod+Z in a text field inside an editor with its own history (`PrefSchemaEditor`'s fields,
  `CssVarsPanel`'s apart from its filter) steps the editor or is left to the field. Page-level handlers leave it to
  the field (`undoKeyStep`); these two take it.
- Open: draw's soft modes without a journal cannot discard an edit that coalesced into the entry before the mode,
  and a text box's typing coalesces into its insert on purpose (`useTextEditSession`'s "one undo entry with its
  insert"). Sealing the history on entry fixes discard and splits that entry. No soft mode has a coalescing edit
  today.
- Open: whether a `LensCapture`'s bitmap stays valid after the source's next capture. The Pixels source closes the
  captures it throws away, and leaves a replaced shot open because `capture()` handed it to a caller that may paint
  it later.
- Open: whether paint keeps a lerp of its own (no dependencies) or takes geom's, which also stays finite where
  `b - a` overflows. d3's transition pins `t` 0 and 1 over a pose descriptor's lerp; that is not a copy.
- Open: whether `useGestureDispatcher`'s `views` (multi-view routing, which core fills through
  `@weasel-js/routing/internal`) becomes public surface.
- Open: whether `@weasel-js/brush`, one 14-line helper over routing's tool options, stays a package of its own.
- Open: ui and 19 other packages promise `react >=18`, and nothing runs their tests under React 18. labkit and forge
  ask for `^19.0.0`.

## Audit round seventeen (2026-11-12): params

- A color leaf the selected nodes do not hold draws as `mixed` does, an empty checkered swatch with its opacity
  locked until a color is picked, rather than the leaf's default; `ColorField` takes `unset` for it (2026-11-12).
- Open: a paint leaf the nodes do not hold still shows the leaf's default, dimmed, as `PaintField`'s `unset` says
  ("a value is in effect but was never chosen"). Under `SelectionPanel` that default is not what paints, since
  `absentIsDefault` is what makes the default the value in effect; `FieldBase.unset` says a control shows no
  value there. Whether paint follows color to an empty trigger.
- Open: labkit fills a stored trial's missing config keys from its instrument's defaults on load, and repairs
  nothing against the config schema: a number past a since-narrowed `max`, or an enum option since removed, reaches
  the instrument and the panel as stored, and only the next edit clamps it. Repairing on load needs the schema at
  hydration and has to leave `minAt`/`maxAt` bounds, auto values and encoded leaves alone.

## Audit round seventeen (2026-11-12): theme

- Open: whether `PlotView` with no `theme` follows the nearest `ThemeProvider`, as `useHud` does, or keeps drawing
  `PLOT_THEME`, the weasel theme's dark mode, as documented. In a light-mode provider its text and axes are drawn in
  dark mode's near-white `fg`. Ties to the `docs/TODO.md` entry on whether the site's `.ckd-canvas` stage follows the
  mode.

## Audit round seventeen (2026-11-12): persistence

- Pasting again from a canvas's in-memory clipboard re-snapshots what the last paste made, falling back to the
  made nodes only when the adapter's snapshot comes back empty (a React-state adapter not yet flushed), so the
  next paste reads them in world as a copy does (2026-11-12).
- draw's SVG Save writes a node's Layers-panel name as `wd:label` and its lock as `wd:locked="true"`, and Open and
  Import restore both, locking after the nodes are added (2026-11-12).
- `nodeSpecsFromSnapshot`'s new `systemLayers` builds the specs into a scene of those layers to prove they load,
  so draw and chart build one scene more at boot (2026-11-12).
- Open: Cmd+V pastes the OS clipboard's copy through the weasel-JSON handler at the adapter's fixed offset from the
  copied nodes every time, while the Paste button steps on from its last paste or lands at the pointer. Both put
  the same nodes in history, but a run of Cmd+V stacks every paste on one spot.

## Audit round seventeen (2026-11-12): consumer setup

- Open: diagram's paired helpers (`diagramPorts`, `diagramWaypoints`, `diagramEdgeEnds`, `diagramLabelDrag`, the
  container and sequence ones) hand back a layer to `registerLayer` and a contribution for `ambient`, so the README
  has a consumer hold a canvas ref and register the layer in an effect. `SurfaceContribution.attach` exists for
  exactly this ("a registered (hit-testable) layer"), and the minimap registers through it. Moving each layer into
  its contribution's `attach` makes one `ambient` entry the whole install, but breaks a consumer who also
  registers the layer, and `DiagramView` would have to stop registering its own; hit order would then follow
  `ambient` order rather than `useDiagramEditing`'s `layers` order. The other answer is core hit-testing a
  contribution's `overlay`, which it paints and never hit-tests.

## Audit round eighteen (2026-11-12): a lab's trials

- The lab store's `setTrialInstrument` is gone (`major` changeset): it kept the old instrument's state, config, view
  and undo under the same id, and `swapTrial` is the way a trial changes instrument (2026-11-12).
- Reset, or a snapshot loaded over a trial, cancels its running job; an `auto` job then runs again on the new state,
  and a hand-started one stays idle until started. `useJob` takes `epoch` for it (2026-11-12).
- A job capability takes `begin(state, config)`, the state a run folds its items into; without it each run still
  adds to the last, so an `auto` job on a reloaded trial repeats its items unless the instrument clears them
  (2026-11-12). Open: whether a job with no `begin` should start each run clean, which would need labkit to know
  which part of the state the job fills.
- Open: a snapshot saves a trial's config, state and clock but not its view, so loading one keeps the pan and zoom
  the trial shows now rather than what it showed when saved. Saving the view would change every snapshot record.

## Audit round eighteen (2026-11-12): document

- 2026-11-12 (my call, after the 2026-11-09 Delete ruling): Delete Page, in draw and chart alike, is disabled with
  `ActionDisabledReason.Locked` while the page, anything on it, or anything its delete cascades to is locked
  (`DocPages.removable`). It used to throw from the scene and change nothing. New and Open still replace locked
  content, since they replace the whole document.

## Audit round eighteen (2026-11-12): canvas view

- `viewBounds` holds the view through a size change as well as a write: a canvas's `defaultView` is clamped
  once the canvas has a size, and a resize (a window, a panel shown again after `display: none`) moves the view
  back inside, reporting it to `onViewChange` as an input write would. A `<CanvasView>` does the same when a
  commit leaves its rect another size. `'content'` bounds never move a view this way, since they always take in
  what it shows (2026-11-12).

## Audit round nineteen (2026-11-12): not English on a US keyboard

- Open: whether the number fields (`UnitField`, `PropertyPanel`'s number control, the menu value rows) follow the
  user's locale or stay `en-US`. Today they show and read `en-US` only, with no `locale` prop, so `2,5` typed in a
  German locale is no number and the field puts the old value back. Both fields set `inputMode="decimal"`, and a
  phone's decimal keypad in a comma locale offers a comma and no period, so there a fraction cannot be typed at
  all. `parseNumber` already reads any locale, falling back to `en-US`, but a field has to show and read in the
  same one: shown `en-US` and read `de-DE`, `1.500` (one and a half at three places) commits as 1500.
- Open: whether a text edit's style shortcuts (Bold, Italic, Underline, Strikethrough, super- and subscript)
  answer to Mod alone, as its undo beside them does. `toggleForKey` takes Cmd or Ctrl on any platform and does not
  look at Alt, so Ctrl+B on a Mac, which a Mac text field reads as moving back a character, bolds instead.

## Audit round nineteen (2026-11-12): the user's settings

- Under `prefers-reduced-motion` a kit default that moves something yields: an animated camera move and an animated
  reflow take no time unless the caller names an `ms`, and ui's switch, radio and `ControlMatrix` switch drop their
  transitions (2026-11-12).
- Open: a hand-tool pan with `inertia` still coasts after release under `prefers-reduced-motion`, and with
  `boundary: 'bounce'` or `'spring'` bounces off the pan limits. `animatedZoom: true` goes instant under the same
  preference, so the two `viewport` options disagree; but platform scroll views keep their momentum with Reduce
  Motion on. Whether reduced motion drops the coast, only the bounce, or neither.

## Audit round nineteen (2026-11-12): touch and pen

- 2026-11-12 (the lane's call): every kit `<Canvas>` that takes input sets `touch-action: none` at zero specificity, so
  a `<SceneCanvas>` inside a labkit camera with `data-lk-touch='scroll'` keeps one-finger touch for its own tools
  rather than scrolling the page. A consumer class can set `touch-action` back.
