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

- 2026-11-20: `movedIndex` and `isNoopDrop` take a required `length` and clamp the gap and drop indices outside the
  list as `moveItems` does, rather than staying length-free and documenting that they expect an in-range drop.
- 2026-11-20: `captureGesture` settles on a click it holds back for a double click when a key other than
  Escape comes in the window, and leaves that key to the page; Escape still resolves `null`.
- 2026-11-20: A tool with options may not be named `shared` or `shared.<anything>`: `defineTool` and
  `toolOptionsPrefs` throw, since its options would land in the group every tool's shared options are kept in.
  `toolOptionsPrefs` also throws for an option key or shared key with a dot, and for a tool whose options would sit
  inside another tool's option (`path`'s option `brush` beside a tool `path.brush`), rather than escaping either.
- 2026-11-20: `CONTROL_SELECTOR` names everything `focusedControlOwnsKey` leaves Space and Enter to:
  `summary` and roles `tab`, `option`, `radio`, `menuitemcheckbox` and `menuitemradio` now count as
  controls a host leaves a press to, and the last three also own Space and Enter. A dispatcher surface
  whose children carry those roles takes them with `controls: 'take'`, as the segment sweep does.
- 2026-11-20: `routeToSpec` (and so `bindingSpec`) throws on `hover(*)` rather than reading it as
  `hover(move)`: a `HoverSpec` moves or leaves, never both, so a binding for both is two routes.
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
  and `ToolPalette`'s `include` take one); `KIT_TOOL_IDS` is now derived from `KIT_TOOLS`,
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
- 2026-11-20 (the fixer's call): Fit Content (Cmd-Alt-0) holds to `viewport.zoom`'s `axis` as the other zooms do,
  fitting along that axis alone; content with no extent there is centered at the current scale. Cmd+0 still resets both.
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
  `createModeTriggersContribution(registry, { enter, canEnter })` binds them: ambient tier, so a tool that binds the
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
- 2026-10-18: Create Outlines moved from Mod+Shift+O to Mod+Enter
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
- 2026-11-21 (the fixer's call): `SnapCollect.include` is removed. No session set it and only `pathSnapSource`
  read it; making it real would have every source (guides, rotation, measure, kernel3d's) honor an allow-list.
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
- 2026-11-20 (my call, audit round 47): a resize whose constraint's `onEnd` commits ops of its own in place of the
  box leaves Transform Again with nothing recorded, so Cmd+D duplicates: what landed is the constraint's, which no
  box in units repeats. Rejected: recording the box the pointer asked for, which repeats a scale the user never got,
  and keeping the transform before it, which repeats one made on something else. Move and rotate still record their
  drag in that case.
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
  error naming the node; `loadScene` refuses `systemLayers` that are not a list of layers with string ids, and
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
  and length fields (`measure: 'length'`, `prefLeafInUnitScopes`, `SelectionPanel`'s `units`) use the
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
  New layouts: `slots`, `pack`, `quadtree`, and `createPerContainerStrategy`.
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
  container's layout is the one its node declares. `useLayoutDepSource` is `(scene, reflow?)`;
  the drop-target mode became `move`'s `layoutDropTarget` param (2026-11-19).
- 2026-10-13 (pass 6): A container's `transform` composes into its children under
  `composeRigidPose`, and a group resize writes a turned leaf's shear to its `transform`. The
  default node properties show a pose's `transform` as a Skew switch that can only clear it.
- 2026-10-13 (pass 6): A scene slot's `toPose` is handed the node at its effective pose, and a
  dependency's `path` in a scene that composes frames answers a pose override's path.
- 2026-10-13 (pass 6): Pages are rects in one world space over one scene, in core: `layoutPages`,
  `pageAt`, `pageOfBounds`, `pagesBounds`, `adjacentPage`, `createPagesLayer`, and `fitViewToPage`. An
  object is on the page it overlaps most.
- 2026-10-13 (pass 6): A slider drag in `SelectionPanel` is one undo step: moves are written
  through `scene.untracked`, and letting go records one batch. `LeafContext` gains
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
  is none to remove, `setFillets` without a shape or radius or with the corners' own, and `nudgeAnchors`
  and `reversePath` where the selection names no anchor of the path (as an undo that shortened the path
  can leave it). A selection command stays enabled when its result is the selection already held.
- 2026-11-10 (property tests): Align, Distribute, Flip, and the reorder commands follow the ruling above:
  `NotApplicable` where they would change nothing, through the same plan their `run` commits.
- 2026-11-20 (the fixer's call): the paint actions (`setFill`, `setStroke`, their opacity actions, `setStrokeWidth`
  and `setVertexColor`) are ongoing, and their params usually arrive with the drag's moves rather than with the
  binding, so their `enabled` cannot answer from params: a picker drag bound with the current color would be
  declined before its first move. They are `NotApplicable` only where no operand holds anything they could ever
  write, which today is `setVertexColor` with no selected node carrying `vertexColors`. A run that would write
  what each node already wears stays enabled and commits no undo entry.
- 2026-11-22 (the fixer's call, audit round 71): a fill or stroke set to None, `null` or a record with no `paint`,
  stays None under `setFillOpacity`, `setStrokeOpacity`, and `setStrokeWidth`, which change only the alpha or width
  and never add a paint. Only a node with no fill or stroke at all takes the kit default from them.
- 2026-11-22 (the fixer's call, audit round 70): a paint action is disabled with `Locked` while any node it would
  paint, named by `ids` or selected, is locked, and its run writes nothing, after the 2026-11-09 ruling for Ungroup,
  Delete, and Cut. It does not paint the unlocked nodes and skip the locked ones.
- 2026-11-22 (the fixer's call, audit round 70): Group is disabled with `Locked` while a member, the container it
  would land in, or a node it would move as a follower is locked, as Ungroup is. It used to throw from the scene.
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
- Ruled 2026-11-10 (my call, overnight sweep): Snip and the Girth tool's `girth.clear`, click commands, are
  enabled outright by a click's point, as Reach is, so the tool keeps the click and the run decides; with
  no click, `enabled` asks whether the press in their params reaches a piece to cut or a set width point to clear, and
  answers `NotApplicable` otherwise. Before, both were always enabled.
- Ruled 2026-11-10 (my call, overnight sweep): `reachToMeet` takes an end within float32 rounding of a stroke (1e-6 of
  its coordinates' magnitude) as already meeting it, so a second Reach is disabled rather than recording
  an invisible step, after the Align ruling above.
- Ruled 2026-11-10 (my call, overnight sweep): `toolStacksOf` reports no stack for a stacked set that names no tool, as
  `withoutTools` leaves one cut to nothing: a palette has no button to draw for it.
- 2026-11-14 (my call, singular frames): `PoseComposition.decompose` answers `null` under a frame with no inverse:
  a 2D `transform` geom's `invert` refuses, a 3D scale with a zero axis or one `invertible` refuses, or a local
  pose that would not be finite. Storing such a frame stays valid. An edit that promises a node keeps its world
  place (reparent, group, ungroup, a drop, a clone or paste landing, a follower move) refuses whole when one node
  would land in one; a parent whose frame is singular takes no children (`childVerdict`), and an insert there goes
  to the top of the tree. A transform (move, nudge, rotate, resize, flip, align, distribute) leaves a node stored
  in one where it is and moves the rest. This replaces the 2026-11-11 call that read such an axis as collapsed.

- 2026-11-11 (my call, core second property pass): `unionBounds` and `unionAabb` skip a box with a corner that is
  not finite (a `NaN` or infinite field, or an edge past the double range), as `unionAabb` skips a hole, and a union of
  only such boxes is `null`. Before, a `NaN` width counted the box's `x` and not its far edge, and a union of such
  boxes alone came back with a width of `-Infinity`.
- 2026-11-11 (my call, core second property pass): `createMoveToIndexOp` holds its index as the finite integer that
  places alike: `Infinity` as `Number.MAX_SAFE_INTEGER` (the top), `NaN` as 0 (the bottom, where `moveToIndex` already
  put it), a fraction truncated. JSON wrote `Infinity` as `null`, which a reloaded history read as 0.
  `scene.add`, `scene.move`, and `scene.reorder` record the index the node lands at by the same rule (`slotIndex`:
  truncated, held to the ends, `NaN` at the start), so a reorder at `NaN` of a node already first is no edit.
- 2026-11-11 (my call, core second property pass): a box remap from a box of subnormal width or height keeps that
  axis's scale, as one from a box of no extent does: geom's `extentScale`, which `rectToRect`, the rect pose descriptor,
  and `remapRotatedLeaf` share. The true factor is past the double range.

## Rendering, canvas, and paint
- Open (2026-11-11, audit round 16, errors lane): whether a node whose `drawOne` throws should cost only that node.
  Today it costs the frame, on the page and in the render worker alike (each retries once, then waits for a change),
  while a contribution's `beforePaint`/`afterPaint`, an outline glyph, and an ingest handler each cost only
  themselves. Isolating it means a try in the command build, which every `drawOne` call site in core shares.
- 2026-11-19 (my call, audit round 39): `renderSceneToPixels`'s `pixelRatio` makes a `{ px }` length that many output
  pixels and measures `'screen'` units in CSS pixels unless `screen` is given, as a canvas at that density does; a
  pixel ratio that is not a positive finite number throws. `renderDebugSnapshot` passes its own through, so a
  snapshot at `devicePixelRatio` 2 draws a 1px hairline 2 output pixels wide.
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
  `up` lies just off an axis, as `createInsert3dDep` lays its footprint at 0: the hit is on the ground by construction, so
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
- 2026-11-16 (my call, audit round 31): `createParallaxPlane`'s `set` reads `pan: undefined` as "leave the pan", not
  as an error, since an animator writing `set({ pan: maybe })` means no change there and `pan` has no default to clear
  to. It had been stored, and every later draw of the plane threw. An undefined `zoom` or `anchor` still clears it.
- 2026-11-16 (my call, audit round 31): a bare-number `bleed` on `createTiledLayer` covers both axes, though a bare
  `period` wraps x alone: a bleed is how far content overhangs its cell, which is not one axis's question. On a
  lattice tiled in x only it draws as before.
- Ruled 2026-11-10 (my call, overnight sweep): loupe's `placeBand` never answers a factor below `ZOOM_FLOOR`, the
  floor the loupe model holds its own factor to: on a host with no room it gives a lens of no size rather than a
  factor of 0 that a point in the lens could not be mapped back through.
- Ruled 2026-11-10 (my call, overnight sweep): the loupe model's `setFactor` asks the surface for no redraw when the
  factor it clamps to is the one it has, as `setMode` already did.
- 2026-11-20 (my call, audit round 51): a captured `CanvasSource` read while no reader holds it answers `null` and
  warns once to `retain()` it; `canvasPixelSource` does not hold its source itself, since a read has no end to
  release at. The copy is dropped when the last reader releases.
- 2026-11-20 (my call, audit round 51): a `LoupeSurface` whose `sample` answers with a promise throws a `TypeError`
  from the loupe model's aim, resample and pick, rather than the model storing the promise as its color; the loupe
  stays synchronous and an asynchronous sampler drives only the eyedropper.
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
- 2026-11-20: `lerpStroke` interpolates `vertexWidths` and `vertexColors` entry by entry when both strokes hold an
  array of one length, reading a missing width entry as that stroke's width; otherwise it keeps the nearer side's
  array as written, as it keeps every other field.
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
- 2026-11-20 (my call, audit round 53): the `.lbx` writer takes P-touch to miter a polyline's corners, as it does a
  rect's, and to end a `SQUARE` arrow at the point, as a butt cap does. A polyline with a corner the canvas rounds,
  bevels, or cuts at its miter limit, and a square-capped line, are rasterized. Neither reading of P-touch was
  checked against a printed label.
- 2026-11-20 (my call, audit round 53): the `.lbx` writer takes P-touch's own line spacing and tab stops to match
  the default `lineHeight` and `tabSize`, and rasterizes a text box that sets more than one line at another line
  height or holds a tab at another tab size, rather than write `lineSpace`, whose unit bil-lbx does not state.
- 2026-11-20 (my call, audit round 53): under `autoLength`, the `.lbx` writer rasterizes a shape or text box
  reaching past either end of the label, so it is cropped there as rasterized paint is, rather than let P-touch
  grow the label for it. An `lbxObjectsCommand` past the end is still written whole, since it cannot be
  rasterized; whether it should be skipped instead is unasked. A carried object under a transform that scales an
  axis to zero is dropped with no report, as paint there draws nothing.
- 2026-11-22 (my call, audit round 69): the `.lbx` writer rasterizes a text box any of whose runs names a `lang`,
  even one whose forms match the face's defaults, since a `text:text` names no language and the writer cannot tell
  which tags change the glyphs. Whether a tag such as `en` should still be written as an object is unasked.
- 2026-11-21 (my call, audit round 64): `writeLbx` throws a `RangeError` for an auto-length label longer than
  `AUTO_LENGTH_MAX_PT` (1000mm), the paper height P-touch parks such a label at, rather than clamp it and crop
  what lies past the ceiling. A label that long can still be written at a fixed length; whether P-touch prints
  a fixed length past 1000mm was not checked.
- 2026-11-21 (my call, audit round 64): p-touch's `tapeForWidthMm(4)` gives the 3.5mm tape, the width Brother's raster
  reference has a printer's status reply report for that cassette, and `Tape.widthMm` stays `3.5`. Neither was checked
  against a printer with the cassette loaded.
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
- 2026-11-20 (my call, audit round 50): `camera.pinchDolly` anchors at the multitouch centroid as routing reports
  it, view-local, and no longer subtracts `Camera3dDep.origin`, which now converts only a wheel's canvas-local point.
  A host drawing its 3D pane as a sub-rect of a plain canvas, with no `<CanvasView>`, gets a pinch anchored off by
  that origin; whether the dep should take a second offset for that case is unsettled.
- 2026-11-11 (my call, kernel3d second property pass): `projectPoint` gives `null` for a pane with no area, and
  `projectAabbToScreen` for a rect with no area, as `rayAt` names no ray there; both give `null` for a camera whose
  near plane is its far one, where every clip depth is `NaN`.
- Open (kernel3d second property pass, 2026-11-11): a camera with a near plane at 0, a field of view of π, or its eye
  at a pole still projects points (all to one depth, or all to the middle of the pane) though `rayAt` names no ray
  through any of them, so it draws what nothing can pick. Whether projection should refuse those cameras too, or
  `rayAt` cast from the eye for a near plane at 0, is unsettled. A near plane past the far one draws depth mirrored,
  and its rays run back toward the eye.
- 2026-11-21 (my call, audit round 63): headless's `sceneToWire` sends a plain snapshot holding a typed array
  as a raw one, its own data as it holds it, and reads any other as encoded, as a file holds it. A raw snapshot
  with no typed array and plain numbers under `coords` or `commands` cannot be told from an older save, and still
  reads them as a path's typed arrays; whether the host should take a flag naming the form is unsettled.
- 2026-11-21 (my call, audit round 63): headless's host waits up to 30 seconds for a page script to call
  `serveHeadlessPage`, so one may call it once its fonts load, and fails the open at once with the error a page
  script threw first. The wait is fixed; whether `NodeRasterHostOptions` should take it is unsettled.
- 2026-11-20 (my call, audit round 49): headless refuses a result past `MAX_RESULT_BYTES` (its base64, and the
  message around it, must fit one V8 string), an RGBA render in Node before a browser starts and a PNG in the page
  once encoded, rather than send a larger one in pieces. Whether the host should instead carry a large result across in chunks is unsettled.
- 2026-11-11 (my call, icons second property pass): headless also refuses in Node a `sourceRect` whose width or
  height is zero or less and a `scale` with a zero axis, which the page's `renderSceneToPixels` refuses, so such a
  request no longer starts Chromium to fail there.
- 2026-11-11 (my call, icons second property pass): the `.lbx` writer rasterizes a command whose object would hold a
  number that is not finite (a group transform with `NaN` or `Infinity`, an infinite stroke width, a scale past the
  double range) and skips such `lbxObjectsCommand` with a reason, and `writeLbx` throws a `RangeError` for a `length` that
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
- 2026-11-20 (font, audit round 47): `parseBmFont` refuses an atlas with a glyph on any page but 0, naming it, since
  `registerFont` takes one atlas image per face and the renderer samples that one for every glyph. Whether the
  registry should take a URL per page instead is open.
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
- Ruled 2026-11-18 (audit 37, the lane's call): bidi's `reorder` and `reorderLine` throw a `RangeError` for a line that is
  not integers with `0 <= start <= end <=` the paragraph's length, where one past the end returned indices of characters
  that do not exist. There is no override: no such range names a line.
- Ruled 2026-11-16 (audit 29): the edit overlay writes a `selectionBackground` or `selectionColor`,
  default included, into its `::selection` rule only when `parsesAsColor` (`@weasel-js/paint`) reads it as a CSS
  color; any other value is left out with a warning, and the rule is not written when neither is one. There is no
  override: the value is stored document data going into a page-wide stylesheet.
- 2026-11-16 (audit 29, the lane's call): a clipped text node's outline (`overflow: 'clip'`) is its glyphs cut to its
  box with `pathIntersect`, curves kept, so Create Outlines and a boolean take only the ink it draws. A stroked part's
  stroke then also runs along the cut, where the painter shows none.
- 2026-11-20 (the fixer's call, audit round 58): `fit: 'shrink'` scales a stroke's width, dash, and dash offset with
  the text, a `{ px }` width included, as it scales a `{ px }` `fontSize`; `bakeTextFit` writes the scaled stroke out.

## SVG and paths

- Ruled 2026-11-20 (my call, audit round 49): `circlePath` throws a `RangeError` for `segments` that is not a
  whole number of at least 3, and `roundRectPath` for `cornerSamples` that is not a whole number of at least 1,
  rather than clamping; they built NaN coordinates or a bare `Z`.
- Ruled 2026-11-20 (my call, audit round 49): `joinPaths` gives the joined path the `openFill` its parts holding
  an open subpath share; where they disagree it takes the first such part's and warns, since one path holds one rule.
- 2026-11-22 (my call, audit round 67): `parseSvg` reads one viewport for an outermost `<svg>` with no
  `viewBox`, for its percentages and its media and container queries: each side it sizes (an `em` side included), a
  missing one from the `viewBox` aspect. A percentage on a side it leaves unsized still warns and reads its number,
  where media take 300 × 150. An `em` side reads the root's `font-size` attribute for media, since the cascade
  reads them, so a stylesheet sizing the root's font moves only its percentages.

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
  group, so a tween of no steps reopens live; one whose sources were not exported opens as nothing.
- 2026-10-18: `serializeSvg` takes `textLayout` (pass `layoutTextPose`), and `svgNeeds` / `warmSvg`
  take it too. A laid-out `<text>` drops `dominant-baseline`, carries `data-weasel-layout="lines"`,
  puts each line on its baseline with a `y`, marks a wrapped line `data-weasel-lines="0"`, and
  states `data-weasel-line-height`, since its pitch no longer does. A line the layout justified
  writes every word with its own `x`; `LaidOutLineBox.justified` (new text API) says which lines
  those are. Draw's exports and clipboard SVG pass it.
- 2026-10-18: A pin warp's solve runs five local/global rounds after its two linear steps, then,
  only when a triangle is left turned over, an injective pass (untangling energy of Garanzha et al.,
  2021) with the pins held. Every pin-warped shape redraws differently, and a drag that starts to
  fold jumps to the injective shape rather than easing into it. The solve is deterministic from the
  pins: it does not warm-start from the previous frame, so a reopened document draws what the drag
  last drew. A pass that runs out of rounds still tangled returns the folded result. Uniform edge
  weights, not cotangent ones, so each system stays the one already factored.
- 2026-10-18: A pin warp's map is smooth across its mesh (Clough–Tocher) where it was affine
  per triangle, so every pin-warped shape, saved ones included, redraws slightly differently:
  its bends lose their small corners.
- 2026-11-20 (the fixer's call): Pin-warp pins that snap to one outline vertex (two pins off the shape on
  one side, or two outline pins within a quarter of the mesh spacing) move it by the mean of their drags.
  Giving each its own vertex is impossible where both snap to one point, and keeping the first pin's drag
  left the second's handle moving with no effect on the shape.
- 2026-10-19: Constraint links on whole-node transforms. The transformed nodes are held as
  transformed and every node a link reaches gives way, its own constraints kept; their own
  constraints are carried unsolved, as before, and so is a link whose nodes all moved. A link that
  cannot hold does not stop the transform: it commits alone and `constraintLinkConflictsOf`
  reports the link. Core's hook is `PathEditExtension.finishTransform`, run as one of the
  `transformFollowers` dep's followers, which the `editAnchors` dep source adds.
- 2026-10-19: A path-edit drag that only previews until release (bend segment, corner, Tug,
  Poise, Sand, spiro insert) shows nothing for a frame its constraints cannot hold,
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
- 2026-10-19: A broken constraint link is drawn on every canvas with `pathTools.constraints`, in or out
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
- Ruled 2026-11-20 (my call, audit round 55): a simulation node pinned to a non-finite `fx` or `fy` holds that
  coordinate where it stands, with no velocity, rather than taking the NaN or `Infinity` into its position.
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
- 2026-11-17 (my call, audit round 33): `toClip` throws, naming where, on a timeline whose `duration` is infinite, as it
  does on any time, offset, weight or bezier point that is not finite: JSON writes each as `null`. A clip has no form
  for an endless timeline; leaving `duration` out lets it play to its last track's end instead.
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

- Open (2026-11-18, accessibility sweep): theme tokens drawn as text miss WCAG's 4.5:1 on the surfaces they sit
  on, measured by axe over every ui and labkit story in both modes (`apps/forge/a11y.suite.tsx`, which
  lists the stories in `a11y.known.ts`). The status bases as text on `gray-50`: danger `#d94a3f` 3.85:1, warning
  `#d99a3f` 2.22:1, success `#2ec27e` 2.11:1, info `#7ab8d4` 2.00:1; danger on `gray-800` 4.14:1. The muted grays
  on `gray-50` (`#828284` 3.52:1, `#9b9b9d` 2.54:1, `#89898b` 3.20:1), the accent `#6a62d4` 4.47:1 on `gray-50`,
  and the tinted chips (`ToggleChips`, `PrefKindBadge`, `Subpanel` tints) fall short too. No color was changed:
  whether status text takes a darker step of each hue, or the bases change, is a theme call.
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
  as a remote change; the change still reaches `onOverruled` when heard.
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
- 2026-11-20 (my call, audit round 53): the same holds for every one-character key, not only a space, while the
  search it extends still finds a row: a letter extends it before access letters are read, and `+`, `=` and `-` are
  typed rather than stepping a number row, so "bo" reaches "Bold" past an "Open" whose access letter is `o`. A key
  that would leave the search finding nothing goes on as with no search, so a space there chooses.
- Open (2026-11-11): `matchQuery` and typeahead lowercase rather than case-fold, so `STRASSE` does not find `Straße`.
- Open (2026-11-11): `deepEqual` over values that hold themselves (an array whose item is the array) overflows the
  stack rather than answer.
- Open (2026-11-11): `holderOf` and `outermost` never return on a `parentOf` whose parents loop without reaching a
  selected id.
- Open (2026-11-11): a range whose `between` lists an id twice selects it twice; a selection store holds it once.
- 2026-11-18: A keystroke whose bindings' actions all refuse it says why in a toast: `ToastRegion` tells it by
  default (`refusals={false}` opts out), titled with the action's label and reading its reason, one at a time, and
  of several regions only the one mounted last. An autorepeat and a `keyHeld` binding tell nothing, and nor does a
  keystroke anything on the page `preventDefault`s within a task.
- 2026-11-18: `Select`'s open list, `ComboBox` and `Tabs` land their arrow keys on a disabled item and never choose
  it, through React Aria's untyped item-level `disabledBehavior: 'selection'` for the lists and a kit-held selection
  for the tabs (`components/heldItem.ts`). A closed `Select`'s arrow keys still pass over a disabled option, since
  they change the value.
- 2026-11-18: `useRovingTabIndex` takes `disabled: 'skip' | 'stop'`, default `'skip'`, and no longer calls
  `onAction` for an `aria-disabled` item. `CommandPalette`'s arrows land on a disabled row.
- 2026-10-20 (overnight pass): `useRovingTabIndex` swaps Left and Right under right-to-left, in
  `horizontal`, `both` and grid layouts, reading the container's computed `direction` at each key
  unless the new `dir` option says otherwise. ui declares its own `RovingDirection` rather than
  depend on `@weasel-js/text` for `TextDirection`.
- 2026-10-20 (overnight pass): Every params surface reads a leaf's value through `prefValueOrDefault`
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
- 2026-11-20 (my call, audit round 60): `generate` given more anchors than `count` keeps the first `count` of
  them and reports the palette infeasible, and `derive` reports a categorical ramp's extra anchors as `invalid` at
  `ramps.<name>.anchors` while still deriving its steps. Throwing was the alternative; the theme editor's count
  slider can pass below the anchors it holds mid-edit.
- 2026-11-20 (my call, audit round 60): `derive` reports a pin or component whose `value`, `type`, `description`,
  `alpha`, or `scope` has the wrong type as `invalid` and makes no token of it, keeping what a rule produced
  beneath a pin. An `alpha` outside 0 to 1, on a pin or a semantic `ref`, is reported the same way, as its
  documentation gives that range. Dropping only the bad field was the alternative.
- 2026-11-21 (my call, audit round 64): a categorical ramp's anchor fills the step its `name` names, and the other
  swatches fill the remaining steps in palette order. An anchor naming no step of the ramp, or a step an earlier
  anchor fills, is reported `invalid` at `ramps.<name>.anchors.<i>.name` and fills a step no anchor names, so the ramp
  still derives. Failing the ramp was the alternative; the theme editor's anchor list names new anchors by hue, not by
  step, and holds them mid-edit.
- 2026-11-21 (my call, audit round 64): `generateTokens` refuses a set of themes in which one theme or selection
  lacks a token another holds, naming each gap, because `themes.ts` types every selection as a record of every
  `TokenName`. Typing a selection as a partial record was the alternative; it would make every reader of `THEMES`
  handle a token that is missing.
- 2026-11-21 (my call, audit round 64): `emitCss` declares a token that depends on several axes in the blocks of every
  subset of them too, valued at the left-out axes' defaults, so an element stamping only `data-wzl-mode` (as the site's
  color mode does) reads such a token at that mode. Attributes split across nested elements still do not combine: one
  stamping only `data-wzl-density` reads the left-out mode at its default, not at an ancestor's.
- Open (2026-11-11, theme second pass): a token a theme produces at only some selections still shows at the others
  in the stylesheet, which cannot unset it: a reference to it there reads the value from where it is declared, while
  `resolveTheme` has no token. Only a definition with issues does this. The same holds across `extends`: a child
  that redefines a ramp with fewer steps still shows the parent's dropped steps at runtime, and `derive` of the
  child lists none of them, with no issue. Whether derive should report a step it drops from the parent is open.
- 2026-11-14 (the lane's call): a row's auto, changed, reset, and error state is set by `<RowScope>` around the row
  rather than by props on it, as `<Disabled>` holds it. A scope inside another overrides only the fields it names,
  and a row takes the state for itself, so a row nested in its control starts with none. `PropertyRow` is the one
  row that draws it; `PropertyField` and `DialogRow` stay as a row with its control already in it, and the selection
  panel's `LabeledRow` keeps its own grid layout and reads only `onReset`. labkit's `ControlRow` and the form's
  `LeafRow` set the scope; a labkit custom row renderer is not wrapped in one, and sets its own.
- Open (2026-11-20, audit round 56): an override hook marked `varies` (`button-icon-size`, `params-label-tracking`,
  `tree-indent`, and the rest in `packages/theme/src/hooks/`) falls back to different values at different reads, so
  the theme prefs schema shows one of them, its listed `value`, as the unset value, and pinning what it shows
  changes the reads that fall back to another. Whether the schema shows such a hook with no unset value, or shows
  the per-read values from its description, is open. `check:token-reads` holds every other hook's reads to its value.
- 2026-11-22 (my call, audit round 67): a `Bar` along a curve draws no `framed` strip and does not `wrap`; it warns
  when given either rather than drawing a strip along the curve. A `framed="status"` bar there is still a `<footer>`.

## Diagram, audio, and labkit

- 2026-11-20 (audit round 50, labkit.controls): a `ControlPanel` keeping its own auto set starts it afresh from
  the schema's `.initial(AUTO)` leaves when the schema's leaf paths or start-auto paths change, and keeps it across
  a schema resolved anew with the same ones. Two trials of one instrument in one mounted panel therefore share pins;
  a lab that wants each to open fresh keys the panel by trial. Why: `resolveConfigSchema` returns a new object each
  call, so keying on identity would drop every pin on a panel whose schema is resolved in render.
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
- 2026-11-18 (my call, audit round 37): a voice's `rate` (`play`, `playNote`, `playNoise`, `stream`, `setRate`, and
  the voice kernels) is a positive finite number, and 0 or below throws `RangeError`. A note's nodes retune by its
  logarithm, and the voice processor read a noise loop backward into NaN. A buffer voice played both, frozen at 0
  and backward below it, and is held to the same rule so that `setRate` means one thing on every handle.

- 2026-10-11: Diagram groups nest and their boxes take presses; the `orthogonal` router turns at
  once after a waypoint where it would double back. Audio has `onDrop`.
- 2026-10-12: labkit's `isConfigNodeShown` takes the resolved schema; `DragState` carries `from`; a
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
  number at the default 24, as `resolveCursor` already reads a spec's size, one rule for both; a size past the
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
- 2026-11-11 (my call, symmetry second pass): `symmetrySpecOf` reads a field of the wrong type at its default, a kind
  `SYMMETRY_KINDS` does not hold as its own as `mirror`, and a cell that is not a wallpaper cell as `none`
  (b686c535b). It does not report them; nothing in symmetry has a place to.
- 2026-11-11 (my call, cursor second pass): `placeCursorPath` throws a `RangeError` for a scale or move that makes a
  coordinate `NaN` or infinite (e3481a9d2), as `bakeCursor` refuses an infinite size, rather than dropping the point.
- Open (dither second pass, 2026-11-11): `dither()` takes an output grid whose pitch is 0, `NaN`, or infinite, as
  `deviceGrid` gives for a view scaled to 0, and passes it to the shader, which divides by it. No ruling on whether
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
  2026-11-14: saves refuse to write over or remove `<key>` until that copy has landed, answering false, so a
  copy that will not save surfaces as a failed save rather than a lost document.
- 2026-11-17 (the fixer's call, audit round 33): draw draws only the glyphs its source names. Sixteen it named
  nowhere are gone (`width`, `height`, `fontSize`, `bold`, `italic`, `underline`, `strikethrough`, `opacity`,
  `strokeWidth`, `rotation`, `cornerRadius`, `letterSpacing`, `lineHeight`, `position`, `fill`, `stroke`). Four
  duplicated core's path-drawn text-styling glyphs (`core:bold` and its siblings) as `<text>` in whatever font is
  present. `apps/draw/icons/actions.test.ts` fails on an unnamed one. Restoring them was the alternative; `rotation` was fixed
  first, so reverting the deletion brings back a correct glyph.

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
  claim; since 2026-11-20 (audit round 50) also one holding a glyph without a string `body` and `group`, an array of
  `tags`, and a `fill` that is absent or a string. An app build reads its tables in module id order, so where two tables of one namespace and owner disagree
  on a glyph, the one beside the later module id wins every build; a virtual module's variant name is written
  `%uXXXX` per code unit outside `[A-Za-z0-9_.-]` in its placeholder.
- 2026-11-20 (my call, audit round 50): `provideVariants` handing a `failed` variant a loader of another identity sets
  it `idle` and announces it, so a mounted `useIconVariant` loads from the new one; a new loader for a `loaded` or
  `loading` variant is kept for no run, since running it would add the variant's tables a second time. Since audit
  round 67, a load that fails after its loader was replaced leaves the variant `idle`, not `failed`, so the new one runs.
- 2026-11-22 (my call, audit round 67): `IconRegistryProvider`'s `variants` is the current set: a new value drops
  every variant it no longer names, which then reads `unknown`, and releases the tables that variant loaded, as a new
  `icons` value releases the last one's tables; a load in flight for a dropped variant adds nothing. A bare
  `provideVariants` still only adds; `{ replace: true }` is the provider's path.
- Open (icons second property pass, 2026-11-11): the registry and icons-plugin take a table whose namespace, or a
  glyph's name, holds a colon or whitespace, which no `splitIconRef` reads: namespace `a` with glyph `b:c` and
  namespace `a:b` with glyph `c` share the slot `a:b:c` under two owners. Whether such a table is refused.
- Open (icons second property pass, 2026-11-11): in dev, icons-plugin's tables still follow the order modules were
  transformed in, so `virtual:weasel-icons/all` lists them in that order; the build path sorts by module id.
- 2026-11-20 (my call, audit round 50): icons-plugin warns on an imported `icon` used other than as a direct call
  (`list.map(icon)`, `const f = icon`, a tagged template) rather than failing the build; `icon!('x')` and `(icon)('x')`
  are rewritten as calls. In dev, a regenerated table's new glyphs reload every loaded variant, and a glyph it drops
  stays until a restart. `weaselIcons.vite()`, `.rollup()` and `.rolldown()` return two plugins, the second ordered
  `post` to read modules another plugin compiles to JS.
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
  `skipped`. `writePdf([])` throws. `writePdf` reads no scene; `exportRegionsPdf`, which
  writes a scene's regions through it, lives in `@weasel-js/pdf/export`, a separate entry taking core as an optional peer so the
  main entry stays free of core and React (2026-11-12), and registers as the `pdf` export format.
- 2026-10-20 (arc 4, PDF): `resolveStrokeLengths` takes `{ quantize: false }`, so `{ px }` stroke
  widths resolve at the exact scale in a PDF. `markerDrawCommands`, `syntheticBoldOffset` and
  `emboldenGlyphD` are now exported rather than copied.
- 2026-10-20 (arc 4, audio graph): `connect` refuses any cycle, delay or not. A connect that closes
  a cycle only through an edge still fading out is wired once that edge has closed. The graph's
  output starts at gain 0, so the first `start()` fades in. `apply` validates the whole list first,
  but a `set` that throws lets the rest apply and then rethrows. `dispose()` fades out over `fadeMs`
  while sounding. `createDelayNode`'s `maxTime` defaults to 2000 ms. `impulseResponse` lives in
  `@weasel-js/audio`, and `createReverbNode` builds its impulse from `seconds` (default 2).
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
- Rotate and resize fire `onRunStart` at press; move fires it on the first movement. Left as is.
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

- `fitViewToBounds`, `fitViewToPage`, `fitZoom` and `fitSize` return `null` for empty
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
- A list or menu counts a typed key by code point (`isOneChar` in registry), so an emoji types and an access letter
  can be one.
- `lerpHueDeg` with `longer` and two equal hues stays put, where CSS goes a full turn, because an achromatic endpoint
  takes the other side's hue and a full turn would spin a ramp to white or black. Left as is.
- Marquee and lasso extend the selection only with Shift, whatever key the selection extends with. Left as is.
- `CommandPalette`'s action-settings dialog stays editable when its action turns disabled; the popover disables. Left as is.
- `CommandPalette`'s `reasonLabels` replaces the default wording rather than merging with it. Left as is.
- `createMarkdownRenderer` ignores a run's own `fill`, and under a `textBaseline` other than alphabetic places each
  run by its own font's metrics. Left as is. `CanvasPositionedRun.lineSize` is new, after `size` was removed.
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
- Snip and Reach pass over locked and hidden strokes; a locked stroke still cuts and stops, a hidden one does
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
- Warp and knead on a group skip its locked and hidden members, as Snip and Reach do.
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
- Open: a clearable number pref with a numeric default reads back as the default once cleared in a store.
- Open: negative stroke widths pass through the draw.io, DOT, and Mermaid readers unchanged.
- A `Slider` key that cannot move its thumb sends neither `onInput` nor `onChange`, as `docs/conventions.md` ("Edit
  callbacks") has `onChange` skip an edit that changed nothing; it still keeps the key from the page (2026-11-20).
- Open: which edge an RTL menu favors when it fits on neither side, or is wider than the viewport. menu's placement
  property skips both cases (2026-11-10).

## Audit round sixteen (2026-11-11): contracts

- Open: a mixed number slider in `PropertyField` disables its track and reads out a dash that takes no focus, so it
  cannot be edited, while `PrefsForm`'s `mixed` says editing one calls `onChange` as usual. A test pins the disabled
  track ("parks a mixed slider").
- A `Slider` drag that moves several thumbs (shift-all, or a region) lands them where one dragged thumb could: under
  `snap: 'strict'` each moves the same number of stops, as many as the pointer crossed, so they stay on stops and
  may not keep their gap; otherwise each lands on the `step` grid (2026-11-20).
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
- Ruled 2026-11-20: a lens source owns the bitmap in each `LensCapture` it hands out. A capture is good until that
  source's next capture for the same lens side, or until the shot is dropped, and a caller keeping it longer copies
  it. The Pixels source closes every shot it lets go of; Difference copies its two captures as they land.
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
- Cmd+V of a weasel copy steps on from that canvas's last paste of the same payload, as the Paste button does,
  remembered per paste adapter (2026-11-20, audit round 47). Copying the same unchanged nodes again keeps stepping,
  since the handler cannot see a copy made in another canvas. Open: Cmd+V still lands at the adapter's offset where
  the Paste button lands at the pointer by default.

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

- Ruled 2026-11-12 (Mike, 2026-11-12: respect the locale where it can be done reliably): the number fields show and
  read in the user's locale. `UnitField` takes a `locale` prop and otherwise follows React Aria's (`useFieldLocale`):
  the nearest `<I18nProvider locale>`, else `navigator.language`, else `en-US`, so one provider sets every field,
  React Aria's `NumberField` included. `PropertyPanel`'s number controls and read-only numbers, the DOM menu's number
  rows and, through `navigator.language` or a `locale` option, the hud menu's follow it. Display and parse go through
  that one locale on every path; `compact` and `zoom`, which wrote `en-US` everywhere, now write the locale too, with
  the `K`/`M`/`B`/`T` suffix kept. `fieldLocale` keeps a locale only where its numbers read back as shown, else
  writes it with Latin digits (`-u-nu-latn`), else falls back to `en-US`; every locale tried, non-Latin digits
  (`ar-EG`, `hi-IN-u-nu-deva`, `fa-IR`, `th-TH-u-nu-thai`) included, reads back without a fallback.
- Mike, 2026-11-12: respect the Ctrl text-editing shortcuts on macOS. On a Mac, in text being edited, a Ctrl chord
  without Cmd is Cocoa's Emacs-style editing (Ctrl+A, E, B, F, P, N, D, H, K, Y, T, O, V, L) and belongs to the
  text: no kit shortcut claims it and nothing prevents its default. Off a Mac nothing changed. Built: gestures'
  `textOwnsChord(e, isMac)` holds the rule; text-dom's style shortcuts take Cmd only on a Mac; a HUD menu text row,
  which edits for itself, takes Cmd+A as select-all and Ctrl+A, E, B, F, P, N, D, H, K, Y and T as a one-line Cocoa
  field does: Ctrl+K cuts into a kill buffer the menu's text rows share, Ctrl+Y enters it at the caret, and Ctrl+T
  swaps the grapheme clusters either side of the caret, the last two at the line's end. Ctrl+O, V and L open a line,
  page down and center, which mean nothing in a one-line field. Every other key handler reads `mod` or skips
  editable targets already.

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

## Audit round twenty (2026-11-12): a poster designer

- Open: copying a styled range out of one text box and pasting it into another keeps only bold, italic, the rules
  and super- and subscript; a run's own face, size, color and letter spacing take the destination's, because the
  paste reads the browser's copied markup, where those cannot be told from the source page's defaults (text-dom's
  README says so). Whether a copy made in the edit overlay should keep them. If so, the overlay writes its own runs
  to the clipboard on copy and cut, beside `text/plain` and `text/html`, and `clipboardRuns` prefers them.
- Open, and seen again (see the 2026-11-10 entry on italic and weight): a consumer who registers one face of a
  custom font with `registerFontOutlines` and bolds a word gets the word set in the default family, or not drawn
  where there is none or under the `'none'` policy, where an atlas face would fake the weight (run in jsdom).

## Audit round twenty (2026-11-12): app settings and an inspector

- 2026-11-12 (the lane's call): `@weasel-js/ui` re-exports React Aria's `I18nProvider`, and its README tells a
  consumer to set number fields' locale with that one. ui pins `react-aria-components` exactly, so a provider from a
  consumer's own copy of another version holds a locale the fields never read.
- 2026-11-12 (the lane's call): `PrefsForm` takes `errors`, a `ReadonlyMap` from leaf path to message, shown under the
  leaf's row as its `error` (set through `<RowScope>` since 2026-11-14). A map, as `auto` and `mixed` are sets,
  rather than a `validate` field on the leaf: what counts as wrong is the caller's to say. `SelectionPanel` has no such prop yet.
- 2026-11-12 (the lane's call): `usePrefsState` returns `setAuto(path, next)` for `PrefsForm`'s `onAutoChange`, where
  its JSDoc had offered `reset`. It pins at `store.get(path)`; theme-editor keeps its own, which pins at the value the
  pinned theme shows.
- Open: `Slider` now follows the number fields' locale, but number text that only displays does not:
  `QuantityText` defaults to `en-US` as its JSDoc says, and `MeasureReadout`, the timeline's `Transport` and ruler,
  and the gradient editor's stop positions write `en-US` always. Whether the 2026-11-12 locale ruling reaches them.

## Audit round twenty (2026-11-12): an animated presentation

- 2026-11-12 (the lane's call): a timeline's `seek` or `edit` between frames shows the targets its tracks hold
  before it returns, as it already called a track's `onTick`; a seek inside a frame still shows with that frame.
  Before, the target read the new value at once but showed it at the next frame, so a render right after a seek drew
  the frame before.
- Open: scrubbing `<AnimatedTransport>` or `<AnimatedTimeline>` seeks a playing timeline and leaves it playing, as
  `<AnimatedTimeline>` always has. The timeline demo, which wired `<Transport>` by hand until 2026-11-12, paused on a
  scrub. Whether a scrub pauses playback.

## Audit round twenty (2026-11-12): a vector drawing app

- 2026-11-12 (the lane's call): a drag inserting a consumer-defined kind previews the outline of the box it will
  fill, as a rect drag does, where it used to show nothing until release. A kind whose descriptor sets
  `insertPreview: false` (pen, lasso) still shows none. The alternative is previewing the node itself, through the
  insert dep's `peek` and its painter.
- 2026-11-12 (the lane's call): `registerNodeShape` at the default priority puts a painter ahead of
  `kit:rect-fallback`, which used to match every rect-posed node first and left a default-priority painter unable
  to paint one.

## Audit round twenty (2026-11-12): a tuning lab

- A settings edit that sends drafts (a slider drag, a number typed, a color dragged) is one undo step from its first
  draft to the value it settles on, however long it pauses; a write with no drafts still runs together with the
  next by labkit's 500 ms gap, which the round-15 entry above leaves open (2026-11-12).
- Open: a trial's Load snapshot menu offers only the snapshots that trial saved, though the store loads any
  snapshot of the same instrument into any trial. So a snapshot cannot be loaded into a clone to compare it with
  the trial that saved it, and a lab wanting presets shared across trials lists `useLabContext().savedSnapshots`
  itself. Whether the menu offers every snapshot of the instrument, groups them by trial, or stays per trial.

## Audit round twenty-one (2026-11-12): developer ergonomics

- A checkout counts as installed when `node_modules/@weasel-js/core` exists, the workspace link `npm ci` writes; a
  `node_modules` holding only a tool's `.cache` does not. Every vite and vitest config, the tsup preset, and the
  build, typecheck, consumer smoke and `check:needs` scripts refuse a checkout without it (2026-11-12).
- `npm test` inside any package with tests runs `scripts/package-test.mjs`, which runs the package's files from the
  repo root under whichever projects own them, on one worker unless told otherwise. labkit keeps its own
  `vitest run`, since it has a config of its own (2026-11-12).
- The `test:gate` npm script is gone rather than guarded: nothing called it, and the gate runs only inside a fleet
  run (2026-11-12).
- `.npmrc` is gone: its one key served `pnpm install`, which pnpm 10 no longer does for this repo, and npm warned
  about it on every call. The workflows keep `NPM_CONFIG_LOGLEVEL: error` (2026-11-12).
- The star re-export rule covers every package's source and the apps alike; bare paths under core's own tsconfig
  aliases (`interactions/…`) are not packages to it (2026-11-12).
- Open: a bare `npx vitest` inside a package with no vite or vitest config of its own still runs that package's
  files under vitest's defaults, with no project's setup. Only a config file in each such package could refuse it.

## Audit round twenty-one (2026-11-12): text

- 2026-11-12: The bidi and shaping contracts take the implementing packages' names where they had two:
  `BidiEngine` (as `@weasel-js/bidi` already called it, over text's `BidiResolver`) and `TextShaper` (as
  `@weasel-js/text` already called it, over text-shaping's `Shaper`).
- 2026-11-12: Face addressing splits by job. Registering and loading take a `FontVariant` object
  (`registerFont`, `registerFontOutlines`, `unregisterFontOutlines`, `loadFontOutlines`, `warmFonts`'s
  `FontRequest`); a lookup of one face takes `(family, weight = 400, style = 'normal')` positionally (`getAtlasFont`,
  `isFontPending`, `hasFontOutlines`, `outlineStatus`, `cssFontFamily`, `cssFontFamilyLoading`), since those run per
  run and per frame. `cssFontFamily` moved to the lookup shape.
- 2026-11-12: The scripts the no-shaper warning names are Arabic, Syriac, Thaana, N'Ko, the Indic blocks, Tibetan,
  Myanmar, Khmer and Mongolian, letters and marks only. Thai and Lao are left out: set one glyph per code point,
  they read, if with marks placed less well.
- `fittedTextPose` is renamed `bakeTextFit`, on the maintainer's call (2026-11-12): `fitBoxToText` sizes a text
  pose's box to its text, and the renamed one sizes the text to its box.

## Audit round twenty-one (2026-11-12): geometry and drawing

- Open: `StrokeNib.angle` turns counterclockwise on a y-down screen, as the measure readout and the Nib panel
  ("counterclockwise from level") read angles, where every other angle in geom, paint, stroke and symmetry (a
  conic gradient's `angle`, `SymmetrySpec.angle`, `RepeatStation.angle`, a marker's) turns clockwise, from +x toward
  +y. Flipping it changes every saved nib and the panel's reading. Whether the nib follows the geometry rule, or
  stays with the readout.

## Audit round twenty-one (2026-11-12): the interaction layer

- 2026-11-12 (the lane's call): an action factory is `create…Action`, as `createResizeAction` and
  `createDeleteAction` were; the six spelled `make…Action` moved. Action constants named for what they do
  (`makeBooleanGroupAction`, `makeHandlesSymmetricAction`) keep their names: there `make` is the verb.
- 2026-11-12 (the lane's call): the held-key spec kind is `keyHeld`; the gesture ids built from it keep the
  `key-held-<code>` form, kebab like `pointer-<id>`, since they are ids and not kinds.
- 2026-11-12 (the lane's call): a journal's `commit()` with no label uses the `label` it was opened with, which
  that option's doc already promised, rather than the option being dropped.
- 2026-11-12 (the lane's call): the text and image tools reposition on a held Space mid-draw, as every other
  drag-to-insert tool does.
- 2026-11-12 (the lane's call), left as they are: `History.goto` ignoring a depth out of range or not whole (its
  tests ask for that, and the scene's `jumpToHistoryIndex` clamps before it), `History.activeJournal` staying
  optional (documented so a history that never journals need not answer), `detectPlatform` answering `'macos'` with
  no `navigator` where `isApplePlatform` answers false (documented as the docs convention), and lookups such as
  `pickMenu` returning `undefined` where others return `null` (routing has no rule, and the `find`-shaped ones
  follow `Array.find`).
- Sticky keeps S, Knead moves to U, and Reach moves from U to Shift+U, on the maintainer's call
  (2026-11-12). The star tool has no default key at all.
- Open: two tool sets are not named for their tools' palette group, which `KIT_TOOL_GROUPS` says each set is:
  `RESHAPE_TOOLS` (`reshape`) holds tools in the `path` group, and `RIG_TOOLS` (`rig`) tools in `shape`. Renaming
  the groups moves where the tools sit on a palette; renaming the sets does not.
- Open: most tool hooks outside the drag-to-insert tools take a `keybinding` option (`null` to drop the key):
  lasso, slice, measure, the stroke, warp and rig tools. The drag-to-insert tools, spiro, Sand and
  Tug do not, and a binding override of `tool.activate.<id>` rebinds any tool's key.
  Whether every tool hook takes the option, or none does and overrides are the one way.
- Open: `Action.enabled(deps, at, carried, params, viewId)` takes `params` fourth where `active`, `preview` and an
  invoker's `run` take it second. Moving it to `enabled(deps, params, where)` touches every action that declares
  `enabled`.
- 2026-11-13: The platform flag's spelling is settled under round twenty-two's gesture-system section.

## Audit round twenty-one (2026-11-12): core's canvas and scene surface

- 2026-11-12: Options bags are named `*Options` (now in `docs/conventions.md`), and 19 `*Opts` types in
  core, guides and parallax were renamed to it: the layer factories', `ParallaxOpts`, `NestedHitOpts`,
  `SceneNodeClientRectOpts`, `CreateViewResolverOpts`, `ComposeSelectionPoseOpts`, `UseViewHelpersOpts`.
- 2026-11-12: The rest of core's `*Opts` types went to `*Options` too, with routing's `BindingOpts` and
  renderer's `TilePatternOpts` that core re-exports. Core's `wheelPan()` options and
  `makeViewportWheelPanAction`'s were `WheelPanOpts` and `WheelPanOptions`: the first is now `WheelPanOptions`,
  named for `wheelPan`, and the second `ViewportWheelPanOptions`, named for its action. Text's five `*Opts`
  types, which core's barrel re-exports, are the text lane's.
- 2026-11-12: Layer factories are named `create*Layer` (now in `docs/conventions.md`); core's `pagesLayer`,
  `workspaceTintLayer` and `modeDecorationLayer` were renamed to it.
- 2026-11-17: diagram's `edgeEndLayer`, `labelDragLayer`, `laneLayer`, `portLayer`, `sequenceLayer` and
  `waypointLayer` became `create*Layer`.
- Open: labkit's `seamLayer` and guides' `rulersHitLayer` are bare-named layer factories outside this lane.
- 2026-11-12: `useSliceDep` was removed rather than given siblings: it was `useDepSource('slice', () => dep)`
  under another name, and no other dep had one.
- 2026-11-12: `<SceneCanvas initialActiveTool>` became `defaultActiveTool`, the prefix `defaultView` and
  `defaultPathEdit` use for a read-once starting value.
- Open: `Scene.update(id, { data })` is the one node-field mutator not named `setX`; the adapter and the op
  already say `setData`. Renaming it reaches `packages/export`'s tests, which this round leaves alone.
- Open: `<SceneCanvas onHover>` reports an id where `onClick` and `onDoubleClick` report a `SceneCanvasHit`
  (`id`, `kind`, `world`); `DiagramView`'s `onHover` follows it.
- Open: `ActiveToolContextProvider`'s `initialActive` (tools lane) still uses `initial` where `<SceneCanvas>`
  now says `defaultActiveTool`.

## Audit round twenty-one (2026-11-12): the component kit

- Components take `'aria-label'` rather than `ariaLabel`, the DOM's and React Aria's spelling, since MenuButton, Toolbar
  and PaintInput already did and a prop spread onto the element needs no translation. A data field of a row or
  segment (`ToggleBarItem.ariaLabel`) stays camelCase, since a quoted key in every item literal buys nothing
  (2026-11-12).
- `Checkbox` keeps `isSelected`, though the kit draws it, because `Switch`, its sibling, is React Aria's and the
  two are swapped for each other (2026-11-12). Its `isDisabled` and `isReadOnly` became `disabled` and `readOnly`
  with the rest of the kit (2026-11-13).
- A `SidebarPanel` given `collapsed` and no `onCollapsedChange` now draws its toggle, as a `PropertyGroup` does;
  before, it drew a static title. labkit's sidebar sections pass `collapsible` so theirs stay static (2026-11-12).
- The schema editor's inline `PrefsDialog` preview keeps a do-nothing `onOpenChange`, so the preview still draws
  the close button a real one has (2026-11-12).

## Audit round twenty-one (2026-11-12): the developer tools

- `<Lab defaultInstrument>` is folded into `opening`, which already defaulted to it; a presented lab with no seed
  instrument opens `opening[0]` (2026-11-12).
- A boolean leaf's switch is `.switch()`, named for the control it sets, and boolean leaves have no `.toggle()`;
  the `toggle` boolean control draws as a checkbox in a lab, so no builder method asks for it (2026-11-12).
- `f.string().textarea()` and `f.enum().menu()` are the builder names for those controls, after the control
  values they set (2026-11-12).
- `f.curve`'s y range defaults to 0 to 1 and its step to 0.01; its row is a block row across the panel's width,
  label above, with no label beside it (2026-11-12).
- A disabled `CurveField` dims its plot and buttons the way a disabled `Button` does (half opacity and
  `--wzl-disabled-filter`) and ignores the pointer (2026-11-12).

## Audit round twenty-one (2026-11-12): plugin packages

- Settles round seventeen's open question on diagram's paired helpers: a `SurfaceContribution` now carries hit-tested
  layers in `layers`, registered in entry order and all again when any entry's list changes, so a rebuilt entry keeps
  its place in hit order. `attach` → `registerLayer` would have moved a rebuilt entry's layer to the top. Every diagram
  editing helper and `plot`'s `plotEditing` return one entry; `createDiagramContribution`, the connect half without
  its layer, is gone rather than kept beside `createDiagramPortsContribution` (2026-11-12).
- `d3` and `diagram-elk` are `weasel.tier: "other"`, not `plugin`: neither hands a canvas a layer, tool, action, dep or
  draw command. d3 joins data into a scene and diagram-elk is a layout planner for diagram. `kernel3d` stays `other`
  as a host for 3D scenes, though it ships a tool and deps (2026-11-12).
- A timeline's `loop: n` now counts passes, as a clock's does, rather than laps after the first; `loop()` reads the
  passes left counting the one under way, so `setLoop(loop())` changes nothing (2026-11-12).
- Audio keeps `stopAll()` beside the renamed `cancelKey(key)`: it stops sound, and the animator's `cancelAll` names
  animations. Its `NoisePatch.noise` stays beside the graph's `NoiseNodeOptions.color`, since patterns are saved as
  data (2026-11-12).
- Contribution factories keep their packages' names (`diagramPorts`, `plotEditing`, `createMinimapContribution`): core
  itself mixes `createDragPanContribution` and `createPresentationContribution`, and no convention picks one. Presets do
- Contribution factories keep their packages' names (`createDiagramPortsContribution`, `plotEditing`, `createMinimapContribution`): core
  itself mixes `dragPanContribution` and `createPresentationContribution`, and no convention picks one. Presets do
  have one, now in `docs/conventions.md` (2026-11-12).
- A `createSpacingHintsPreset` given an `id` names its sources `<id>.spacing` and `<id>.alignment`; with none they
  keep `spacing` and `alignment`, so a canvas with one preset reads as before (2026-11-12).
- Open: whether `BindingOpts` (routing), and `ParallaxOpts` and `ZoomClampOpts` (core) take the `Options` suffix.
  This lane's packages only import them, so the rename belongs to core's and routing's lane.
- Open: audio's reverb and impulse lengths are seconds (`impulseResponse(ctx, seconds)`, the reverb insert's
  `seconds`) where every other audio duration is ms, and the animator's `slew` steps in seconds where its tweens take
  ms. Changing either is a unit change inside an option that keeps its name, which a caller would not see break.

## Audit round twenty-two (2026-11-13): the gesture system

- 2026-11-13: Whether `mod` is Command is one boolean named `apple` everywhere, after `isApplePlatform()` and
  `ModeShortcut.apple`. `DispatcherContext.isMac` is now `DispatcherContext.apple`, and the matchers' parameter
  (`matchSpec`, `matchModifiers`, `specificity`, `historyKey`, `textOwnsChord`, `matchesKeyBinding`) is `apple`,
  as `captureKey`'s and `browserReservedChord`'s already were. `isMac` was wrong on its face: iPhone and iPad
  count. `platform` stays the name of a `Platform` (`'macos' | 'windows' | 'linux'`), which `formatShortcut` and
  `describeKeymap` take because a legend tells Windows from Linux (`⊞` against Super) and a matcher does not. The
  two are different types, not two spellings of one.

## Audit round twenty-two (2026-11-13): the prefs schema

- A store-bound form binds through `usePrefsState(store).form`, spread on `PrefsForm` or `PrefsDialog`, so every
  bundled one offers Auto and splits scoped leaves the same way. Theme-editor's form keeps its own binding: its
  writes go through its undo history and only its token rows inherit. `Prefs.split.stories.tsx` keeps its explicit
  props, since spreading `form` would add Auto toggles to a story about split rows (2026-11-13).
- labkit's lab config stays its own schema, bridged both ways by `prefsFromConfig` and `configFromPrefs` and tested
  there, rather than declaring through `pref` (2026-11-13).
- The kit settings of ui, core, rig, kernel3d and labkit are tested together from the site
  (`apps/site/__tests__/kitSettingsSchemas.test.tsx`), the one test project that imports every package: their paths
  must equal `KitSettingPath` between them, each declared once (2026-11-13).
- Open: draw's preferences do not include any kit settings schema, so a draw user cannot change a gesture timing or
  a target size. Whether draw's dialog should carry them is a product call.

## Audit round twenty-two (2026-11-13): core's built-in tools

- 2026-11-13 (the lane's call): a tool option's color default takes one spelling, `solid`'s: six lowercase hex
  digits with any alpha as `opacity`, and no `kind` (`{ color: '#000000' }`). Every paint leaf a built-in tool
  declares goes through `toolOptionPaint`, so the text tool's fill and the sticky's ink, which came from text's
  `#000`, now default to the same value a black stroke does. Text nodes made outside a tool keep text's own
  `DEFAULT_TEXT_FILL` (`#000`); respelling that is the text package's change, and would move every saved text node.
- 2026-11-13 (the lane's call): the last-operation panel shows the live tool's options beside the action's own
  params (`ActionTuning.form`), so a rectangle's fill and stroke width, and a placed sticky's paper and ink, are
  levers after the shape is drawn. The lasso's hit mode became its tool option. The measure tool's `angleStep`,
  the slice tool's `closeHitRadius` and the lasso's `minVertexSpacing` stay hook options: the first reads only
  under Shift, and the other two are reach and sampling settings rather than something a user tunes per run.
- 2026-11-13 (the lane's call): the hand tool and the lasso commit nothing to the history (a pan edits the view, a
  lasso the selection), so the walk over every built-in tool checks that they leave the history alone instead of
  undoing them. `image`, `eyedropper` and `measure` need arguments, so they are in no built-in tool set and no
  `KIT_TOOL_GROUPS` entry; they sit in the `shape` and `view` palette groups when a host mounts them.
- No two tool keys collide, in core or across path-tools and rig, and no action binds a bare letter. The star and
  image tools have no key; the bare letters no tool takes are C, D, O, Q, X and Z (B is pin warp, F plane warp, J bone,
  U knead, W weight and Y snip).
- Open: the sticky tool's cursor is the rectangle's (`cursorFor('crosshair', { mark: 'rect' })`), so the two are
  not told apart from the pointer, which the shape cursors were drawn to fix. A `sticky` mark is a new glyph.

## Audit round twenty-two (2026-11-13): tools outside core

- 2026-11-13 (the lane's call): what each sequence tool adds (a lifeline's figure, a message's arrow, a fragment's
  type, a lifeline mark) is kept per tool, not under a shared key: no two tools add the same thing.
- 2026-11-13 (the lane's call): the path-edit tools (Sand, Tug) declare no cursor of their own,
  as core's `anchors` tool does not: the cursor over an anchor or a stroke is the action's. The path-tools canvas
  test exempts them from `toolGaps`'s cursor line and nothing else.
- 2026-11-13 (the lane's call): the camera glyphs moved from `ui` to a `kernel3d` namespace, so the orbit tool and
  the camera actions name their glyphs without kernel3d depending on ui.
- Open: these bundled tools have no default key: kernel3d's orbit, diagram's connector, its stencil tools and its
  sequence tools, and path-tools' Sand and Tug. No two bundled tools share a key now. Of plain
  letters, C, Q and Z are free across the kit; D, X and `/` are WeaselDraw's color keys and O its opacity scrub's
  held key. With Shift, every letter is free but U, W, M, P, F and X.
- Open: the `anchors` tool (path-tools' since 2026-11-15) has no bindings and no cursor (`toolGaps` names both),
  since path edit's drags are ambient. Whether a tool that binds nothing should exist as one, or path edit's entry
  is a mode with no tool, is path-tools' lane.

## Audit round twenty-two (2026-11-13): bundled default bindings

- Two collision tests hold the bindings: editing's `kitBindingCollisions.test.tsx` loads every binding the kit ships at
  once (the sweep in `packages/editing/src/integration/core/canvas/SceneCanvas/kitSweep.fixture.tsx`, tool keys as one `tool.activate`) and runs the dev route-conflict check
  over it, with kernel3d as a scope of its own; draw's `bindingCollisions.test.tsx` mounts draw's features, entries,
  tools, tunings and commands on one canvas. Neither found a collision once `reportRouteConflicts` stopped counting
  `hover` bindings, which all run (2026-11-13).
- An action's own key binding carries `BETWEEN_GESTURES`, or a phase of its own, unless it only moves the view
  (`viewport.zoom.*`), is an Escape that `dispatch.cancelAll` takes mid-drag (`exitPathEdit`, `tool.resetToDefault`), or
  (`viewport.zoom.*`), is an Escape that `cancelGesture` takes mid-drag (`leavePathEdit`, `tool.resetToDefault`), or
  opens a keymap. `kitBindingPhases.test.tsx` holds the kit to it, and the tool keys now carry it as the offhand keys
  did. draw's color keys and view toggles do not: they change the next shape's style or the view, not the document,
  and a change mid-draw reaching the shape is how the tool options work (2026-11-13).
- Binding ids are `<owner>.<role>`, the role naming the variant or, for a lone binding, the gesture; Spiro's
  `finishClick`-style ids and pinch zoom's `.pinch` on a `multiTouch` were the strays. An app's tuning on a kit
  action keeps its app prefix (`draw.constrainAnchors.horizontal`), so a later kit default cannot take its id
  (2026-11-13).
- A binding that takes any modifier uses `ANY_MODS` (`@weasel-js/gestures`, re-exported by routing and core). The
  pen's handle drag and path-tools' anchor link leave Meta out on purpose and keep their own `mods` (2026-11-13).
- Unbound actions are reached from a panel, a menu or the palette on purpose: the setters a panel drives (`setFill`,
  `setStroke*`, `setAnchorField`, `setFillets`, …), align and distribute, the path commands and path-effect
  release/expand, the diagram router choices, the path-edit `show.*` toggles, `present.go`, and `measure.moveBy` /
  `rotateBy`. The Pathfinder operations are reached by key through the Alt+P keymap's holds, and `clipboard.paste`
  by the DOM paste event (2026-11-13).
- Open: no tool key collides in the kit or in draw. Settled 2026-11-12: Sticky S, Knead U, Reach Shift+U. draw
  binds X to swap fill and stroke and Shift+X to swap focus, D to reset the colors, and / to toggle the focused
  paint to none; crop mode holds C. Free in draw, unmodified: J, Q, W, Z (rig's Bone J and Weight W are not in draw,
  so kit-wide only Q and Z are free). Free in draw with Shift: A, B, D, E, G, I, J, K, L, N, O, Q, R, S, T, Y, Z.
- Pinch dolly is driven by two touch pointers (`pinchDolly.integration.test.tsx`), and `@weasel-js/hud`'s long-press
  by a touch or pen held on a widget (`longPress.integration.test.tsx`, round twenty-three).
- Chart's command keys (grid, undo and redo, group and ungroup, the page keys) take `<action>.key` ids, as draw's do
  (2026-11-13, in the batch).

## Audit round twenty-three (2026-11-13): input modalities

- 2026-11-13 (the lane's call): a HUD press that neither a click nor a drag closes (a long-press took it, a second
  finger took it for a pinch, the browser canceled the pointer) ends in `cancel`, sent a task after that pointer's
  release, cancel or a window blur. It is not sent when the long-press fires: a held stepper chip keeps repeating
  until the finger lifts, which is what holding a stepper asks for. The HUD tracks this itself
  (`openPresses.ts`) because the dispatcher has no gesture for "a press ended without a click", and a `pointerDown`
  binding is the only one that hears a press before it settles.
- 2026-11-13 (the lane's call): a HUD widget treats any `move` as the end of its click, since the dispatcher sends
  `move` only once a press crossed the `gestures.dragPx` kit setting. The window widget no longer restates the
  threshold as `DRAG_THRESHOLD_PX`, which under a smaller kit setting let a drag of a few pixels also click.
- 2026-11-13 (the lane's call): the minimap zooms on both forms of trackpad pinch, ctrl+wheel (`<id>.trackpad`) and
  WebKit's `pinch` (`<id>.pinch`), as `viewport.zoom` and `camera.dolly` do, and its dispatcher now listens for
  WebKit's gesture events when wheel zoom is on. A WebKit pinch carries the world point under its focal point, as a
  wheel does, so an action can zoom about it without its own client-to-world map.
- 2026-11-13 (maintainer-approved; the lane's calls on the shape): the minimap takes a two-finger touch pinch,
  `minimap.touchZoom` bound as `<id>.multiTouch`. It zooms the main camera about the world point between the fingers,
  read through the minimap's own camera, and that point keeps its place in the main view as the fingers move, so the
  main view follows them the way a one-finger pan does (the opposite sign to `viewport.touchZoom`, whose content
  follows the fingers). It clamps as the wheel does. The minimap's camera reaches the action as the `view` dep, which
  `<MinimapCanvas>` now publishes beside `rootView`: the pair a `<CanvasView>` answers on a surface, so one action
  runs in both hosts, and any secondary view with a dispatcher of its own answers the same pair. Its `set` drops the
  write, as a derived `<CanvasView>` camera's does.
- 2026-11-13 (the lane's call): a finger panning the minimap keeps its drag when a second finger lands (the
  recognizer's rule), and the pan sits still while a pinch steers the same main camera; when the second finger lifts,
  it resumes from where the pinch left the view rather than jumping back to center on the finger. Lifting the pan's own
  finger first ends both, and the finger left pans nothing: its press went to the pinch.
- 2026-11-13 (the lane's call): `wheelZoom` on `<MinimapCanvas>` and `createMinimapContribution` is renamed `zoom`,
  since it now switches and clamps the touch pinch too.
- 2026-11-13 (the lane's call): a multitouch centroid is in the CSS pixels of the view the gesture runs in, not the
  canvas's. A pinch inside a `<CanvasView>` zoomed about a point offset by the view's rect origin (measured: a
  pinch at the panel's x = 50 left the panel camera at x = 46.67 where 13.33 holds the point).
- 2026-11-13 (the lane's call): `Select`'s opening click ends at the `gestures.longPressMs` kit setting: held longer,
  the release picks a row. The insert action's own 8 px drag threshold stays its own: it only ever raises the bar the
  `gestures.dragPx` setting sets, since the recognizer opens no drag before that setting is crossed.

## Audit round twenty-three (2026-11-13): prefs over time and at the edges

- A stored value reads the same in every bundled settings store: prefs stores through `repairPrefValue`, and a lab's
  trials and snapshots through the same call on the way in (`repairedConfig`, run after a config's migration and
  its defaults). A number clamps into its range; a value of the wrong kind, an option no longer offered, a color no
  color reader reads, or a paint that is no paint reads as the default; a string past its `maxLength` is cut. A key
  no leaf describes is kept by both, so a schema rolled back finds it (2026-11-13).
- A `color` leaf keeps any CSS color the kit's `tryParseColor` reads, not only hex: `ColorField` reads the same set,
  and labkit schemas default to names like `'red'` (2026-11-13).
- A labkit number's `.suffix()` is the prefs leaf's `unit: { scale: 1, suffix }`, the form the kit settings schemas
  already use; a number's `placeholder` and a string's `maxLength` are prefs fields. Labkit keeps one extra the
  schema lacks, `debounceMs`, since ui sets how long typed text waits per surface (`textWaitMs`), not per leaf
  (2026-11-13).

## Auto and reset (2026-11-13)

- Auto is opt-in and is a distinct concept from default (maintainer's ruling, 2026-11-13). A leaf can be auto only
  where its schema declares `auto`; prefs, `PrefsForm`/`PrefsDialog`, `usePrefsState(store).form`, `SelectionPanel`,
  labkit and the theme editor all read `prefCanAuto`. `auto: false` meant the same as no `auto` and is gone. While
  auto a leaf reads its owner's computed value, else `auto.value`, never `default`; this corrects the first pass
  of this section, which made the default the last case of auto and let a leaf with `auto` unset be auto
  (2026-11-13).
- So draw's, the editor's, chart's and the site demos' settings forms show no Auto toggle: none of their leaves
  declares `auto`, and each gets Reset alone (2026-11-13).
- A store's leaf that opts in with no `auto.value` reads `undefined` while auto, as labkit's does with no resolver;
  turning Auto off pins what its control shows, which with nothing computed is what a field holding nothing draws,
  the default (2026-11-13).
- A theme token's `auto` is `{ on: true, value }`, `value` the theme's resolved value split along its axes: the
  theme is what computes a token while it follows it. An `auto.value` may be a `PrefScope` on a leaf with `scopes`,
  as `defaultScope` is (2026-11-13).
- A surface that keeps no auto state resets a leaf to its `default` and judges it reset against that, whatever its
  `auto` says (2026-11-13).
- The schema editor's Auto panel says "Can be auto" where it said "Never auto". Setting "Starts auto" or an auto
  value opts the leaf in, and clearing either leaves it opted in, as `auto: {}` (2026-11-13).
- Reset returns a leaf to the state its schema starts it in: auto for a leaf that says `auto.on`, pinned at its
  `default` for any other, including one that can be auto but does not start so. Reading "unpinned if it can be
  auto" literally would make a reset of such a leaf write a mark, and give `auto.on` no say in it; this reading
  makes a store's `reset` just store nothing (2026-11-13).
- A prefs store keeps a leaf that is auto against its schema's start as a record of its own, `{ $at, $auto: true }`,
  which no migration is handed; a leaf that starts auto is stored as nothing while it is. `stored()` shows the mark
  as it is (2026-11-13).
- labkit hands an instrument `undefined` at an auto path where neither a resolver nor `auto.value` gives a value,
  as before: the instrument is that leaf's resolver (`.auto()` says only it can work the value out), and
  `undefined` is how it knows to. A resolver that returns `undefined` leaves the path so too. Its row draws what
  the instrument reports, and quotes nothing until a report (2026-11-13).
- A write of a group's value in labkit pins every leaf under the group's path except one it holds the `auto`
  sentinel at, which unpins that leaf and keeps what it last held. A group reset is one such write, so it stays
  one undo step (2026-11-13).
- The per-row and the group reset are one control, `ResetControl`: the reset glyph that labkit's `ResetGroup` and
  ui's `TokenPanel` already drew, made a span with a button's role, because a `<button>` inside a row's `<label>`
  takes the row's name off its control. A row shows it only while its leaf differs from what a reset makes it; a
  heading shows it always, disabled while nothing under it differs (2026-11-13).
- `SelectionPanel`'s rows and `resettable` sections reset too, writing `prefStoredReset` into every selected node
  in one undo step; a scene node has no auto state, so a row there compares values only (2026-11-13).
- The theme editor's tokens say `auto.on` (following the theme) and its axes declare no `auto`; each token page is
  `resettable` (2026-11-13).

## Audit round twenty-three (2026-11-13): tool surfaces

- A tool's key, wherever chrome shows it, is read from the live `tool.activate` bindings: `ToolsApi.shortcuts`, which
  `useTools` keeps from its actions scope (the declared `keybinding`s with no scope). `ToolPalette`, its stacks' menu
  rows, core's devtools registry, draw's registry inspector and tools widget, and labkit's trial rail all read it, so
  a key rebound through `bindingOverrides` reaches each and an unbound one drops its chip. `ToolPalette`'s
  `lookupShortcut` and `ToolPresentation.shortcut`, the two ways to restate a key by hand, are gone (2026-11-13).
- A labkit chrome item's `shortcut` is a `ShortcutInput`, formatted by `formatShortcut` in every region; a header item
  that binds `keys` shows its command's live key, and a `TrialTool` the trial's scene holds shows the scene's key.
  The site's lab demos no longer restate their tools' keys: several had drifted (the Reach lab said U, the knead
  lab S) (2026-11-13).
- Every tool option's color default is in `toolOptionPaint`'s spelling, draw's host-given shared fill and stroke
  included; core's `shapeToolOptions.test.tsx` holds the built-ins and draw's `prefs.test.ts` holds draw's whole tools
  schema (2026-11-13).

## Audit round twenty-three (2026-11-13): the shortcut sheet

- The kit has a keyboard shortcut sheet, approved 2026-11-13. `describeShortcuts` (routing, beside `describeKeymap`)
  reads it from an actions registry's `list()`: tool keys from `tool.activate` through `toolShortcutsOf`, the same
  read `ToolsApi.shortcuts` makes, command keys from each entry's `key` bindings, and held keys from `keyHeld` ones,
  `tool.offhand` named for the tool it holds. ui's `<ShortcutSheet>` draws it, since ui owns the chrome that reads the
  dispatcher's bindings (`CommandPalette`, `ToolPalette`) and core holds no React chrome (2026-11-13).
- `shortcuts.show` opens it on Shift+/ (`SHORTCUT_SHEET_KEY`, `?` on a US layout, held to the Slash key by `code`).
  It was free: draw's `/` (`color.toggleFocusedNone`) forbids Shift, forge's keys panel is Alt+/, the site's palette
  listens for `/` itself, and draw's binding collision test now mounts the sheet's command (2026-11-13, the lane's
  call: a command key).
- Tools are grouped by the `ToolSet`s a host passes, headed by the set's new `label`, and the rest follow under
  "Other tools"; every registered tool is listed, a keyless one as "No key", so an unbound key reads as gone rather
  than the tool. Commands are grouped by `Action.group` and listed only with a key. A key that requires Ctrl or Meta
  has no chip form (`keySpecShortcut`) and is left out, as menus leave it out (2026-11-13).
- Pointer gestures a modifier changes ("Shift+drag: constrain") are not listed. Most such bindings are a tool's or an
  entry's, not an action's, and say which action the gesture runs, not what the modifier does to it; what a modifier
  does mid-gesture is a modifier role, declared per action, so the sheet would repeat "Shift: Constrain" under each
  action that snaps. A keymap's own keys stay `<KeymapHint>`'s; its leader is listed as a command (2026-11-13).
- `<EditorShell>` mounts the sheet; a workspace names its tools with `usePublishEditorTools(tools, toolSets)`, since the shell
  sits above the canvas that holds them. `<Lab>` mounts one too, naming the lab's `TrialTool`s, with a row in its Lab
  menu (2026-11-13).

## Audit round twenty-three (2026-11-13): tunable values

- 2026-11-13 (the lane's call): a reach, a drag threshold, a gesture's rate, a sampling step and anything that only
  moves the view stay out of the params forms, as round twenty-two ruled for the slice and lasso tools; the
  allowlist beside `kitActionParams.test.tsx` names each with its reason. The path-tools click commands' reach
  (`radiusPx`, `reachPx`) predates that ruling and stays a lever.
- 2026-11-13 (the lane's call): nudge's step is the binding's `magnitude` variant, ui-input's arrow steps shared with
  every keyboard-stepped control, so nudge declares no params.
- 2026-11-13 (the lane's call): Select every Nth anchor declares its count as a form although selecting anchors is no
  undo step and so never reaches the last-operation panel; a surface driving it reads the range there.
- 2026-11-13 (the lane's call): world-unit params (Simplify's tolerance, Offset Path's distance, Duplicate's offset,
  the path effects' sizes) carry no unit; a document unit scope is what would show them in a unit.

## Audit round twenty-three (2026-11-13): the apps

- 2026-11-13 (the lane's call): a double-click on text opens it through `enterTextEditAt`, an action of its own in the
  `textEdit` feature (part of `edit`), rather than a default binding on `enterTextEdit`: that one opens the
  selection and is what the text and sticky tools' clicks reach, which should keep opening the selected node
  whatever glyph is under the click. `enterTextEditAt` declines where the double-click names a group, so text
  in a group enters the group first and opens on the next double-click, as path edit does.
- 2026-11-13 (the lane's call): a canvas inside a host's `useSceneTextEdit` container answers the `textEdit` dep
  with that editor, so a host binds nothing for a double-click or a text tool to reach it. `TextEditDepPublisher`
  stays for a host whose container does not hold the canvas.
- 2026-11-13 (the lane's call): draw keeps the loupe's mode and magnification as prefs (`loupe.mode`,
  `loupe.factor`) and whether it shows as session state; its color mode is `ui.colorMode`, and a choice saved under
  the old `wd-mode` key is not carried over. Chart keeps its pipeline Show toggles as `pipeline.*` prefs.
- 2026-11-13 (the lane's call): theme-editor's last-open theme stays a localStorage record beside the drafts: it says
  which document was open, not how the user wants the editor to behave. Its preview surface (`surfaceKey`) stays in
  the saved state too, since a preset records the surface it was tuned on.
- 2026-11-13 (the lane's call): the site's own shell keeps its DOM handlers: the demo frame's resize handles (a drag,
  arrow keys and a double-click reset) and the command palette's `/` key. Neither is a demo, and the shell mounts no
  dispatcher; running each through one would mean an actions registry, a dep registry and a dispatcher for one
  affordance.

## Audit round twenty-four (2026-11-14): the pending changelog

- 2026-11-14 (the lane's call): a pending changeset describes the release against 1.19.1, so a name added and
  renamed or removed inside the span appears in no entry at all: `Bar.Button`, `undoShortcuts()`,
  `PrefRenderContext.draftValue`, `lengthen.drag`, the `*_BRUSH_TOOL_OPTIONS` constants, `onReset` on a settings row,
  and `AnimatedTransport` in the `Timeline` subpath.
- 2026-11-14 (the lane's call): a fix or prop added during the span to a component the same release removes is
  deleted, not rewritten (the `Toolbar` size fix, `DetentSlider`'s Along fill and its `onInput`/`onChange` rename,
  which fold into the `useDetents` entry). An addition that survives in the replacement is rewritten in the
  replacement's terms instead: `orientation` and `disabledReason` on `OptionsBar`/`ButtonBar` became `SegmentedBar`'s,
  and lists of components that took a prop name `SegmentedBar`, `CycleButton`, `Bar` and `PrefsBar`.
- 2026-11-14 (the lane's call): labkit's `weasel-ui` subpath is described only by the entry that removes it; the ui
  moves that also said it stopped re-exporting their names no longer bump labkit for that.
- 2026-11-14 (the lane's call): `f.boolean(…).toggle()` was 1.19.1's switch and is now a toggle button, so its entry
  is `breaking behavior` saying to call `.switch()`, not that `.toggle()` is gone.
- 2026-11-14 (the lane's call): `PaintSlot` is described as moving to `@weasel-js/paint` only; the entry exporting it
  from ui's root contradicted what ships and was deleted.

## Audit round twenty-four (2026-11-14): published surface

- 2026-11-14 (the lane's call): every `exports` condition object lists `types` first, and `check:manifests` fails on
  one that does not. Every `types` sat beside its `import`, so what TypeScript resolves did not change.
- 2026-11-14 (the lane's call): no package ships its `CHANGELOG.md`; core's was the only one in `files`, at 1.3 MB.
- 2026-11-14 (the lane's call): geom's optional `earcut` peer is `^3.2.4`, a caret like its `polygon-clipping` peer,
  where an exact pin would flag every later earcut 3 release as a peer conflict. Dependencies stay exact.
- 2026-11-14 (the lane's call): ui, hud and devtools build their declarations from one exclude list that drops
  fixtures, `testing/` and `lab/` directories, since no export reaches them.
- 2026-11-14 (the lane's call): `check:unnameable` gates new public types a package does not export, with today's
  167 allowlisted, rather than exporting or inlining each one in this pass. `typeof` references are not counted.

## Audit round twenty-four (2026-11-14): one concept, one name

- 2026-11-14 (the lane's call): `InertiaConfig` and `DecayLoopConfig` are `InertiaOptions` and `DecayLoopOptions`, though
  the first is the value of an `inertia` option rather than a function's trailing bag: neither is a `Spec`, `Props` or
  `Args`, so the options suffix is the one that applies. Round six's `HandToolInertiaConfig` and
  `ActionDisabledReasonValue`, kept then only because a patch could not drop them, are gone.
- 2026-11-14 (the lane's call): bidi keeps `UNICODE_VERSION`, the name its README gives, and drops `BIDI_UNICODE_VERSION`.
- 2026-11-14 (the lane's call): ui re-exports ui-input's `spanPlace`, `spanShare` and `attract` under their own names
  rather than as `toFraction`, `spanFraction` and `snapToNearest`; ui's `toPercent` and `spanPercent` keep theirs.
- 2026-11-14 (the lane's call): what a keycap draws is a `KeyLegend` everywhere, and `keySpec` is left to the key
  binding's gesture spec. The helpers are `keyLegend…`; ui's `keySpecsFromLegend`, which reads a shortcut
  `formatShortcut` already wrote, is `keyLegendsFromFormatted`.
- 2026-11-14 (the lane's call): `useKeybindings` takes `enabled` (default true), as the dispatcher, snap and
  hover-tracking hooks do. `SceneCanvas`'s `enableKeybindings` prop keeps its name.
- 2026-11-14 (the lane's call): `DebugConfig` is `DebugFlags`, after `parseDebugFlags`, which returns one.
- 2026-11-14 (the lane's call): the curve editor's layer options are `FunctionLayerOptions` and `KeyframeLayerOptions`,
  with no `Create` prefix. Layer options are split about evenly between `Create…LayerOptions` and `…LayerOptions`
  across the kit; this pass left that split alone.
- 2026-11-14 (the lane's call): handle snapping takes `angleStep` and `reachRad` in radians, the names core's measure
  tool and snap sessions use, and `simplifyPath`'s `cornerAngle` is in radians; their demos and lab controls still show
  degrees.
- 2026-11-14 (the lane's call): `make…` factories on testing entries are `create…` (`createGLRecorder`,
  `createUploadTracker`, `createEditAnchorsDepForTests`); `makeBooleanGroup` and `makeHandlesSymmetric` keep their verb.

## Audit round twenty-four (2026-11-14): one pathway per decision

- 2026-11-14 (the lane's call): a list's toggle key is `mod`, Command on Apple platforms and Ctrl elsewhere, as core's
  `useSelection` and every `mod` binding read it. `Tree`, `LayerList`, `PrefsForm` and the pref schema editor had
  toggled on either key (2026-10-11), which made a Mac's Ctrl-click, its secondary click, toggle a row as well as open
  a menu. The alias drag's key (`mod` with Alt) follows it.
- 2026-11-14 (the lane's call): the pref schema editor's preview zoom reads through quantity's `zoom` display, as
  draw's status bar does: a percentage up to 2x and a factor past it, so its 2.25 step shows `2.3x`. It had written a
  percentage throughout (`225%`).

## Audit round twenty-four (2026-11-14): renames and removals

- 2026-11-14 (the lane's call): saved data under a renamed kind is read where it is read, not rewritten on load:
  `pathEffectOf` reads a `blend` effect as `tween`, and `heldPathWarpOf` reads `distort`, `envelope` and `puppet`
  warps as `plane`, `cloth` and `pin`, each through one cached copy per record, so every consumer's load path, a
  history snapshot and a clipboard payload are covered without a scene-format version. The next edit writes the new
  kind. Scene data stays unmigrated until then.
- 2026-11-14 (the lane's call): draw's prefs version 6 carries the renamed path tools' options and the last-used tool
  to their new ids, and Corner shape's `ui.surfaces` entry to `fillets`, rather than letting them start from
  defaults as the Knead changeset allows. The site's renamed lab routes (`lab-envelope` to `lab-cloth-warp` and the
  rest) get no redirects: the site has no redirect mechanism and its labs keep no stored trials.

## Audit round twenty-four (2026-11-14): correctness of the newest code

- 2026-11-14 (merged with the renames lane): a path effect or held warp of a kind this build does not know is read as
  none (paints nothing; ignored as a stale warp) rather than throwing. Kinds renamed in this release (`blend`,
  `distort`, `envelope`, `puppet`) are not unknown: the kit reads them under their new names, so draw keeps no rewrite
  of its own.
- 2026-11-14 (merged with the renames lane): draw's prefs take the renames in a version 5 to 6 step, which also moves
  the Fillet asset's toolbar dock and floating place, rather than growing the unreleased version 4 to 5 step.

## Export contracts (2026-11-14)

- 2026-11-14 (my call): a region export is of the document, so every format draws a parallax layer at its document
  pose and has no camera. A capture of what a view shows is a pixel render with `camera`, which places planes from
  that camera and leaves `scale` as resolution alone. `renderDebugSnapshot` is one; `exportRegions` takes no camera.
- 2026-11-14 (my call): an export reads one revision by restarting, not by snapshotting. A detached copy through
  `toJSON` would have to rebuild the scene's registry, composition and layout configuration, and could not copy class
  instances in `data`, which is what fails in the headless page today. `captureExport` warms, then reads in the same
  task if `getContentVersion` held, else starts again, three attempts in all; a selection change or an override
  restarts nothing. Process-wide registries (painters, paint kinds, fonts) are read as they stand at that read.
- 2026-11-14 (my call): regions can be a function of the document, re-read each attempt, so a page's or a selection's
  bounds and the content drawn in them share the revision. `exportPages` finds its pages by id each time and fails for
  a page the document lost; fixed rects are copied when the export is called.
- 2026-11-14 (my call): exports are best-effort by default and report every loss once to `onDiagnostic`, with nothing
  sent to the console; `strict: true` rejects with `ExportIncompleteError` and writes no file. Only the attempt that
  is read reports, so a picture deleted while the export restarted is not named. SVG's own warnings arrive as
  `unsupported` with subject `svg`, and a PDF's skipped glyphs as `font` with subject `pdf`.

## Audit round twenty-five (2026-11-15): currency and the newest code

- 2026-11-15 (Mike's ruling): a minimap's live fit follows a scrolled container's offset, reading
  `worldPoses(scene, 'shown')`, and refits on a scroll alone; the `'scene'` fit stays on the stored document.
- 2026-11-15 (Mike's ruling): ui's `isOpen`, `isInvalid`, `isLoading`, `isRequired` and `isIndeterminate` props are
  `open`, `invalid`, `loading`, `required` and `indeterminate`, translated at each wrapper's boundary; `isSelected`
  stays. Recorded in `docs/conventions.md`.
- 2026-11-15 (the lane's call): painters and pick ids belong to a document, not an editing session, so a painter one
  session's canvas installs paints in every canvas over that document, and exports draw what the canvas draws.
- 2026-11-15 (the lane's call): a group paints a box from `data.background` and `data.border`, not `data.fill` and
  `data.stroke`, which on a group stay the paint its children inherit and which SVG import fills from every `<g>`.
- 2026-11-15 (the lane's call): a version 1 container no painter claims clips to its box under `clip: 'outline'`; it
  had clipped nothing.
- 2026-11-15 (the lane's call): a `layers`-slot layer with a `hitTest` takes presses, after every registered layer; a
  tool's or contribution's `overlay` still only paints.
- 2026-11-15 (the lane's call): `useEditDraft` compares a value by structure by default, so a rebuilt equal object is
  not a moved value; `Slider` keeps its own comparison so a changed thumb label is not one either.
- 2026-11-15 (the lane's call): a `useActionEdit` slider runs one action per key step, so each arrow press is its own
  undo step, like a nudge.
- 2026-11-15 (the lane's call): a trial scene's Reset applies the fresh scene's selection only when it has one;
  otherwise a selection made outside the scene stays.
- 2026-11-15 (the lane's call): theme-editor's saved history op is `theme-editor:swap`; histories saved under
  `theme-editor:snapshot` are dropped, not migrated.
- 2026-11-15 (the lane's call): a `ReadOnly` scope around one radio disables it, since React Aria has no read-only
  state for a single radio.

## Audit round twenty-six (2026-11-15): the docs as promises

- 2026-11-15 (the lane's call): a `kit:` op kind passed through `useScene({ ops })` or `createScene({ ops })` throws,
  as `scene.registerOp` already did; it had silently replaced the kit's own handler.
- 2026-11-15 (the controller's call): resize constraints get `moveGestureAdapter` over the scene as `ctx.adapter`, and
  insert behaviors get one whenever the canvas has a scene. Both had `undefined` cast to `MoveAdapter`. A scene-less
  insert, where the `insert` dep mints the node, still passes none behind the required type.
- Ruled 2026-11-15: `MoveAdapter.findSnapTarget` is deleted; nothing called it.
- Open: whether a reader may split or join a scoped pref. `packages/prefs/README.md` says never; the `scopes` JSDoc in
  `packages/prefs-schema/src/schema.ts` says an open entry may.
- Ruled 2026-11-15: a new scene starts at version 1, so `getPaintedVersion()`'s `0` means nothing painted yet.

## Audit round twenty-seven (2026-11-15): by failure class

- 2026-11-15 (Mike's ruling): `ResizeAdapter` and `RotateAdapter` are deleted; nothing had read them since 2026-10-13.
- 2026-11-15 (Mike's ruling): `claimed` eligibility filters input: a claimed entry's bindings are live only for input
  whose affordance the entry owns (its own id, or an id in `claimed: [ids]`), decided in one place, `ownsAffordance`
  (`packages/routing/src/contributions/eligibility.ts`).
- 2026-11-15 (the lane's call): a keystroke hits no affordance, so a `claimed` entry never hears one; an entry that wants
  keys declares `always` beside it.
- 2026-11-15 (the lane's call): a render worker's `timeout` of `NaN` or `-Infinity` times out at once, as `setTimeout`
  would; only `Infinity` waits forever (`canvas/renderWorker/requests.ts`). It had waited forever for any non-finite value.
- 2026-11-15 (the lane's call): `decodeSnapshot` refuses a snapshot nested past 1000 levels, and `bindClip` a clip whose
  timelines nest past 1000, rather than overflowing the stack.
- 2026-11-15 (the lane's call): a d3 transition handler passed to `on('end')` twice runs once, as every `createEmitter`
  listener does.
- Ruled 2026-11-15: d3 cancel keys are built by `transitionCancelKey`, on `compositeKey`; the format is no longer documented.
- 2026-11-20 (my call, audit round 45): a d3 transition's second `.tween()` of one name replaces the first, as d3's
  `transition.tween(name, …)` does, rather than throwing; the two had shared a cancel key and left `end()` unsettled.
- 2026-11-20 (my call, audit round 45): a d3 transition's `delay(NaN)` throws a `RangeError` where it is set, as
  `duration(NaN)` does. A delay function answering `NaN` for an item warns and starts that item at once: it is read
  once the transition runs, too late to refuse.
- Ruled 2026-11-15: `record[key]` reaching `Object.prototype` is checked with type information, first as an eslint rule; the same day lint ran out of heap on it, so it runs as `check:proto-index`, one program over shipped source, and its unfixed files sit on a pending list that only shrinks (TODO).
- Ruled 2026-11-15: snapshots keep `Infinity`, `-Infinity`, `NaN` and `-0` as `{ "__num": … }` tags, and the kit's default clipboard writes through the codec.
- Ruled 2026-11-15: a router command is disabled when every selected connector already uses it.
- Ruled 2026-11-15: `diagram.layout` is disabled when the layout would move nothing; `enabled` and `run` share one memoized plan.
- Ruled 2026-11-15 (Claude's pick, delegated): `diagram.addLane` returns `'pass'` on a click off its button, so the press goes to the next binding.
- Open: whether a bar floated again at its own spot rises to the top of the stack (`ToolbarDock/dockDrop.ts`), as now.
- Ruled 2026-11-15: HUD text fields read mod through gestures' `modHeld`, Ctrl only off Apple.


## Audit round twenty-eight (2026-11-15): blind pairs

- 2026-11-15 (the controller's call): a line-mode wheel counts 16 px a line everywhere (`WHEEL_LINE_PX`, `@weasel-js/ui-input`);
  labkit's annotation scrolling had counted 40.
- 2026-11-15 (the lane's call): a draw-style XML group inside a swimlane is dropped with a warning and its shapes stay in
  the swimlane, since the scene refuses a node in both (`drawXml/readPage.ts`, `keptGroups`).
- 2026-11-15 (the lane's call): a requirement or kanban field name of several words is written with underscores, with a
  warning (`common/text.ts`, `fieldName`).
- 2026-11-15 (the lane's call): a Mermaid gantt task id that reads as a tag word is renamed (`done` to `done_1`) with its
  `after`/`until` references, with a warning.
- 2026-11-15 (the lane's call): a DOT cluster inside a colored one writes `color=""` and `fontcolor=""`, and the reader takes
  `""` as unset. That Graphviz reads `""` as its default is unverified.
- 2026-11-15 (the lane's call): a mode-barred action is refused by `ActionsRegistry.trigger`, context menus, the command
  palette and `ActionBar`, through a `ruleCtx` dep and `eligibleNow`; only the dispatcher had checked `eligible`.
- 2026-11-15 (the lane's call): a moved modifier role's new keys start a drag only on bindings that already allowed its
  declared keys, so which binding wins a modified drag does not change.
- 2026-11-15 (the lane's call): a built `PolygonPath` is never written in place, so its hit-test and length caches stay
  keyed by identity; `PathBuilder`'s doc no longer invites in-place writes.
- 2026-11-15 (the lane's call): `sequenceSpecs` refuses sequence data whose part ids would collide (`A` beside `A/text`).
- Ruled 2026-11-15: `Transport` takes `timeReadout` (`'absolute'`, the default, or `'elapsed'`) and `formatTime`.
- Open: whether an octant-spline badge's end-anchor weights do anything now that its ends are flat, which decides whether
  ui-lab's spline editor keeps a weight control there (`Badge/bases/OctantSpline.tsx`).
- Open: whether an interior octant-spline weight other than 1 may kink the curve, against the doc's "C² across the whole octant".
- Ruled 2026-11-15: `checkPipeline` reports a `cluster-loop` problem (then `group-loop`) once per loop.
- Open: whether `createDeleteAction({ commit })` keeps its old gate for a page-only selection, now that it is disabled there.


## Audit round twenty-nine (2026-11-16): core and its state

- Ruled 2026-11-16: `addPage` throws on a page id the scene already has, and `setPages` and `createPageRun`
  on a page id given twice, rather than minting a fresh id with `nextPageId`.
- Ruled 2026-11-16: `registerOp` refuses a kind starting `revert:`, as it refuses `kit:`, rather than
  renaming the inverse ops a saved history holds.

## Audit round twenty-nine (2026-11-16): labs

- 2026-11-16 (the lane's call): a trial's Copy settings as JSON copies an auto field at its resolver's value, not the
  value the instrument last reported, and marks nothing as auto, so pasting the copy back pins it
  (`chrome/trialActions.tsx`, `settingsJson`). An endless number is written `"Infinity"`, which config repair reads
  back; a cleared value is written `null`, which a config seed reads as the field's default, not as cleared.
- 2026-11-16 (the lane's call): a key binding declaring `inFields` hears a Ctrl or Cmd chord typed in a text field;
  no other key typed there reaches the dispatcher, and keymaps never see one (`channels/keyboard.ts`). labkit's Mod+S
  snapshot declares it, so it saves from a field as it did before it moved onto the lab's dispatcher; Undo and Redo
  stay the field's.
- 2026-11-16 (the lane's call): a job without `auto` re-runs on a `key` change once something has started it and
  until something cancels it, finished runs included; one never started stays idle (`job/useJob.ts`). It had ignored
  `key` entirely, folding a run for the old key into state for the new one.
- Ruled 2026-11-16: forge reads a Storybook number control whose bounds are not both finite and in order
  (`max: Infinity`, a NaN, `min` above `max`) as having none, keeping its slider or field, rather than letting
  labkit's `range()` throw and fault every story in the file (`csf/argsToSchema.ts`, `boundsOf`). It warns, naming the control.
  A lone finite `min` or `max` is kept, as Storybook keeps it (2026-11-20).

## Audit round thirty (2026-11-16): diagrams

- 2026-11-16 (my call): a rewrite the engine makes on its own — `applyDiagramTheme`, a face landing
  (`remeasureText`), and the body relayout and sequence redraw both run — leaves a locked node as it stands, as
  layout and the route writers already do. A locked shape keeps its old theme colors and size; a sequence with
  any locked part is not drawn again. The alternative, writing through `scene.unlocked`, would treat a theme
  as part of the document rather than an edit of the node.
- Ruled 2026-11-16: a Mermaid flowchart node's `@{ … }` metadata that is not `key: value` pairs throws, naming
  the line, as a kanban card's does; the flowchart had read `shape` alone as a key with an empty value.
- Ruled 2026-11-16: the Diagram JSON reader refuses a file whose theme object does not check (`diagramThemeErrors`),
  rather than taking it as is and failing later in `diagramThemeFrom`.

## Audit round thirty (2026-11-16): the component kit

- 2026-11-16 (the fixer's call): `QuantityText` passes even an explicit `locale` through `fieldLocale`, as every
  number field does, so a locale whose numbers do not read back is drawn with Latin digits or in `en-US`.
- 2026-11-16 (the fixer's call): `liveSelection` keeps its second argument, now unread, rather than drop it in a
  breaking change.
- Open: how Escape puts back a mixed segment after a sweep crossed it (`SegmentedBar` `sweep` with `mixedValues`,
  SelectionPanel's flag bar). A list `onChange` cannot say "mixed", so the bar would need a sweep lifecycle (begin,
  commit, cancel) and the panel a way to drop its drafts (`leafWrites`' `restore`); today the sweep's steps commit, and
  Escape writes the mixed flag off on every node.
- Open: whether `CharacterOptions` draws No fill as mixed over a `MIXED` fill. `RangeStyle` cannot say whether the runs
  disagree on having a fill or only on its color, and a test asserts it stays unlit.
- Open: `check:imports` skips type-only imports, so a package whose `.d.ts` names an undeclared sibling passes it.
  Counting them flags core's `math` entry re-exporting `@weasel-js/simulation` types (core does not declare it, and
  declaring it would put simulation in base's closure) and forge's `vite/ast.ts` (`@babel/types`, a dev dependency).

## Audit round thirty-two (2026-11-16): animator

- 2026-11-16 (the fixer's call): a `loop`, `tweenLoop` or `stagger` whose factory throws as one of its animations
  starts is canceled, with every animation it has started, and the throw goes on: to the caller for an animation that
  starts at once, and to the frame (which logs it) for a later one. The stagger's other items do not start, and no
  `onDone` comes. Counting the thrown item as done and starting the rest was the alternative.
- 2026-11-16 (the fixer's call): an `axes` name that is both one axis's name and the start of other axes' paths, as
  `arm.x` is on a skeleton with joints `arm` and `arm.x`, throws rather than answering both. A name on axes without
  `paths` keeps reading every dot as a step.

## Audit round thirty-three (2026-11-17): animator engine

- 2026-11-17 (the fixer's call): a hold's `value` or `weight`, or a target tween's `easing`, `interpolate` or
  `interpolator`, that throws as a frame or a `touch` reads it retires its animation (a timeline, for a track's hold)
  at the next frame, logged and with an `error` event, as a throwing `onTick` is; the hold weighs nothing from its
  first throw. A `touch` between frames no longer throws the error to its caller. A throw only at the call that
  starts it still goes to that caller.
- 2026-11-17 (the fixer's call): an animation whose cancel throws (its target's setter, as it commits what it showed)
  still leaves the table, with its completion and its `cancel` event, and `cancelAll` and a `cancelKey` interrupt go on
  to the rest; the first throw then goes on to whoever canceled. Retiring one whose own tick threw logs a second throw.
## Audit round thirty-three (2026-11-17): the chart app

- 2026-11-17 (my call): chart's File › Export keeps a whole-document format such as draw-style XML off while any page
  holds a kind it cannot write, rather than offering an export its writer would finish by leaving that page out with
  a warning. A one-page format such as DOT asks only about the page in view, which is all it writes.
## Audit round thirty-three (2026-11-17): the devtools extension

- 2026-11-17 (the fixer's call): `watchHookPresence` throws a `RangeError` on an empty `delays`, which used to probe
  in a tight loop forever. Falling back to the default delays was the alternative.
## Audit round thirty-four (2026-11-17): draw's recording and SVG files

- 2026-11-17 (the fixer's call): draw's Play recording, pressed while a recording replays, stops it (the action shows
  active while one plays); detaching the canvas stops it too. Play stayed disabled through a replay before, with
  nothing to stop one. A Record press during a replay still does nothing.
## Audit round thirty-four (2026-11-17): the forge app

- 2026-11-17 (the fixer's call): forge's Counter story is back, as `packages/forge/src/story/Counter.stories.tsx`
  (`forge-counter--counter`), so `apps/forge/e2e/smoke.mjs` has the story with a string control and kept state it is
  written around. It had been removed from `apps/forge/stories` on 2026-09-25 (`c1705be650`), leaving the smoke check
  unable to pass. Deleting the smoke check was the alternative.

## Audit round thirty-five (2026-11-17): draw's surfaces

- 2026-11-17 (the fixer's call): a command-row asset shown as a panel (Simplify and Offset, Fillet, Undo, and the
  rest of the row) has no hide button, since the View menu lists none of the command row and only Preferences
  could bring it back. Hiding one stays in Preferences. Listing the command row's assets in the View menu was the
  alternative.
## Audit round thirty-five (2026-11-17): the site's package pages

- 2026-11-17 (the fixer's call): two guide files of one package that give the same address (`1-setup.md` and
  `setup.md`) fail the site's build, naming both, rather than one shadowing the other's body. Keeping the first
  file and warning was the alternative.
- 2026-11-17 (the fixer's call): the API reference build fails on an export whose page would have the address of one
  of its package's entries (a root export `booleans` beside the entry `@weasel-js/geom/booleans`), since that
  address opens the entry's index and the export's page could never be reached. Giving such a page an escaped
  address was the alternative.

## Audit round thirty-six (2026-11-18): the platformer demo

- 2026-11-18 (the fixer's call): the platformer's spikes cost a life, as an enemy hit, a bonk and a fall do; they
  already played the whole hurt sequence and granted invulnerability, but took nothing. Taking the hurt
  sequence off spikes, so they are only a bounce, was the alternative.
- 2026-11-18 (the fixer's call): the platformer's `parseLevel` throws on a level with no `S` or no `G` unless passed
  `{ markers: 'optional' }`, which the geometry-only test fixtures use, and throws on a second `S` or `G` either way,
  naming both. Defaulting a missing marker to (0, 0), as before, was the alternative.
## Audit round thirty-six (2026-11-18): the theme editor's brand-colour generator

- 2026-11-18 (the fixer's call): `gen-brand-colors` throws, writing neither table, on a Copic marker with no name
  or a sampled colour that is not `#rrggbb`, and on a LEGO name holding a named HTML reference other than `&amp;`,
  `&lt;`, `&gt;`, `&quot;`, `&apos;` and `&nbsp;`. Skipping the row with a warning was the alternative.

## Audit round thirty-seven (2026-11-18): the audio graph

- 2026-11-18 (the fixer's call): an audio graph's `fadeMs` below 0 throws `RangeError` at construction, as a
  non-finite one does; clamping it to 0 was the alternative.
- 2026-11-18 (the fixer's call): a graph source whose `start` throws is left stopped and still in the graph. `start()`
  starts the rest and rethrows the first error, an `add` or `replace` while playing keeps the new def and rethrows,
  and `apply` treats it as it treats a throwing `set`: the rest apply, then the first error is rethrown. Removing the
  node again on a failed `add` was the alternative.
- 2026-11-18 (the fixer's call): an audio graph's `add` and `replace` throw on a def the graph still holds — any
  node's live def, one a `replace` is fading out, or a removed node's still fading — and `apply` refuses one before
  changing anything. `replace` with the node's own def, to retrigger its crossfade, is refused too; skipping it as a
  no-op was the alternative.
## Audit round thirty-seven (2026-11-18): brush

- 2026-11-18 (the fixer's call): `shareBrushSize` throws on an empty key, and on a size leaf with a `measure` or a
  `unit` other than plain `px` under `BRUSH_SIZE_PX`; a size in world units passes a key of its own, which is the
  override. A leaf naming neither a unit nor a measure passes, since it says nothing. Warning and sharing anyway
  was the alternative.
## Audit round thirty-seven (2026-11-18): clock

- 2026-11-18 (the fixer's call): a clock declared `start: 'end'` whose run is made endless at runtime (a loop toggle,
  `duration = Infinity`, an override) resets to the end of its declared run, standing at that pass's end, and
  `declare` throws a `RangeError` on a declaration whose run never ends for such a clock, keeping the last one.
  Resetting to 0 there, or letting `declare` through and throwing at Reset as before, were the alternatives.
## Audit round thirty-seven (2026-11-18): core's animation

- 2026-11-18 (the fixer's call): an `animateLifecycle` insert or removal whose tween cannot run (no pose target and a
  geometry with no `lerp`) throws as `tweenPose` does, leaving the inserted node at its own pose and the node to be
  removed in place and removable again. Falling back to an instant insert or removal without throwing was the
  alternative.
- 2026-11-18 (the fixer's call): `animateOnSetPose` and `animateLifecycle` take round nineteen's reduced-motion call: with
  no `ms`, they take no time under `prefers-reduced-motion`. A `spring` option, which the caller names, still springs.
- 2026-11-18 (the fixer's call): a `momentum` flick on pose targets that the animator cancels from outside (`cancelAll`,
  an unmount) is recorded where it stopped, as one undo step, since each canceled decay has already written that pose
  to the document. Putting the document back where the drag began was the alternative. Round six's line on the
  `previewPoses` path, which records nothing, stands.
## Parser fuzzing (2026-11-18)

- 2026-11-18 (the fixer's call): a weasel clipboard paste with any malformed item (not a node, a duplicate id, a layer
  the scene lacks, a pose with no finite bounds, a parent loop) pastes nothing, with a debug warning. Pasting the
  well-formed items and reporting the rest through `onOmit` was the alternative; it needs a new `PasteOmission` reason.
- 2026-11-18 (the fixer's call): `History.restore` refuses a snapshot of the wrong shape whole, throwing
  `HistoryRestoreError` when strict and warning with `restored: false` when best-effort, as `Scene.restoreHistory`
  already did for a snapshot of the wrong form. Dropping only the malformed entries under best-effort was the
  alternative.
- 2026-11-18 (the fixer's call): a tagged typed array whose data holds an object decodes that entry as `NaN`. Refusing
  the whole snapshot with `SnapshotShapeError` was the alternative.
- 2026-11-18 (the fixer's call): `resolveUnitExpr` refuses an expression nesting parentheses or signs past 1000 levels
  with its own `unitExpr:` error.

## Audit round forty (2026-11-19): SceneCanvas, part one

- 2026-11-19 (the fixer's call): two presets installing one shape painter at different priorities throw, naming
  both, as two presets giving one routing name or insert kind different values do; the same painter at one priority
  still counts once. The first preset's priority used to win silently, which a test pinned. Letting the refining
  preset's priority win was the alternative.
- 2026-11-19 (the fixer's call): two unrelated presets giving one chrome id different `chromeRules` throw, and a
  preset's own tool and another's built tool of one id are weighed together, a refiner winning and two unrelated
  presets throwing. Before, the last preset's chrome rule won and the own tool always won. Keeping either silent
  winner was the alternative.
- 2026-11-19 (the fixer's call): `<SceneCanvas>` no longer takes `gestureSource`, `previewPoseExtra` or
  `boundsOfPose`; a passed one replaced the dispatcher-backed one. Composing a consumer's value with the canvas's
  own was the alternative.

## Audit round thirty-nine (2026-11-19): SceneCanvas, part two

- 2026-11-19 (the fixer's call): a `<SceneCanvas scene>` that changes from a live `Scene` to serialized JSON keeps
  the last live scene and warns once, as a later change to a serialized `scene` is ignored. Baking the new JSON on
  that change was the alternative.
## Audit round thirty-eight (2026-11-18): core's animation

- 2026-11-18 (the fixer's call): `rigFromNode` and `useRigNode` leave out a joint the rig node's skeleton lacks, one
  renamed or removed while nodes under it still name it: a node bound to it is not bound, and a skin weighing it bends
  by its other joints. `useRigNode` warns, naming each such node and joint, once per change in that list. `bindRig`,
  whose caller passes the bindings, still throws on one. Throwing from `useRigNode`'s render, as before, was the
  alternative.
- 2026-11-18 (the fixer's call): `momentum()` throws a `RangeError` on a `friction` outside (0, 1). 1 threw at release
  over a scene adapter and coasted forever over any other; refusing it when the behavior is made gives one answer for
  both. Allowing 1 over an adapter without pose targets, stopped only by `bounds`, was the alternative.

## Audit round forty (2026-11-19): the render worker

- 2026-11-19 (the fixer's call): a render worker serving several ports (`hostSceneRender` once per port) asks each
  host's page in turn, oldest first, for an SVG or `bitmapSrc` image, until one answers with a bitmap; the image cache
  is the worker realm's, so a load cannot tell which host's scene wanted it. `hostSceneRender` and `serveSceneRender`
  return a function that stops the host. Refusing a second live host in one realm was the alternative.
## Audit round forty (2026-11-19): core's state

- 2026-11-19 (the fixer's call): `usePointerStylus(ref)` listens to nothing while `ref.current` is empty, and moves to
  each element the ref holds after a commit. Falling back to `window` for an empty ref, as before, was the alternative;
  it reported pointers from the whole page as the element's. No target, or `null` passed directly, still means `window`.
- 2026-11-19 (the fixer's call): a `layerOrder` naming a layer more than once draws it once, at its first place, and
  warns in development. Drawing it at each place it is named, as before, was the alternative.
- 2026-11-19 (the fixer's call): `stableStringify` writes an object of the caller's own with a `$type` key as
  `{"$type":"object","value":…}`, so `{ $type: 'bigint', value: '10' }` and `10n` no longer give one string. Leaving
  such an object as JSON writes it, and the two colliding, was the alternative.
## Audit round forty-one (2026-11-19): core's geometry

- 2026-11-19 (the fixer's call): `AUTO_POSE_DESCRIPTOR.lerp` throws for a Path pose and a rect pose, as
  `pathPoseDescriptor.lerp` already does for a rect Path and a polygon. Snapping to the nearer end was the alternative.

## Audit round forty-one (2026-11-19): pages

- 2026-11-19 (the fixer's call): `createPageRun` throws on a scene that already has a page run. A second run's pages
  drew and clipped, but `pageRunOf` finds only the first, so every page reader and edit missed them. Handing the call
  to `setPages` on the existing run was the alternative.
## Audit round forty-one (2026-11-19): core's scene

- 2026-11-19 (the fixer's call): a tween draws at most 4096 steps (`MAX_TWEEN_STEPS`), and warns in development when its
  `steps` or `distance` asks for more; a `steps` of `NaN` draws none. Drawing every step asked for, which ran out of
  memory or never returned on a tiny `distance` or an infinite `steps`, was the alternative.

## Audit round forty-one (2026-11-19): core's viewport

- 2026-11-19 (the fixer's call): `fitZoom`, `fitSize` and `useFitOnce` clamp the fit to the kit-wide zoom range
  (`DEFAULT_MIN_ZOOM`, `DEFAULT_MAX_ZOOM`) unless given a `clamp`, as `fitViewToBounds` and every other zoom path do;
  before, they were unbounded, and the first wheel or pinch snapped a fit past 8x back to 8x. A caller wanting the raw
  ratio passes `{ min: 0, max: Infinity }`. Leaving them unbounded as plain arithmetic was the alternative.
- 2026-11-19 (the fixer's call): `useDecayLoop`'s `start` and a `viewport.dragPan` binding's `inertia` throw a
  `RangeError` on a `friction` outside (0, 1) or a `minSpeed` that is not positive, as `momentum()` does (round
  thirty-eight); the pan checks at the press, so a bad option never throws from a release. Each coasted forever. Letting
  friction 1 through when `bounds` with `'stop'` or `'spring'` would end the coast was the alternative.

## Audit round forty-one (2026-11-19): the scene's history and tree

- 2026-11-19 (the fixer's call): `scene.loadState` throws while a journal is open, a suspended one opened on
  `scene.history` included; commit or cancel it first. Closing every open journal along with the history was the
  alternative; it would end a modality or an edit session from under its owner.

## Audit round forty-two (2026-11-19): core's domains

- 2026-11-19 (the fixer's call): a `PageRequest` names an end as `{ end: 'first' | 'last' }`, and `present.step`'s
  Home and End variants send that. A `{ to }` of `'first'` or `'last'` names the page with that id where one has it,
  and the end only where none does, so `present.go` reaches every page by its id and old callers keep working.
  Keeping the ends ahead of the ids, so such a page was unreachable by id, was the alternative; so was dropping
  `to: 'first' | 'last'` outright.

## Audit round forty-six (2026-11-20): diagram formats

- 2026-11-20 (the fixer's call): the Diagram JSON reader refuses a page with no string `id`, a `width` or `height` that
  is not a finite size of at least 0, or no `data` object, and a graph page whose data has no `nodes` and `edges`
  lists, a node, cluster, or container with no string `id`, or an edge with no string `from` and `to` (round 70), as it
  refuses a theme that does not check. Taking such a page and failing at draw time was the alternative.
- 2026-11-20 (the fixer's call): `writtenPage`, and so every one-page writer (DOT, Mermaid), throws a `RangeError` when
  `WriteOptions.page` names a page the document does not have, and `scenePageKinds` does the same for an `opts.page`
  its scene has no page for. Both had fallen back to the first page, so a stale id exported another page as if it
  were the one asked for. An unset `page` still means the first.
## Audit round forty-six (2026-11-20): draw-style XML

- 2026-11-20 (the fixer's call): a draw-style XML edge whose style names no `endArrow` or `startArrow` reads that end as
  unset, the diagram's own marker, as an unnamed color reads as the theme's; a named `classic` reads as `arrow-concave`.
  Reading the draw app's own default, `classic`, onto every such edge as an explicit `arrow-concave` was the alternative
  (`drawXml/readStyle.ts`, `markerAt`).
## Audit round forty-six (2026-11-20): diagram containers

- 2026-11-20 (the fixer's call): `diagramCanDropInto` refuses a lane moving into a pool that stacks along the other
  axis — a lane whose header side is not the pool's — so a lane dragged from a pool of columns into a pool of rows
  stays where it was. Letting it in and rewriting its header and layout key for the new axis was the alternative.
## Audit round forty-six (2026-11-20): the effect editor and live audio

- 2026-11-20 (the fixer's call): a live audio wire into a port its node lacks is cut from the graph alone, with
  `no input port "…"` on the stage it enters; the stage still plays from its other wires. Leaving the whole stage out,
  as a stage whose node fails to build is, was the alternative.
- 2026-11-20 (the fixer's call): an audio stage missing a discrete setting (`wave`, `color`, `type`, `seconds`) plays
  with its stage type's default from `AUDIO_STAGE_TYPES`, where a noise stage without `color` used to fail. Failing the
  stage with "no color" was the alternative.
## Audit round forty-six (2026-11-20): diagram's outlines

- 2026-11-20 (the fixer's call): `roundRectOutline` throws a `RangeError` on a negative or `NaN` radius, and takes
  `Infinity` as "a sixth of the shorter side always". Clamping a negative radius to 0 was the alternative.
- 2026-11-20 (the fixer's call): `outlineFromD` throws on path data or `detail` that does not parse or draws nothing,
  and a `RangeError` on a `content` with no area or a non-finite side, matching what a mark's `d` does. Building an
  outline that paints nothing, with a warning, was the alternative.
## Audit round forty-six (2026-11-20): diagram sequences

- 2026-11-20 (the fixer's call): a sequence whose root or any part is locked takes no edit. `placedSequences` leaves
  it out, so it offers no regions and the authoring clicks pass over it, and `commitSequence` returns without
  writing (`sequenceLocked`, `sequence/layer.ts`), as `redrawSequences` already did. Every edit builds all of a
  root's parts again, so one locked part holds the whole sequence. Throwing from `commitSequence`, or rebuilding
  through `scene.unlocked` around the locked part, were the alternatives.
- 2026-11-20 (the fixer's call): `insertMessage` and `setMessageArrow` throw on an arrow name `SEQ_ARROWS` does not
  hold as its own key (`'toString'`, a typo), naming it; the Message tool's `arrow` param, which can come from stored
  options, still falls back to a call. Falling back to a call in both, as the tool does, was the alternative.
## Audit round forty-six (2026-11-20): effect pipelines

- 2026-11-20 (the fixer's call): `runPipeline` and the effect runner hand a `many` input to its evaluator as an
  array of every reached wire's value, in the pipeline's wire order, and a bypassed stage passes the first of them
  on. Before, the evaluator got the first wire's value alone. Summing like the audio runner was the alternative; the
  image runner can't know how a value type combines, so the evaluator does.
- 2026-11-20 (the fixer's call): a stage or port id starting with `~` is reserved for the ids the looks make (the lanes
  look's lane nodes, the rack look's skip and tap ports). `checkPipeline` reports one as `reserved-id`, and `rack` and
  `lanes` throw naming it; before, lanes threw from `diagramScene` on a shared id and rack misread such a port. Giving the
  looks' ids a prefix no pipeline uses, found per pipeline, was the alternative; `laneTypeOf` reads a lane id on its own.
## Audit round forty-six (2026-11-20): diagrams, part one

- 2026-11-20 (the fixer's call): the connect action's default commit cannot draw with custom `routers` or a
  `frame`, since `EDGE_DERIVE_PATH` is the one registered function and a fresh one would not survive `toJSON`. It
  takes `edgeDerivePath` for the host's own registered one, and development warns once per action id when
  `routers` or `frame` is set with neither `edgeDerivePath` nor `commit`. Throwing was the stricter alternative;
  building and registering a derive path per `routers` table inside the action was the other.
- 2026-11-20 (the fixer's call): `DiagramView`'s connect previews with `'bezier'` when `portOptions.router` is unset,
  the router `diagramScene` draws an edge naming none with, and reports no `router`; set, it previews with it and
  `onConnect`'s edge names it. A host whose `diagramScene` call sets its own `router` sets `portOptions.router` to
  match. Always reporting the preview's router was the alternative, which would pin `'straight'` on every new edge.
- 2026-11-20 (the fixer's call): `useDiagramTools` keeps a tool for every shipped stencil, containers included, and
  `useStencilInsert` warns once per id in development when an insert names a `stencil:` kind it was not handed,
  then hands it to the insert dep it displaced as before. Dropping the container tools from the default list, or
  having `useStencilInsert` fall back to every shipped stencil, were the alternatives.
## Audit round forty-five (2026-11-20): devtools

- 2026-11-20 (the fixer's call): `DevtoolsPanel` throws a `RangeError` on a `tabs` list naming no tab (`[]`, or only
  ids it has no tab for). Showing every tab, as with `tabs` left out, was the alternative.
## Audit round forty-five (2026-11-19): diagram-elk

- 2026-11-19 (the fixer's call): `elkPlan` rejects a `Graph` naming two of its participants and clusters by one id,
  since an edge names its ends by id and could join either. Giving nodes and clusters separate id maps and resolving an
  edge's end to the node first was the alternative; `buildGraph` never produces such a graph, as scene ids are unique.
## Audit round forty-seven (2026-11-20): diagram themes

- 2026-11-20 (the fixer's call): `setDiagramStyle`, `setDiagramColor` and `setDiagramFontSize` leave a locked shape or
  connector, and locked text of an unlocked one, as `applyDiagramTheme` does, and edit the rest. They had thrown from
  `scene.update` partway through. Throwing up front on any locked id was the alternative.
- 2026-11-20 (the fixer's call): `setThemeValue` throws a `RangeError` on a path through a role, a lane body or a series
  color the theme lacks, past appending one color at the end of `series`; `addThemeRole` is how a role is made. It had
  made a role holding one field, or a sparse array, which painted `undefined` and failed `diagramThemeErrors`. Filling
  a missing role from the default role, as `addThemeRole` does, was the alternative.
## Audit round forty-seven (2026-11-20): editing's insert actions

- 2026-11-20 (the fixer's call): an insert's container is picked at one site, `InsertEnds.site`: the press, carried
  with the shape when Space moves it mid-draw, and a click-place's raw click, not its snapped center. The snap's scope
  and the preview's copies follow the same container. Picking it at the snapped start, as the dep did, was the
  alternative.
- 2026-11-20 (the fixer's call): a click-place builds its extras as a drag out from the click's center to the size's
  corner does, so a polygon's first vertex points at that corner unless the binding names a `rotation`, and a custom
  kind's extras carry `originMode: 'center'`. Inscribing a radial shape in the box unturned was the alternative.
## Audit round forty-seven (2026-11-20): font outlines

- 2026-11-20 (the fixer's call): the default outline parser rejects a variable font (one with `fvar`) asked for by a
  PostScript name other than its nameID 6, the default instance's, since it draws only default outlines; a local
  variable font's other named instances keep their text on the SDF tier. Applying the instance's `fvar` coordinates
  was the alternative, and needs `gvar`/`CFF2` support opentype.js does not have.
- 2026-11-20 (the fixer's call): GPOS pair kerning applies one LangSys's `kern` lookups per pair, trying `latn`'s,
  then `DFLT`'s, then the rest in ScriptList order, and taking the first whose lookups cover the pair. Layout knows
  no run's script, so picking one script for every pair was the alternative, and loses kerning other scripts' lookups
  alone carry.
## Audit round forty-nine (2026-11-20): geom booleans

- 2026-11-20 (the fixer's call): `pathFaceArrangement` throws a `RangeError` for a `flattenTolerance` that is not a
  positive finite number. Clamping it to some floor, or reading it as the default, was the alternative.
## Audit round forty-nine (2026-11-20): geometry, part two

- 2026-11-20 (the fixer's call): geom's `stepLine` throws a `RangeError` for a `step` that is zero or not finite, and so
  does a gesture whose `constrain: { step }` holds one; it had answered a line of `NaN` direction, which froze the drag
  at the press. Reading such a step as no rounding, the raw direction, was the alternative.

## Audit round forty-nine (2026-11-20): fill tessellation

- 2026-11-20 (the fixer's call): a nonzero fill whose resolved boundary would not close into loops draws its
  unresolved outline, as an even-odd one keeps the stencil, rather than drawing the loops that did close and dropping
  the rest. No outline is known to reach it since boundary pieces are judged on a ray, not at an offset point.
- 2026-11-20 (the fixer's call): resolving a nonzero fill's crossings has no work cap. The even-odd cap falls back to
  the parity stencil, and the renderer has no nonzero stencil to fall back to, so a cap would draw a wrong fill rather
  than a slow one. A nonzero stencil pass (increment front faces, decrement back) is what would let it have one.
## Audit round forty-nine (2026-11-20): guides' layouts

- 2026-11-20 (the fixer's call): `tileGrid` rounds `cols` and `rows` down, and a grid with either under one, or not
  finite, has no cells: it moves no child, offers no drop and refuses every arrival, under any `overflow`. This is
  `gridSlots`' rule, except that `rows` is required here and so has no default to fall back to. Before, zero wrote
  `NaN` poses and a fraction laid cells past the container.
- 2026-11-20 (the fixer's call): `tileGrid`'s resting arrangement keeps each child in the cell it sits in, so a drop on
  an empty cell, from inside or out, stays there through later edits to its siblings; only a departure closes the
  gaps, as before. A child off the grid, past its cells, or in a cell an earlier one holds takes the first free cell.
  Compacting every rearrangement, and so offering a drop only the cells at the end of the run, was the alternative.
  editing's drag-out preview now runs the source's `depart`, as its commit does, rather than `childPoses`. A resize
  still reads each child's cell from its pose at the new pitch, so a child in a gap can change cell when the grid is
  resized.
- 2026-11-20 (the fixer's call): `quadtree` rounds `maxDepth` down and holds it to 0–7, so a 128 × 128 grid at its
  finest, the order of `snapPoint`'s 129 × 129 cap; `NaN` is the default 4. Past 31 the cell arithmetic overflowed and
  its scan never ended, and at 8 a container of point-sized children took seconds per edit.
## Audit round forty-nine (2026-11-20): history

- 2026-11-20 (the fixer's call): `Journal.suspend()` throws while a journal opened inside it is active; suspend that
  one first. Suspending the inner journals along with it was the alternative; `resumeJournal` would then have had to
  bring them back too.
- 2026-11-20 (the fixer's call): a raw `History`'s `apply`, `applyOps`, `recordEntry` and `restore` throw while a
  journal is active, as `undo`, `redo` and `goto` do; a suspended journal still lets them through. `clear`, `prune`,
  `dropRedo` and `switchBranch` still run, since none leaves an entry describing a state the document is not in.
- Open: edits interleaved between suspended sibling journals (one edits, a second opens and edits, the first resumes
  and edits again) cannot be taken back exactly by the enclosing journal's `cancel`, which unwinds one journal at a
  time, latest edit first. Doing it exactly needs one log of edits across the siblings.

## Audit round forty-nine (2026-11-20): hud

- 2026-11-20 (the fixer's call): `attachHud` throws, attaching nothing, when its `font` pair (or the bundled atlas)
  differs from the URLs another HUD registered `weasel-hud-default` with, since every HUD on a page shares that one
  family. A host wanting another atlas registers it under a family of its own and passes the name. Swapping the
  family to the newest pair with `replace`, under every HUD already drawing it, was the alternative.

## Audit round fifty-three (2026-11-20): minimap

- 2026-11-20 (the fixer's call): `<MinimapCanvas>`'s `rootView` reads back the last view it wrote until the minimap
  next commits, so zoom samples landing before the host re-renders compound rather than overwrite each other. A host
  that drops a write without re-rendering has the next sample in the same frame start from the dropped view; the
  minimap's next render hands the camera back to the `mainView` prop. Holding the write until the prop itself changes
  was the alternative, which would keep a dropped write forever.
## Audit round fifty-three (2026-11-20): modes

- 2026-11-20 (the fixer's call): the shipped `ModeDefinition`s and `DEFAULT_MODES` are deeply frozen, so
  `NORMAL.allows.push(…)` throws; an app copies a preset to change it. `createModeRegistry` still neither
  copies nor freezes an app's own definitions, so mutating one after registering it leaves
  `createActiveModeReader` serving the old tags until the next `setMode`. Copying them on registration was
  the alternative, at the cost of `byId` no longer returning the object passed in.
## Audit round fifty-three (2026-11-20): path-tools.pathEdit

- 2026-11-20 (the fixer's call): `setAnchorField` asked `enabled` with params answers as its `run` would, so an
  entry that would change nothing is `NotApplicable`; asked with no params, as a listing asks, it answers for the
  anchor selection alone, since what a field would write only arrives with the entry.
## Audit round fifty-three (2026-11-20): pdf

- 2026-11-20 (the fixer's call): once a PDF face has given out every two-byte code, a glyph's further reading (other
  text, or another width) gets no code, so `writePdf` draws that glyph as an outline rather than as text. Reusing the
  glyph's first code, as before, copied out the wrong text and moved the pen by the wrong width.
## Audit round fifty-three (2026-11-20): plot

- 2026-11-20 (the fixer's call): `setGitCommandField` throws on a branch name another branch holds, the main branch
  included, and on a commit or merge id another command gives a commit, as `setGitMainBranch` and `setGanttTaskId`
  already do. Accepting either leaves a graph whose replay stops there. A gantt date is written held to the years its
  `dateFormat` reads back (`YYYY` 0 to 9999, `YY` 1969 to 2068, a format with no year 1970), so a drag past them
  stops at the edge rather than throwing.
## Audit round fifty-three (2026-11-20): plot

- 2026-11-20 (the fixer's call): `insertPacketField` throws on a field starting inside the field before it, as
  `setPacketStart` does, so the fields never overlap. Moving the new field along to the first free bit was the
  alternative.
- 2026-11-20 (the fixer's call): an xychart row edit leaves a series shorter than the rows short: a row past its end
  stays missing, and one that a move or a `setXyValue` puts inside it is `NaN`, drawn as no point. An inserted row is
  a zero in each series that reaches it. Padding every series with zeros to the row count first, which drew the
  missing rows as zeros, was what it did.
## Audit round fifty-three (2026-11-20): prefs

- 2026-11-20 (the fixer's call): an enum that can be auto is refused as a selector (`checkPrefScopes` code `auto`)
  unless its `auto.value` is one of its options, since while auto it otherwise reads `undefined` and every split
  leaf would read and write under no option, as a clearable enum would. Reading such a selector's auto as its
  `default` was the alternative.
## Audit round fifty-one (2026-11-20): labkit primitives

- 2026-11-20 (the fixer's call): `<Split width>` is controlled, as a React input's `value` is. A drag reports
  through `onWidthChange` and the sidebar then goes back to whatever `width` the parent renders: the dragged width
  if it adopted it, its own clamp if it clamped, the old width if it kept it. A parent that adopts the width
  asynchronously (after a debounce, say) sees the seam snap back until it does. Treating `width` as a starting
  point the seam may leave, as it did before, was the alternative; `defaultWidth` with no `width` still does that.
## Audit round fifty-one (2026-11-20): labkit's state

- 2026-11-20 (the fixer's call): a lab whose fold of old storage cannot confirm its records stops persisting for
  the session, keeping the old storage for the next open to fold again. Leaving `meta` out of the cache's seed, so
  the session's first write put it down, was the alternative; a fold record that never landed would then have been
  lost behind that `meta`.
- 2026-11-20 (the fixer's call): `<SingletonExperimentProvider>` keeps the trial id it mounted with and warns in
  development when `id` changes, as it does for `storageKey` and `storage`. Following the new id, opening a second
  synthetic trial, was the alternative. `initialConfig` and `initialState` are documented as read once but not
  warned on, since callers pass them as literals built each render.
## Audit round fifty-one (2026-11-20): labkit.surface

- 2026-11-20 (the fixer's call): `SurfaceHandle.registerTile` returns a release bound to the element it placed, which
  does nothing once another element holds the id; labkit's own tenants release through it. `registerTile(id, null)`
  still drops whatever holds the id, for a ref callback detaching. Making the null form refuse to drop a connected
  element was the alternative, but a ref callback whose id changed detaches an element still in the document.
## Audit round fifty-one (2026-11-20): labkit's trials

- 2026-11-20 (the fixer's call): an instrument declaring `dragDrop` without `canvas` throws, from `cameraOf`, as
  `orbit` beside `canvas` does: only a canvas mounts the drop target and the drag overlay, so the palette showed and
  nothing could be dropped. Mounting a drop target for `stage` and `orbit` cameras was the alternative; an `orbit`
  one needs a world point from a ray, which `onDrop`'s `Point` has no form for.
## Audit round fifty-one (2026-11-20): measure

- Open: a node with `data.measure` off its `Measurements.layer` (moved by a layers panel, or loaded that way) is
  still painted by `MEASURE_PAINTER` and offered as a snap target by `measureEndSource`, which read every node, but
  `measureIds`, and so picking, editing, Delete and Clear all, reads only `ms.layer`. Either `measureIds` reads the
  whole scene, which puts a walk of every node on each pointer move's hit test (`measureEndSource.test.ts` holds
  that it must not), or the painter and the snap source take only `ms.layer`'s nodes and the rest go undrawn.

## Audit round fifty-four (2026-11-20): the pref schema editor

- 2026-11-20 (the fixer's call): the schema editor's "Add pref" is disabled where the new leaf would land directly
  under a root that holds pages (nothing selected, or a loose root leaf selected), since it would be on no page.
  This follows the rule the tree and preview drops already keep. Adding it to the first page was the alternative.
## Audit round fifty-four (2026-11-20): prefs.edit

- 2026-11-20 (the fixer's call): a `weasel-bundles/1` export writes a bundle's change of package as
  `{ op: 'repackage', kind: 'bundle', from, to }`, and `move` always names bundles, an included bundle's as well. Giving
  the member move its own op instead was the alternative; a package move is the one change whose `from` and `to` are
  packages, so it is the one that took a new name.
- 2026-11-20 (the fixer's call): under a section root a leaf key that names a path inside the value of a leaf holding
  one (`grid.size` beside `grid`), or around it, is refused whatever the new node's kind, a label among them; a moved
  leaf that would clash is numbered after its first step (`grid2.size`). A bundle whose id takes another's tree key
  gets the next number (`editingShapes2`) and keeps its id.
## Audit round fifty-four (2026-11-20): renderer.draw

- 2026-11-20 (the fixer's call): a registered paint kind's program is handed the group's color matrix as
  `u_colorMatrix` and `u_colorBias` where it declares them, the convention the built-in programs use; one that
  declares neither draws unmapped and development warns once per program. Exposing the matrix on
  `PaintBindContext` for the kind to upload itself was the alternative.
## Audit round fifty-four (2026-11-20): renderer.gpu

- 2026-11-20 (the fixer's call): WebGPU's `writeBuffer` throws on a write that starts off a multiple of 4 bytes, or
  ends off one before the buffer's end; a queue write takes only whole words, so it used to zero up to 3 bytes past
  the write and dropped a write at an odd offset. WebGL still writes either. Keeping a CPU copy of every buffer, to
  fill the padding from what it holds, was the alternative.
## Audit round fifty-four (2026-11-20): renderer, part two

- 2026-11-20 (my call): a `chunks` tile scatters at most one chunk per pixel of its tile (`size²`), however small a
  `chunkSize` or large a `density` asks for more; past that count a scatter covers nothing more and only hangs the
  resolve. The cap could instead be a fixed count, or a warning.
## Audit round fifty-five (2026-11-20): text

- Ruled 2026-11-20 (my call, audit): a run grammar's delimiter is one UTF-16 unit, and `runsToMarkdown` and
  `markdownToRuns` throw for any other, an astral character or `'~~'` included. The reader finds delimiters one unit
  at a time, so the writer wrote what it could not read back; a doubled marker is spelled with `repeat`.
## Audit round fifty-five (2026-11-20): text-shaping

- 2026-11-20 (the fixer's call): text-shaping's `glyphD` throws a `RangeError` for an offset that is not finite. An
  infinite one threw `BigInt`'s own `RangeError` and a `NaN` one returned path data reading `NaN`; there is no
  override, since no such offset places a glyph. Passing the value through into the path data was the alternative.
- 2026-11-20 (the fixer's call): text-shaping's `shape` throws for a `language` holding a character outside ASCII
  (`'sr‑Latn'`), naming the tag, before it reads its cache. HarfBuzz threw its own "Expected ASCII text" for one
  and leaked the copy. No BCP 47 tag holds such a character, so there is no override; shaping as though no language
  were given was the alternative, which draws the default forms with no sign the tag went unread.
## Audit round fifty (2026-11-20): labkit annotations

- 2026-11-20 (the fixer's call): a mark store reads a target's marks against the last content box with an area it
  was given, so a target the instrument stops declaring, or whose element has not sized again, keeps reporting
  where its marks are. `add`, and an `update` that moves a mark (`frac` or `points`), throw on a target whose content
  box was never known or has no area; an `update` of meaning alone still lands. Skipping such writes silently, as
  an unknown id is, was the alternative.
## Audit round fifty (2026-11-20): labkit chrome

- 2026-11-20 (the fixer's call): every labkit chrome region lays its contributions out by `groupsOf`: a group's
  members together where the group first appears, a group `end` when any member sets `end`, and every `end` run
  after the rest. In the viewport, sidebar, and palette, which draw no spacer, "the far end" means last. The built-in
  FPS meter is ungrouped, so the scale bar it used to share `view` with stays at the status bar's near end. Keeping
  arrival order and the first member's `end` was the alternative, and contradicted `ContributionBase.end`.
- 2026-11-20 (the fixer's call): a toolbar or header group is announced by its `group` name (`history`, `view`), and
  an ungrouped contribution's bar group carries no name. A label of its own on a group is not offered.
## Audit round fifty (2026-11-20): labkit's trial clock

- 2026-11-20 (the fixer's call): a trial transport's Play, and `<TrialTransport replay>`, start a played-out run over
  in the direction it plays: a run played backward to its start seeks to its end and plays backward, and an ended
  clock that is not seekable is reset (`handle.reset()`) and played from its start. Limiting `replay` to seekable
  clocks in its doc, and leaving Play inert there, was the alternative.
- 2026-11-20 (the fixer's call): a clock's transport hold takes each speed a redeclaration gives the clock until a
  transport sets a speed of its own; working the clock otherwise (a pause, a loop toggle, a seek) does not stop it
  following. Following only while the hold is untouched was the alternative.
## Audit round fifty (2026-11-20): labkit's config

- 2026-11-20 (the fixer's call): a field of `f.object`, the item of `f.list` or `f.map`, or a variant of `f.union`
  that says `.showIf`/`.enableIf` as a function, `.render`, `.dialog`, `.auto`, `.initial(AUTO)`, `.quote`,
  `.section`, or carries `f.custom`'s `validate` throws when the outer leaf is built, since none of those has a row
  to act on there. Dropping them silently, as before, or warning and dropping was the alternative.
## Audit round fifty-six (2026-11-20): badge shapes

- 2026-11-20: A `coffin` badge's `shoulderHalfHeight` is a half-height of its own, 2..50 like `headHalfHeight` and
  `footHalfHeight`, where it had been added to the head's. Its default became 50, which draws what the old default did;
  a caller who passed it as an increment now gets that number as the half-height.
- 2026-11-20: A badge shape's repeat counts (`sparkler` and `starburst` `points`, `receipt` `teeth`) stop at 256, and a
  `perforated` badge's `holePitch` at no less than 1px. Both bounds are picked to keep a render finite, not ruled.

## Audit round fifty-seven (2026-11-20): band editor

- 2026-11-20: A `BandEditor` range end stops one key step (1% of the track) short of the other end when no locked band
  holds the range open, for a drag as for a key. That gives Home and End, and `aria-valuemin` / `aria-valuemax`, a
  value the end can take; the alternative was leaving the inward bound open and Home and End unhandled there.
- 2026-11-20: A `BandEditor` given an empty `value` draws an empty strip, read as a list not yet loaded, rather than
  throwing or warning that a band list has at least one band.
## Audit round fifty-seven (2026-11-20): Bar

- 2026-11-20 (my call): Two children of one `Bar` that share a key, as two arrays mapped from lists sharing an id can,
  keep the first under that key; the later one is keyed by its place in the children, warns, and is not a unit a
  reorder moves, since an `order` naming that key could mean either.
## Audit round fifty-seven (2026-11-20): Button

- 2026-11-20 (the fixer's call): `domButton.draw` renders an unsized button at `md`, the size `measure` gives it,
  rather than at the nearest `ControlSizeScope`'s. A scope is React context, which `measure` has no way to read, so
  the two disagreed inside one; a scoped caller passes `size`.
- 2026-11-20 (the fixer's call): `domButton.measure` throws on a `link` Button. A link draws as inline text in the
  font around it, which no token in a `MeasureEnv` names, so a measured box would be the control box it never draws.
## Audit round fifty-four (2026-11-20): the renderer, part one

- 2026-11-20 (my call, audit round 54): a group or layer `composite` string that is no `CompositeOp` (`'multiply'`,
  or an inherited name such as `'constructor'`) throws a `RangeError` naming it and listing the operators, rather
  than being drawn as `source-over`. It still ends the frame, as the bare `TypeError` it replaces did.
## Audit round fifty-eight (2026-11-20): theme, part one

- 2026-11-20 (the fixer's call): `defineTheme` and `fromDtcg` throw on an axis whose default names none of its values,
  its parent's included, as `derive` reports one. A DTCG document with no base and no `dark` mode defaults its mode to
  its first. `axisScheme` answers no scheme for such an axis rather than recursing. Loading it and letting the default
  fall back to the first value was the alternative.
- 2026-11-20 (the fixer's call): an axis name takes only ASCII letters, digits, `-`, and `_`, the characters its
  `data-wzl-*` attribute and that attribute's selector both carry unescaped; `defineTheme` and `fromDtcg` throw on
  another, and `derive` reports it. `fromDtcg` refuses `theme`, `variant`, and `__proto__` as `defineTheme` does.
  Escaping the name in the selector was the alternative, but `setAttribute` refuses a space whatever the selector does.
- 2026-11-20 (the fixer's call): a token's alpha is a number from 0 to 1. `fromDtcg` and `defineTheme` throw on
  another, `derive` reports one on a `ref` rule, and a hand-built theme's is held to that range wherever it is
  written, so `rgba()` and `color-mix()` agree. Clamping on read instead was the alternative.

## Audit round fifty-eight (2026-11-20): Badge

- 2026-11-20 (the fixer's call): a `Badge`'s `padding` prop, and padding given through `style`, is the badge's own
  padding, and its shape's insets add to it as they add to the default padding, so a `shield` given `padding={4}` keeps
  its point clear. Before, either one replaced the insets, so the label could run into the outline; the alternative was
  to keep that and stop a fitted base from counting insets the padding no longer held.
## Audit round fifty-eight (2026-11-20): LayerList

- 2026-11-20 (the fixer's call): `moveLayers` throws when the move's `parentId` names no layer in the tree, or names a
  moved layer or one inside it, where it had dropped the moved layers from the result. Returning the tree unchanged
  was the alternative.

## Audit round fifty-eight (2026-11-20): MenuBar

- 2026-11-20: A press on a disabled `MenuBar` title while another title's menu is open closes that menu, as a press
  anywhere off it does. The pointer moving onto a disabled title leaves the open menu as it is.
## Audit round fifty-eight (2026-11-20): motif frames

- 2026-11-20 (the fixer's call): `plaque({ mix })` throws a `RangeError` for a `mix` outside 0..100 or not a number,
  since `color-mix()` rejects such a percentage and the plaque loses its fill and ink. Clamping it was the alternative.
## Audit round fifty-seven (2026-11-20): badge shapes

- 2026-11-20 (the fixer's call): A `quatrefoil` badge's `samples` runs 24..1024 and a `beavis` badge's `points` 3..256,
  a `receipt` badge's `tearDepth` stops at 45 and a `house` badge's `peakHeight` at its `eaveY`. The bounds keep a
  render finite and an outline simple; the numbers are picked, not ruled.
- 2026-11-20 (the fixer's call): `NaN` in a bounded badge shape param reads as that param's default, where a repeat
  count reads it as its least. Reading it as the lower bound was the alternative.
- 2026-11-20 (the fixer's call): A shape that composes itself from a base pads by its own `insets`, fitted against the
  base's outline where the base fits its content; a `base` prop pads by that base's. `square` now declares the
  rounded-rect base's 0/4/0/4 it had been drawing with, and `beavis`, `cloud`, `plaque`, `postage` and `scalloped`
  pad by the wider insets they declared. Deleting the shapes' insets and padding by the base was the alternative.
## Audit round fifty-nine (2026-11-20): panel cells

- 2026-11-20 (the fixer's call, audit round 59): across several selected kinds, `SelectionPanel` draws a leaf only
  where every kind's leaf at that path means the same: they may differ in how they are drawn (name, description,
  icon, pair, control, conditions), never in a default, a bound, an option's value, a field, or a function such as an
  action's `run`. Reading and writing each node under its own kind's leaf was the alternative, and would keep such a
  leaf on the panel.
## Audit round fifty-nine (2026-11-20): segmented bars

- 2026-11-20 (my call, audit round 59): a `SegmentedBar` whose `steps` stop at the default `SWEEP_CAP` warns once,
  naming the bar, and draws the first 256; a bar given `cap` takes the cut as meant and does not warn. Showing a
  note in the bar, as `Sequence` does, was the alternative, and has no room in a row of segments.

## Audit round fifty-nine (2026-11-20): Select

- 2026-11-20: A `Select` whose `options` hold two values that read the same as text (`1` and `'1'`, or one value
  twice) throws a `RangeError` naming it, with no override: React Aria keys its rows by that text, so the two
  cannot be drawn apart.
## Audit round fifty-nine (2026-11-20): ui's Timeline

- 2026-11-20 (the fixer's call): while a press on a `Timeline`'s lanes is held, an arrow step or a Delete or Backspace
  on a key or the root is refused, since the drag's release commits against the tracks it began from and would undo
  it; Escape still cancels. Edits from elsewhere during a drag (the inspector, the consumer) are not guarded. Ending
  the drag on any other edit, or committing against the tracks at release, was the alternative.

## Audit round fifty-nine (2026-11-20): TokenPanel

- 2026-11-20: Dragging a step of a `factors` scale that no factor can reach (the base is zero or negative, or the
  rule has no factor for that step) overrides the step through `onChange`, rather than writing an infinite or
  negative factor or doing nothing.

## Audit round fifty-nine (2026-11-20): ui's Tree

- 2026-11-20: Alt+Right refuses to indent a `Tree` row under a closed disabled branch, which cannot open to show it; a drag may
  still drop into one.

## Audit round fifty-nine (2026-11-20): ui components, part one

- 2026-11-20 (my call, audit round 59): a `ColorField` pick that closes, or loses focus, on the color it began from
  after `onInput` ticks calls `onCancel`, which until now meant only an abandoned opacity drag. A pick with no ticks
  calls nothing.
- 2026-11-20 (my call, audit round 59): a mixed `Switch` (`indeterminate`, and so a mixed item in a `CheckboxGroup`
  with `control="switch"`) writes `aria-checked="mixed"` on its input, though ARIA gives `switch` no mixed state and
  a reader may announce it as off; its thumb sits mid-track.
## Audit round sixty (2026-11-20): ui

- 2026-11-20 (the fixer's call): `useRovingTabIndex` leaves an arrow, Home, or End held with Alt, Ctrl, Meta, or Shift
  to the browser and the item, with no option to walk on one. Alt+Left is Back and Ctrl+Home scrolls the page, and an
  item binding Shift+Arrow for itself saw focus move on the same key. Walking on Shift was the alternative.

## Audit round sixty (2026-11-20): ui components, part two

- 2026-11-20 (the fixer's call): A `Dialog` in a contained portal puts `ModalOverlay`'s DOM attributes, handlers,
  `style`, `isEntering` and `isExiting` on its overlay, and warns that it ignores `onEnter`, `onExit`,
  `UNSTABLE_deferUntilEntered` and `render`, since it unmounts at once and draws its own overlay. Giving the
  contained modal an exit animation, so those work, was the alternative.
- 2026-11-20 (the fixer's call): A `CycleButton` given no `options` renders disabled, named and tooltipped by its
  `aria-label` alone, rather than throwing; a filtered rotation can come out empty. Throwing on an empty list was
  the alternative.
## Audit round sixty (2026-11-20): ui components, part three

- 2026-11-20 (the fixer's call): `Disclosure` follows a `<Disabled>` scope and takes `disabledReason`, but not a
  `<ReadOnly>` scope: folding a section changes no value, so a read-only twisty still folds.
- 2026-11-20 (the fixer's call): a read-only `FillStrokeSwatch`'s chips still pick the target slot, since that
  changes no paint, and do not open the paint editor; a disabled one's chips pick nothing.

## Audit round sixty (2026-11-20): ui components, part four

- 2026-11-20 (the fixer's call): An `InlineMarkdown` mark (`*`, `**`, `~~`) opens before punctuation only after a space
  or at the start of the line, so `src/*.ts to lib/*.js` and `"*.ts" or "*.js"` stay literal; a code span, a
  shortcut, or an escape right after the mark does not count as punctuation. `x*"quoted"*` is therefore literal too.
  CommonMark's flanking rule, which reads `src/*.ts to lib/*.js` as emphasis, was the alternative.

## Audit round sixty (2026-11-20): ui's test helpers

- 2026-11-20 (the fixer's call): `painted` and `lineContrast` in `packages/ui/src/testing/paintedContrast.ts` throw
  when the ground is translucent, unless passed the `backdrop` it is drawn over. Measuring against the ground as if
  it were opaque was the alternative.
## Audit round sixty-one (2026-11-20): Badge

- 2026-11-20 (the fixer's call): A badge rendered `as="span"` never runs `onClick`, including on a removable one whose
  tooltip splits the label off, where the label had run it. A span badge has no role or key handling to make a click
  reachable; running `onClick` on every span badge was the alternative.
- 2026-11-20 (the fixer's call): A badge's `padding` prop, and padding in its `style`, replaces the shape's insets on
  each side it sets, as it always has and as the story describes it, so a fitted base refits around the other sides
  alone. Adding the insets to the given padding, as the size's own padding does, was the alternative.

## Audit round sixty (2026-11-20): the component kit, part eight

- 2026-11-20 (the fixer's call): A `SidebarPanel` with no `title` still draws its header row when it folds or is given
  `onHide`, `actions`, `trailing` or `headerRef`; its fold control is then named "Contents". Making `title` required was
  the alternative.
- 2026-11-20 (the fixer's call): `rulerTicks`, and so a `SpanStrips` ruler, throws a `RangeError` on a tick step that is
  not a positive finite number, and when no step spaces ticks 64 px apart it takes the least whole multiple of the last
  step that does, rather than every tick of the last step. Skipping bad steps was the alternative.
## Audit round sixty (2026-11-20): badge bases

- 2026-11-20 (the fixer's call): A `ribbon` end other than `inward`, `outward`, or `flat`, or a `puzzle` edge other than
  `flat`, `out`, or `in`, throws a `RangeError` naming it. A ribbon had thrown a bare `TypeError`, and a puzzle drew
  it as a socket; reading it as the default was the alternative.
- 2026-11-20 (the fixer's call): An `octant-spline` or `octant-bspline` badge's `samples` runs 48..1024, the bound
  `quatrefoil` had, and a `puzzle` badge's `arcSamples` 6..256. The upper bounds are picked to keep a render finite.
- 2026-11-20 (the fixer's call): `NaN` in a badge base param reads as that param's default, as round 57 ruled for shape
  params, and an infinite `rotation` or powerline `depth`, which no bound holds, reads as its default too.
- 2026-11-20 (the fixer's call): `octant-spline` anchors within 1e-6 of one `s` are one point to the curve, which runs
  through the first of them at s = 0 and the last elsewhere, so the end anchor quadrant mode pins is the one kept.
  `octant-bspline` keeps them all, as coincident control points are well defined there. Averaging a run was the
  alternative.
- 2026-11-20 (the fixer's call): A `puzzle` badge's `tabSize` stops where two sockets would touch, about 30.9 with
  two opposite and 24.6 with two adjacent, rather than at 40. Shrinking only the sockets, so a tab keeps the size
  asked for, was the alternative.
## Audit round sixty-two (2026-11-21): Badge effects

- 2026-11-21 (the fixer's call): a `perforations` effect's holes sit at least 1 CSS px apart, and a negative
  `holeRadius` reads as 0, as the `perforated` shape's `holePitch` and `holeRadius` already did. A radius and a
  spacing of 0 had asked for holes without end. Throwing on them was the alternative.

## Audit round sixty-two (2026-11-21): text.layout

- 2026-11-21 (the fixer's call): `paintRuns` and `cachedPaintRuns` throw a `RangeError` for an `outlineMinSize` of
  `NaN`, which the paint cache read as a threshold no run reaches while every glyph drew as an outline. Omitting it is
  how to ask for no outlines; the renderer passes none when a degenerate transform makes its world threshold `NaN`.
  Reading `NaN` as omitted was the alternative.
## Audit round sixty-two (2026-11-21): sweeps

- 2026-11-21 (the fixer's call): a sweep's `at` throws a `RangeError` for a `NaN` fraction, from `rangeSweep`,
  `valuesSweep` and `framesSweep` alike, where it had answered `NaN` or `undefined`. Reading `NaN` as 0, the start,
  was the alternative.

## Audit round sixty-three (2026-11-21): font

- 2026-11-21 (the fixer's call): the canvas font tier draws a weight outside 1 to 1000 at the nearer end, and a weight
  that is not a number at 400 with a one-time warning, rather than throwing. A canvas ignores a `font` string with such
  a weight and measured the face in whatever font it last held.
## Audit round sixty-three (2026-11-21): renderer.draw

- 2026-11-21 (the fixer's call): a path's `vertexColors` beside a gradient or pattern `fill` draw the vertex colors at
  the paint's opacity, as `stroke.vertexColors` beside a non-solid stroke paint already did; the fill used to draw the
  paint and drop the colors. Having the stroke draw its paint and drop its colors was the alternative.

## Audit round sixty-three (2026-11-21): svg, part two

- 2026-11-21 (the fixer's call): `serializeSvg` warns when it writes a pattern paint with `units: 'bounds'`, which it
  still writes anchored at the user-space origin; the kit's export path resolves such a paint with
  `paintToLocalUnits` first and never warns. Writing a def per node, each placed against that node's box, was the
  alternative.
## Audit round sixty-four (2026-11-21): Properties, part two

- 2026-11-21 (the fixer's call): a boolean property field whose `value` is absent reads as not set, as `unset` does:
  an editable checkbox or switch draws off and dimmed with the "Not set" cue, and a read-only one the dash. Drawing
  it as plain Off in both, as the prop's doc used to promise, was the alternative.
## Audit round sixty-four (2026-11-21): Mermaid diagrams, part two

- 2026-11-21 (the fixer's call): The Mermaid state writer writes start and end shapes its `[*]` cannot keep apart (a
  second in one composite, a start a transition arrives at, an end one leaves, one with no transition) as before,
  with a warning; refusing the page was the alternative. A diamond with text is written as a plain state keeping its
  text, with a warning; writing it as a `<<choice>>` and dropping the text was the alternative.
- 2026-11-21 (the fixer's call): A chart writer (pie, packet, quadrant, radar, sankey, xychart, timeline) warns of a page name
  that is not its chart's title and writes none; writing it as front matter, which every chart reader takes as the
  chart's title where it has none, was the alternative. A Mermaid sequence page named `''` reads back unnamed, as an
  empty title statement names no page of any other kind.
## Audit round sixty-four (2026-11-21): diagram containers

- 2026-11-21 (the fixer's call): `addLane` throws a `RangeError` for a negative or fractional `index`, and still
  adds at the end for one past the last lane. Clamping a negative index to 0 and rounding a fractional one was the
  alternative.
## Audit round sixty-four (2026-11-21): text

- 2026-11-21 (the fixer's call): `markdownToRuns` reads a marker that turns on a flag nothing turns off again as
  literal text (`5 * 3`, `2**10`); where several are open at the end, the last one to open is made text and the input
  read again, until none is. `runsToMarkdown` now closes every flag it opens, fitting the spelling where the plain
  closing markers would misread, rather than leaving them off. Reading an unclosed marker as styling to the end, as
  the reader did, was the alternative; CommonMark's flanking rules were another, and need a design of their own.
- 2026-11-21 (the fixer's call): a run grammar whose delimiter is a backslash throws in `runsToMarkdown` and
  `markdownToRuns`, since the reader takes a backslash for an escape and loses the marker. Reading a backslash run as
  a marker before trying it as an escape was the alternative, which leaves no way to write a literal backslash.

## Audit round sixty-five (2026-11-21): animator

- 2026-11-21 (the fixer's call): `createTargetTable` throws for a `capacity` that is not a whole number (2.5, NaN,
  Infinity), naming `capacity`, and still treats one below 1 as 1. Rounding a fraction up was the alternative.

## Audit round sixty-five (2026-11-21): the platformer demo

- 2026-11-21 (the fixer's call): the platformer's `createEnemies` stands a walker placed in the air on the first floor
  below it, and leaves out one whose column has no floor below it at all, since walkers have no gravity. The swarm
  button can therefore insert fewer than forty. Giving walkers gravity, so they fall into a pit and die, was the
  alternative.

## Audit round sixty-five (2026-11-21): diagram-formats

- 2026-11-21 (the fixer's call): laying out a graph page that has some nodes placed and some not moves everything
  on it, placed nodes included, by one offset when layout puts a node above or left of the page, so every node
  lands on the page and the arrangement holds. Keeping each placed node at its `at` and leaving the rest off the
  page was the alternative.

## Audit round sixty-five (2026-11-21): forge

- 2026-11-21 (the fixer's call): a CSF list arg's entries get back what they could not send (a callback, an element)
  from the original entry their sent part still equals, so removing or moving an entry keeps each entry's own; an
  edited entry, which equals none, takes the unclaimed original at its index. An entry that equals more than one
  original once the list's length changed (two bare callbacks, both sent as `null`, one removed) gets nothing back
  rather than a guess. Pairing by index alone, as before, was the alternative.
- 2026-11-21 (the fixer's call): an isolated forge story's panel carries a leaf's `.auto()`, `.quote()`, and
  `autoResolve`, the last answered by the frame against the story's config as it stands, where labkit resolves it
  against a config with the other auto paths already resolved. A group's `motif` and a leaf's `.dialog` are not carried:
  each is a renderer that runs in the frame's document, as a custom `.render` is, and the workshop draws the plain card
  and row.

## Audit round sixty-five (2026-11-21): geom paths, part two

- 2026-11-21 (the fixer's call): `mergeRegion` throws a `RangeError` for a `tolerance` that is not a positive finite
  number, as `pathFaceArrangement` does for its `flattenTolerance`; a zero one had dropped every piece and answered an
  empty path. Clamping it to a floor, as `resamplePath` and `simplifyPath` do, was the alternative.

## Audit round sixty-five (2026-11-21): TokenPanel

- 2026-11-21 (the fixer's call): a `TokenPanel` scale's slider writes amounts to the most decimal places any step
  has, or to as many as move its smallest step by a third of itself, whichever is finer, capped at four; so
  `1rem 2rem 4rem` steps by 0.1rem and `3px 5px 14px` by 1px. Taking the resolution from the unit was the
  alternative.
## Audit round forty-nine (2026-11-20): geom, part one

- 2026-11-20 (the fixer's call): in a length table, a subpath a drawing command opens after `Z` with no `M` has no
  anchor of its own at its start, so its first segment spans no anchor range: `anchorAtLength` along it answers the
  anchor it ends on, and `lengthAtSegmentFraction` gives it no share. Its start had taken the closed subpath's first
  anchor, and the anchor queries answered on the wrong subpath. Numbering the implicit start, which would shift every
  later authored anchor, was the alternative.

## Audit round sixty-five (2026-11-21): Badge effects

- 2026-11-21 (the fixer's call): a `sheen`, `bevel`, or `rivets` effect throws a `RangeError` naming it for a
  `lightFrom` other than `tl`, `tr`, `bl`, or `br`, `constructor` and `toString` included, as a `ribbon` end or a
  `puzzle` edge does. Reading it as the default `tl` was the alternative.
- 2026-11-21 (the fixer's call): `NaN` or an infinite number in a `spikes`, `puffs`, `bites`, or `scallops` param reads
  as that param's default, as round 60 ruled for badge base params; `spikes`' `count`, and the `sunbeams` `count` and
  `woodgrain` `lines` and `knots`, are repeat counts, whole numbers up to 256 where `NaN` reads as the least.

## Audit round sixty-five (2026-11-21): CurveEditor

- 2026-11-21 (the fixer's call): a `'click-curve'` function layer with fewer than two anchors, which draws no curve to
  press, adds a point from a click anywhere in the plot until it has two. Holding `minPoints` at 2 in that mode, so a
  delete could never leave it there, was the alternative; it would not help a state the consumer passes in that short.

## Audit round sixty-six (2026-11-21): core's animation

- 2026-11-21 (the fixer's call): an `animateLifecycle` node inserted again while its exit runs replaces the leaving one:
  the exit ends, the node is removed as it stood, and the node given is inserted, so undo sees a removal and an insert.
  Skipping the insert and writing only the new pose, which drops the rest of the node given, was the alternative.
## Audit round sixty-six (2026-11-21): draw-style XML

- 2026-11-21 (the fixer's call): a draw-style XML placeholder filled into an `html=1` label is escaped first, so its
  value reads as the text it holds and never as markup. Letting a value carry HTML into the label was the alternative
  (`drawXml/cells.ts`, `filled`).
- 2026-11-21 (the fixer's call): reading draw-style XML leaves out a cell its `visible="0"` hides, every cell under it,
  and every connector with an end on one, with one warning. Importing them shown, or keeping a connector between a
  shown shape and a hidden one as a loose end, were the alternatives (`drawXml/pageCells.ts`, `shown`).
## Audit round sixty-six (2026-11-21): Mermaid diagrams, part two

- 2026-11-21 (the fixer's call): The Mermaid sequence writer writes a region with no fill as `rect transparent`,
  which reads back with no fill, so Mermaid draws it unshaded. Writing a faint gray, which shows in Mermaid but reads
  back as a fill the page never had, was the alternative.
- 2026-11-21 (the fixer's call): The Mermaid state writer writes what a pool holds outside its lanes (its own states,
  containers, and `[*]` transitions) as a concurrent region ahead of the lanes, with a warning, so it reads back as a
  lane of its own. Dropping it with a warning was the alternative.
## Audit round sixty-six (2026-11-21): diagram containers

- 2026-11-21 (the fixer's call): `addLane` returns null and changes nothing when the add would move or restyle a
  locked node (the pool, its title, a lane it shifts, or what that lane holds), as `releaseMembers` does; throwing,
  or adding the lane and leaving locked lanes overlapping it, were the alternatives.
## Audit round sixty-six (2026-11-21): path-tools, part two

- 2026-11-21 (the fixer's call): `facesAlong` throws a `RangeError` for a `step` that is not a positive finite
  number, as `mergeRegion` does for its `tolerance`; a zero one had looped forever, and a negative one sampled only
  each segment's ends. Falling back to one sample per segment was the alternative.
## Audit round sixty-eight (2026-11-22): prefs-schema

- 2026-11-22 (the fixer's call): `prefDisplayBounds` measures a nonlinear (function) unit's `step` as the display
  distance one step makes at the leaf's `default`, else at `min` or `max`, and leaves it as declared where none of
  those gives a finite one. Leaving a function unit's step unconverted everywhere was the alternative.
## Audit round sixty-eight (2026-11-22): renderer.gpu

- 2026-11-22 (the fixer's call): `createTarget` throws, on both backends, for a target with `ids` and more than one
  sample a pixel; neither can draw into one, since its two color attachments would differ in sample count. There is
  no override. Multisampling the ids attachment too was the alternative, which would blend ids at shape edges.

## Audit round sixty-eight (2026-11-22): tiles

- 2026-11-22 (the fixer's call): `planeFloor` throws a `RangeError` when its `tilePx` is not the tile size of the
  scheme it is given; mismatched, it had chosen a level for one size and keys from the other. Dropping the `tilePx`
  parameter and reading the size from the scheme was the alternative, but that breaks every caller.
## Audit round sixty-eight (2026-11-22): ui-canvas

- 2026-11-22 (the fixer's call): `CharacterOptions` draws No fill as indeterminate whenever the range's fill is
  `MIXED`, though a `RangeStyle` cannot tell runs of two colors from a range that is partly unfilled. Leaving it off
  for a mixed fill, which claims every character is filled, was the alternative.
- 2026-11-22 (the fixer's call): `SelectionPanel` leaves a node unchanged, with a dev warning, when a schema keys one
  field of a declared field (`units.drawnAt`) that the node does not hold, since the record it would store lacks
  `UnitScope`'s required `system`. Building the scope from the node's inherited one was the alternative.
## Audit round sixty-eight (2026-11-22): badge shapes

- 2026-11-22 (the fixer's call): a `perforated` badge's `holeRadius` stops at the box's longer side, so an infinite
  one draws as any radius that already masks the whole badge. Reading it as the default, as an infinite `rotation`
  does, was the alternative.

## Audit round sixty-eight (2026-11-22): ui components, part eight

- 2026-11-22 (the fixer's call): `scaleBar` (and so `ScaleBar`) throws a `RangeError` for an empty `lengths`, which
  had measured a NaN length; falling back to the 1-2-5 default, as for no `lengths`, was the alternative.
- 2026-11-22 (the fixer's call): a `Sequence` grid's `cap` bounds its cells, not each axis: an axis shorter than
  √`cap` keeps every step and the other takes what that leaves, else both keep ⌊√`cap`⌋. Two open sweeps had drawn
  `cap`² live cells. Capping rows alone, at ⌊`cap` / columns⌋, was the alternative.

## Audit round sixty-nine (2026-11-22): chart app, part two

- 2026-11-22 (the fixer's call): chart's `mountChartApp` test helper throws when the app is already mounted, so a test
  simulating a reload calls `unmountChartApp` first. Unmounting the earlier app silently was the alternative.
## Audit round sixty-nine (2026-11-22): geom paths, part two

- 2026-11-22 (the fixer's call): `resamplePath` places at most 10,000 anchors before tolerance halving. A larger
  `count` is read as 10,000, and a `spacing` that would place more spreads 10,000 by length; a spacing near 0 had
  hung the call. Throwing on either was the alternative; a slider dragged toward 0 should not throw. The number is mine.
## Audit round sixty-nine (2026-11-22): labkit.config

- 2026-11-22 (the fixer's call): `configFromPrefs` (`f.prefs`) merges a group's `object` leaf with the dotted keys
  under it in either member order, and throws where a plain leaf and a branch, or two leaves, claim one path, rather
  than letting the later member replace the earlier.
- 2026-11-22 (the fixer's call): a bare `AUTO` written at a group path (`setConfig('grid', AUTO)`) leaves the auto
  set as it was when any leaf under the group is auto, rather than pinning those leaves; `applyConfigWrite` has no
  schema to tell which of the group's leaves may be auto, so unpinning all of them was not an option, and throwing
  was the alternative. A reset writes a record holding `AUTO` at each leaf.
## Audit round sixty-nine (2026-11-22): labkit.loupe

- 2026-11-22 (my call, audit round 69): two loupes in one camera (`<CanvasStack>`, `<Stage>`) stay unsupported, since
  their actions share ids on the camera's registry and one hover runs one action; the second to mount warns once in
  development that only the newest aims, peeks and magnifies, rather than both being routed.
## Audit round sixty-nine (2026-11-22): ui components, part six

- 2026-11-22 (the fixer's call): `PageTabs` treats a rename committed blank, or only spaces, as abandoned and calls no
  `onRename`. Clearing the page's name back to its numbered label was the alternative, which `onRename`'s string
  argument cannot say.
- 2026-11-22 (the fixer's call): `PaintInput` with a mixed or missing value and `kinds` leaving out `solid` shows no
  body under the kind bar; a kind is chosen in the bar. Seeding the first offered kind from the picked color was
  the alternative.

## Audit round sixty-seven (2026-11-22): Badge effects

- 2026-11-22 (the fixer's call): a `bevel2` effect throws a `RangeError` naming it for a `lightFrom` that is not a
  finite number (`NaN`, `Infinity`, a corner such as `'tl'`), as `bevel`, `sheen`, and `rivets` do for one that is not
  a corner, where its other params read a non-finite number as the default. Reading it as the default 315° was the
  alternative.
- 2026-11-22 (the fixer's call): a `shadow` or `sunbeams` effect draws nothing on an `outline` badge, which has no
  fill for it to sit behind or light, as `bevel`, `sheen`, and the other drawn effects already did. Casting the shadow
  of the outline's stroke alone was the alternative.
## Audit round sixty-seven (2026-11-22): CurveEditor

- 2026-11-22 (the fixer's call): a context menu that opens while a curve layer's drag runs, as a touch long press
  does after its pointerdown grabbed an anchor, cancels the drag and goes to the layers from the state before it; a
  right-click in the middle of a mouse drag does the same. Ignoring the menu while a drag runs, which left a long
  press unable to delete an anchor, was the alternative (`LayeredCurveEditor.tsx`, `onSvgContextMenu`).
## Audit round seventy (2026-11-22): diagram formats

- 2026-11-22 (the fixer's call): the DOT reader leaves out a node or an edge whose `style` holds `invis`, and every edge
  to an invisible node, with one warning naming them, as draw-style XML leaves out hidden shapes. Invisible nodes still
  count toward the page's size when every node has a `pos`. Keeping them drawn, or drawn with no stroke and no fill, was
  the alternative.
- 2026-11-22 (the fixer's call): the DOT reader reads a `shape=point` node as Graphviz draws one: no label, whatever
  `label` says, a circle the smaller of its `width` and `height` across (0.05in when neither is set), filled with its
  `fillcolor`, else its `color`, else black.
## Audit round seventy (2026-11-22): geom, part one

- 2026-11-22 (the fixer's call): `boundsOfCoords` and `aabbOfPoints` skip a NaN coordinate, as they did, and answer
  null when an axis is left with none, where they had answered an inverted box of infinities. Propagating NaN, as
  `unionRects` does, was the alternative; skipping kept every answer that had been a real box.
## Audit round seventy (2026-11-22): prefs-schema

- 2026-11-22 (the fixer's call): a group's own test read from its group (`from: 'group'` in a group's `showIf` or
  `enableIf`) reads a leaf in that group, not in the group it is declared in, so a feature group can carry its own
  switch wherever it is mounted; a test on the group meaning a leaf beside it names it from the root.
- 2026-11-22 (the fixer's call): a number leaf's `minAt` and `maxAt` are held inside its declared `min` and `max`, and a
  `maxAt` below the `min` gives way to it, so crossed bounds collapse to one value rather than one of them being dropped.
## Audit round seventy (2026-11-22): ui's Timeline

- 2026-11-22 (the fixer's call): a `Timeline` key drag released on the time it began from, after `onInput` previewed a
  move, sends `onInput` the tracks it began from and then calls `onCancel`, as a canceled drag does and as `ColorField`
  does for a pick closed on its starting color. A drag that previewed nothing calls nothing. Calling nothing at all
  was the alternative.
## Audit round seventy-one (2026-11-22): core's default actions

- 2026-11-22 (the fixer's call): `container.scroll` leaves a wheel to the node the `hitAt` classifier finds at the
  point when that node is painted over a scroll container rather than inside it or holding it: only the containers
  holding that node scroll, and with none the wheel pans the view. Without `hitAt` wired, every container under the
  point is reached, painted over or not. Testing occlusion by bounds inside the action was the alternative.
## Audit round seventy-one (2026-11-22): diagram formats

- 2026-11-22 (the fixer's call): the DOT reader takes `pos` as points in a graph with a `bb`, which only layout output
  carries, and as inches in one without, as neato reads its input. A `!` pin says nothing about the unit; reading it as
  inches was the alternative, but Graphviz's own output pins nodes too.
- 2026-11-22 (the fixer's call): the DOT reader reads a cluster whose `style` holds `invis` as a container with a
  transparent fill and stroke and no label, holding its members as before, since Graphviz still lays an invisible
  cluster out as one. Leaving the container out, as invisible nodes are, was the alternative; it would lose the grouping.
- 2026-11-22 (the fixer's call): the DOT reader takes a node's `weasel_outline` only when it names an outline the
  outline registry holds; an empty one is unset, and any other is read from the node's `shape` with a warning. A
  document naming an outline its consumer registers later reads as the shape; taking any name on trust was the
  alternative.
- 2026-11-22 (the fixer's call): the DOT writer warns whenever a dash it writes is not one of the two patterns DOT's
  `dashed` and `dotted` read back as, the built-in themes' container dash included, since it reads back changed.
  Warning only for an element's own dash, not a theme's, was the alternative.
## Audit round seventy-one (2026-11-22): diagram containers

- 2026-11-22 (the fixer's call): `commitLaneResizeToScene` writes nothing where the resize would write a locked node
  (the pool, the lane, either title, or a later lane or what it holds), raises a size below `MIN_LANE_SIZE` to it, as
  the drag does, and throws a `RangeError` for a size that is not a finite number. Throwing for a locked node, as the
  scene's own lock guard does, was the alternative.
