# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@weasel-js/core`). The
kit aims to be a generic scene-graph foundation: 2D in core, 3D in
`@weasel-js/kernel3d` beside it. Items here are evaluated for cross-app reuse,
not consumer-app value.

For history of completed work, see `git log` and the dated specs under
`docs/superpowers/specs/`. Plans are deleted when their work merges.

When work merges, retire its entry here in the same change.

Priority tags:
- **(P1)** — foundational genericity gap; the kit can't do this today
- **(P1.5)** — ranked between P1 and P2
- **(P2)** — broad reuse, or friction-likely
- **(P3)** — specialized, or resting on a foundation not built yet

---

## Tools & gestures

- **(P2) Tools have no consistent home, and no way to compose a set of them.** Where a tool lives
  depends on when it was written:
  - Core's `tools/builtin/` holds the select, hand, and shape tools, and also bone, weight, slice,
    eyedropper, measure, and image.
  - `@weasel-js/path-tools` holds the path-editing family: warp, trim, spiro, smudge, the shape
    builder, girth, and extend. Some of these are tools and some are path-edit presets.
  - Guides presets and `apps/draw` bring tools of their own.

  Choosing a set is a hand-picked id list: `BUILTIN_TOOL_IDS` plus `defaultTools`, presets that
  each add their own tools, and `tools={{ … }}` patches. draw mounts every built-in id except
  bone and weight. As more tools land, each consumer has to make that cut again, and every new
  built-in id silently joins whatever list includes "all of them".
  Needs:
  - a durable rule for which package a tool lives in, which also answers moving finished tools
    out of core so they stop sharing its test surface;
  - a composition unit above single ids (families or sets a consumer opts into whole, with
    exclusions) that presets, `defaultTools`, and the palette all read.

- **(P1) Guides and snapping, designed as one arc.** Spacing hints (equal-gap markers while
  moving, Alt-hover distance readouts between the selection and the shape under the pointer) go in
  as part of a pass over every guide and snap at once, not alone. The pieces today don't share a
  pipeline: `@weasel-js/guides` has ruler guides, alignment guides, and equal-spacing snaps
  (`packages/guides/src/guides/alignment/spacing.ts`), and only spacing hints reach draw, as
  `createSpacingHintsPreset` (`packages/guides/src/spacingHints/`) behind the Spacing hints
  preference; a move and the drawing tools reach path targets and measurement ends through the
  `snap` dep (`toolOptions.snapTargets`), but the move's grid is a `gridSnapStrategy` behavior;
  path snapping just landed with its own `snapPoint` ranking (`packages/core/src/features/paths/pathSnap/`); and
  each pipeline reads its own reach: guides and spacing hints the `targets.guideSnapPx` kit
  setting, the pen `targets.penAnchorSnapPx`, and path snap its own `radius` option, else
  `DEFAULT_PATH_SNAP_RADIUS`, with no kit setting behind it. The arc settles one snap
  pipeline every gesture uses — which targets compete, how ties are ranked, how a modifier
  suspends them mid-gesture — and one readout layer for gaps, distances, and guide labels. The
  spacing hints preset is source material for it: an Alt-hover distance readout drawn on its own
  overlay, and a move snapping to equal sibling spacing with a marks layer of its own, neither
  sharing a pipeline with the rest.

- **(P2) `features` names two things.** The `<SceneCanvas features>` prop composes behavior presets
  (`canvas/SceneCanvas/features.ts`); `packages/core/src/features/<name>/` is a source directory
  bundling one domain's primitives, and `docs/taxonomy.md` calls each of those a "feature" too.
  Ruled 2026-10-11: the directory and the taxonomy's term take a new word, and the prop keeps
  `features`; the new word is not chosen yet. That leaves choosing it, then renaming the one path,
  its imports, and the section of the taxonomy.

- **(P3) Nothing reads a mode's `entry.trigger`.** The `'double-click-target'` the definitions
  in `packages/modes/src/presets/default.ts` declare is unread. A path with anchors is put in
  path-edit by the kit's `enterPathEdit` binding, through draw's `PathEditHost`
  (`apps/draw/src/modality/pathEditHost.ts`), and text-edit is entered by the edit itself
  (`useTextEditSession`). Draw still enters isolation, and path-edit on a path with no anchors (a
  rect), from `SceneCanvas`'s `onDoubleClick` observer through a kind-to-mode table of its own
  (`apps/draw/src/modality/doubleClickEntry.ts`). Binding those means a double-click entry beside
  `enterPathEdit`, and a definition does not say which hits it takes (draw's table does).

- **(P3) External-content ingestion — follow-ups.** The pipeline is in
  `packages/core/src/features/ingestion/` (its README is the map). Left:
  (a) an insertion ghost under the pointer during a drag. A ghost needs two things nothing has
  yet: somewhere for an action to draw while it is only being predicted (`ingest` is an immediate
  action, and a dragover never invokes it), and what to draw, since a browser withholds a dragged
  file's contents, its size included, until the drop. It also needs a real OS drag to check, which
  no test here can start.
  (b) `kitTextHandler` is exported but registered nowhere: a canvas opts in with
  `ingestion={{ handlers: [kitTextHandler] }}`. Whether `ingest` canvases should take text by
  default, and whether weaseldraw should, is undecided. The node gets the default text style,
  since the `insert` dep's `text` kind carries a string and nothing else.

- **(P3) The image and SVG drop handlers could leave core.** `kitImageHandler` /
  `embedFilesAsImageNodes`, `kitSvgHandler` (which reuses the image embed), and `openFilePicker` in
  `packages/core/src/features/ingestion/` are about 300 lines no kernel path needs; the registry,
  the `ingest` action, the `ingestion` dep, and the weasel-JSON handler stay, since Cmd+V of the
  canvas's own content runs through them. Moving them makes a file drop do nothing on a bare
  `<SceneCanvas>` until the consumer installs the handlers. Left in place for now (ruled
  2026-10-11). If they do move, the package is `images`; `ingest` was turned down.

- **(P3) The action pipeline's coordinates are 2D.** World points arrive as `{x, y}` or flat
  scalars in `InvocationCtx`, the dep payloads, the pick functions, and `@weasel-js/gestures`'
  pointer events, and the camera is the 2D `View`. Not a blocker for another kernel: the 3D lab
  (`packages/labkit/examples/3d-lab`) drives core's dispatcher with core unchanged, because its
  deps rebuild the ray from a camera they close over. What is left is type hygiene. Findings in
  `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`.

- **(P3) `apps/theme-editor` cannot become a `<Lab>` without being rebuilt.** `<Lab>` is the trial
  runtime: it requires a non-empty `instruments` list, seeds a trial, and renders `children` into
  the header while its body is fixed as the surface buffers plus a `Workspace` of trials.
  PaletteLab's page *is* the shell body, and the `#/theme` workbench beside it is a second bare
  `LabShell` page. Moving them in means making each an instrument and running it in a trial pane,
  with labkit's per-trial store and persistence beside its own, and a trial titlebar beside its own
  `PropertyPanel`. Its own arc, and the first question is whether labkit should support a lab with
  no trials at all.

- **(P3) `geometryProjection` cannot hold a 3D transform.** `transform(node, m: Affine)` names a
  plane in its signature, and core builds the `Affine` at four call sites (move, nudge, flip, and
  resize commit) before the dep is consulted, so widening the type alone does not free it. It is
  the one dep a camera-bearing host cannot implement: `view` is per-kernel by design (`kernel3d`
  declares `camera3d`), `editAnchors` and `booleansAdapter` are 2D features, and the rest take
  screen points under the identity `clientToWorld` a 3D host passes. `pointer` was read, not run in
  a 3D host: its store (`PointerContextValue`) holds one `{ worldX, worldY, viewId }` point and no
  camera.

- **(P3) Long-press: the native `contextmenu` a touch hold sends is unseen on a real device.**
  `useGestureDispatcher` treats a `contextmenu` that arrives while a touch or pen hold is in
  progress as that hold's long-press, so a `contextMenu` binding runs once. Tested only in jsdom
  with a hand-sent event (`useGestureDispatcher.nativeLongPress.test.tsx`). Left: hold a finger on
  a canvas with a `contextMenu` binding in Android Chrome and confirm one menu, and that the event
  really arrives while the pointer is still held rather than after a `pointercancel`.

- **(P3) AltGr matching is unchecked in a real browser.** The keyboard channel
  (`packages/routing/src/interactions/dispatcher/channels/keyboard.ts`) dispatches the chord as
  reported, and when nothing takes it and `getModifierState('AltGraph')` holds, dispatches again
  without Ctrl and Alt. Only jsdom has seen it. Left to check on Windows, with a layout that has
  AltGr: that Chrome and Firefox both report AltGraph for it, and that a plain Ctrl+Alt+letter, for
  which Firefox reports AltGraph too, is still read as a chord.

- **(P3) `BASELINE.md`'s text layout numbers include grouping.**
  `tests/perf/bench/text-layout.bench.ts` times layout alone now, so they need re-recording.

- **(P3) The Badge lab's Compose view overflows at 1500px.** In the workshop at a 1500px window,
  the Compose lab's (`packages/ui/src/components/Badge/lab/`) "Type & padding" column and effects
  panel run past the right edge of the stage. Not compared against the lab before its text moved
  onto the type scale. Its range inputs (`InlineRange`), effect-card reorder (`useReorderDragList`
  with `DragGrip`), and `--wzl-*` colors are unchecked in a browser since they replaced the
  hand-rolled ones.

### Cursor package follow-ups

- **(P3) Cursor rasterization is unmeasured in Safari.** Chrome and headed Firefox are measured
  (`packages/cursor/scripts/probe/README.md`, "Measured browser behavior"); the
  baker's plain SVG `url()` is right for both. `node probe.mjs <dir> --browser safari` in
  `packages/cursor/scripts/probe/` is the instrument, and its readings cannot be trusted yet: its
  first run drew the arrow control and then the crosshair for every case after it, and every later
  run drew the crosshair even for the arrow — with the page frontmost, over HTTP (`--page http`) as
  well as `data:`, stepping by reload as well as by hash. Safari's cursor is not following the page
  under this driver, and why is the open question. A finding lands in `bake.ts`.

---
- **(P3) Nothing produces `GroupTransform`'s `scale` and `rotate` arms.** A move behavior answers
  a `translate`, and that is the only way it moves the drag. A resize behavior answers bounds
  (`ResizeMoveResult.pose`) and a rotate behavior an angle or a pose (`RotateMoveResult`). A `scale`
  about a pivot cannot say everything bounds can: a constraint that slides the box without resizing
  it has no pivot. Left to rule: drop the two arms, or have resize and rotate answer a transform.

## Viewport

- **(P3) Views do not nest.** A view paints and routes the surface's own stack, never another view,
  and a loupe magnifies the canvas's camera — aimed over a `<CanvasView>` panel it shows and edits
  the canvas's world, not the panel's. Composing would mean a view's camera derived from the view
  under its aim, and a resolver that descends rather than picking one rect.

---

## Paths & booleans

- **(P3) svg import: absolute and turned glyph positions are not read.** A `<tspan dx>` list is
  read as letter spacing (`packages/svg/src/glyphShifts.ts`). `rotate`, list-valued per-glyph
  `x` / `y`, and a `dx` on `<text>` itself are not applied; each warns
  (`packages/svg/src/tspanLines.ts`). Kerned text exported with an `x` per glyph imports with the
  glyphs run together: turning a position into a letter spacing or a space needs the advance of
  the glyphs before it, which a parse with no face loaded cannot measure.
  `serializeSvg` writes no line height either, so a pitch read on import is dropped on export
  unless a caller carries it, as WeaselDraw does in `wd:line-height`.

### Path editing tricks

- **(P3) `renderSceneToPixels` draws annotation layers.** The SVG export leaves them out through
  `isAnnotationNode`; a headless raster draws whatever the scene holds. Undecided: whether a raster
  is an export, and so skips them, or a view of the canvas, and so keeps them.
- **(P1) Rename the path tools the maintainer deferred to the end of the adoption pass.**
  Envelope mesh becomes Cloth warp, among others; the Width tool is already Girth. They live in
  `@weasel-js/path-tools` now (`packages/path-tools/README.md`); the move kept every name.
- **(P2) Tune the Simplify brush hands-on, with the maintainer driving.** It went in from its
  audition lab with first-draft behavior and keys: brush size and its key, the tolerance it
  applies, and how it shows what it will remove (`packages/path-tools/src/simplifyBrush/simplifyBrush.ts`).
- **(P2) Tune the curvature comb hands-on, with the maintainer driving.** First-draft default
  scale and density, when it shows, and no key to toggle it (`packages/path-tools/src/comb/comb.ts`).
- **(P2) Tune Balance handles hands-on, with the maintainer driving.** First-draft behavior: a
  grip drag scales both handles by one factor, read off the pointer's projection onto the line the
  grip slides along, and a length lock (`handleLock.length`, or Mod) holds it still
  (`packages/geom/src/paths/balanceHandles.ts`, `packages/path-tools/src/balance/handleBalance.ts`). Its look: a purple
  line between the handle tips and a 4px hollow grip, drawn under the anchor markers and beaten by
  them on a press (`packages/path-tools/src/balance/balanceMarks.ts`). Off by
  default under `path-edit.balance`, with no key to show it, and Equalize handles has only the
  grip's double-click (`apps/site/demos/BalanceHandlesLabDemo.tsx`).
- **(P2) Tune handle locks hands-on, with the maintainer driving.** Which locks deserve keys, and
  whether a lock holds through a modifier drag (`handleLock.*`, `packages/path-tools/src/handleLocks/handleLocks.tsx`).
- **(P2) Tune Bridge hands-on, with the maintainer driving.** First-draft default Tension (0.4,
  `DEFAULT_BRIDGE_TENSION`), how Tension is reached outside the lab, and the Mod+Shift+J binding
  it shares with Bridge anchors (`packages/path-tools/src/bridge/bridge.ts`).
- **(P2) Tune Harmonize curvature hands-on, with the maintainer driving.** First-draft behavior:
  it keeps the product of each anchor's two handle lengths, takes every smooth anchor when none is
  selected, and skips anchors the curve inflects through (`packages/geom/src/paths/harmonize.ts`,
  `packages/path-tools/src/harmonize/harmonize.tsx`). It has no key of its own; its lab tunes H onto it,
  which the Hand tool also answers wherever that tool is mounted
  (`apps/site/demos/HarmonizeLabDemo.tsx`).
- **(P2) Tune anchor selection along the path hands-on, with the maintainer driving.**
  First-draft behavior and keys: `]` grows and `[` shrinks by one anchor, Alt+N selects every Nth
  (N defaults to 2, counted from the first selected anchor, with no UI for N outside the lab's
  `tune`), Alt+C corners, Alt+M smooth anchors, and Alt+I the complement; grow and shrink stay
  within a subpath, and none of them is an undo step
  (`packages/path-tools/src/anchorSelect/anchorSelect.ts`, `packages/geom/src/paths/anchorSelection.ts`).
- **(P2) Tune Resample hands-on, with the maintainer driving.** First-draft behavior: no key,
  driven only as an ongoing action; a count of 0 keeps the path's anchor count, corners are held
  by default, the refit tolerance is 0.5 and a piece that misses it is halved up to six times, so
  the result can hold more anchors than asked for (`packages/path-tools/src/resample/resample.ts`,
  `packages/geom/src/paths/resamplePath.ts`).
- **(P2) Tune Add extremes hands-on, with the maintainer driving.** First-draft behavior and key:
  Alt+X adds to segments whose two ends are both selected, or to the whole path while no anchor
  is, so a selection reaching no whole segment does nothing; the new anchors join the selection
  (`packages/path-tools/src/extremes/addExtremes.ts`, `packages/geom/src/paths/extremaAnchors.ts`).
- **(P2) Tune corner shape hands-on, with the maintainer driving.** First-draft behavior and keys:
  a widget sits 14 screen px inside each corner anchor, past the middle of its cut, and is hit
  within 6px; anchors within 0.05 rad of straight get none. A widget drag sets the radius from the
  pointer's travel along the bisector, every selected corner's when its anchor is selected, and a
  corner with no spec takes `round`. Giving a sharp corner a shape cuts a quarter of its room
  (`DEFAULT_CORNER_TRIM_SHARE`). `cycleCornerShape` has no key of its own (its lab tunes K onto it, the
  Slice tool's key elsewhere), `setCorners` is reached only through the panel, the
  panel's curvature slider spans -4 to 4, and the widgets show by default under
  `path-edit.corners` with no key to hide them (`packages/path-tools/src/cornerShape/`,
  `packages/geom/src/paths/cornerShape.ts`, `apps/site/demos/CornerShapeLabDemo.tsx`).
- **(P3) Offset path leaves slivers beside a curve, and spikes where a round corner shrinks to
  nothing.** `offsetPath` (`packages/stroke/src/offsetPath.ts`) unites the region with its stroke
  band, and the union keeps thin leftovers of the two meeting along the curve:
  `offsetPath` of a 100×100 square with a 20-unit round corner, grown by 10, answers six subpaths,
  five of them slivers. Grown by exactly the corner's radius, the outline also runs a spike into
  the interior, so that corner cannot be kept as a corner.
- **(P2) Tune Blend, Bend along a path, and Repeat along a path hands-on, with the maintainer
  driving.** First-draft step counts, spacing, and turn defaults, their keys, and how an effect is
  re-edited and expanded (`packages/path-tools/src/pathEffects/`, and core's `features/pathEffects/`).
- **(P2) Tune Trim segment hands-on, with the maintainer driving.** First-draft click reach (6
  screen px, `DEFAULT_STROKE_REACH_PX` in `packages/path-tools/src/shared/scenePaths.ts`), the preview's look (the
  `cut` overlay role's red dash at width 3, `packages/path-tools/src/trim/piecePreview.ts`), and its tool key,
  Y (`packages/path-tools/src/trim/useTrimTool.ts`). The `trimPath` action itself has no key.
- **(P2) Tune Extend to next path hands-on, with the maintainer driving.** First-draft click reach
  (the same 6 screen px as Trim segment, `packages/path-tools/src/shared/scenePaths.ts`), that a curved end grows a
  straight run rather than following its curvature (`lengthenOpenEnd`, which is Lengthen's
  `lengthenPathEnd` in tangent mode, `packages/geom/src/paths/lengthenPathEnd.ts`), no preview of where an end will land, its tool key, U
  (`packages/path-tools/src/extend/useExtendTool.ts`), and no default key for the `extendToMeet` action; the
  lab binds E through `tune`.
- **(P2) Tune Lengthen hands-on, with the maintainer driving.** First-draft behavior and keys: the
  tool toggle has no key; a plain drag grows along the end tangent and Shift along the end
  curvature (the `mode` param flips which); a curvature arc stops at a full turn, and a trim always
  leaves a thousandth of the subpath (`packages/geom/src/paths/lengthenPathEnd.ts`); an end is
  pressed within 8 screen px, the cursor is `penPlus`, nothing previews where a drag will land
  before it starts, and the end anchor is left selected after a drag
  (`packages/path-tools/src/lengthen/lengthenPath.ts`). Its toolbar glyph, `path-tools:lengthen`, has
  not been proofed large.
- **(P2) Tune the Smudge brush hands-on, with the maintainer driving.** First-draft brush radius
  (40 screen px) and strength (0.6) (`DEFAULT_SMUDGE_RADIUS_PX`, `DEFAULT_SMUDGE_STRENGTH` in
  `packages/path-tools/src/smudge/smudgeBrush.ts`), the falloff `(1 − (d/r)²)²` and the subdivision threshold of a
  third of the radius (`packages/geom/src/paths/smudgePath.ts`), how radius and strength are
  reached outside the lab, and its tool key, S (`packages/path-tools/src/smudge/useSmudgeBrushTool.ts`).
- **(P2) Tune path constraints hands-on, with the maintainer driving.** First-draft behavior and
  keys: `constrainAnchors` and `unconstrainAnchors` have no default keys (the lab binds C and
  Shift+C through `tune`), and which kind C adds is a param with no UI outside the lab
  (`packages/path-tools/src/constraints/anchorConstraints.ts`); the marks' look, their 12 px offset and 8 px click
  reach, and their teal and red (`packages/path-tools/src/constraints/constraintGlyphs.ts`,
  `packages/path-tools/src/constraints/constraintsExtension.ts`); a drag frame the constraints cannot hold in is dropped, so
  the path sticks rather than giving way (`edit-anchors/action.ts`); how far a dragged anchor
  yields to the rest (`HELD_MOBILITY` in `packages/geom/src/constraints/solve.ts`); and that the
  whole-path commands drop the list rather than keep what still applies
  (`pathCommands/pathNodes.ts`).
- **(P2) Tune Perspective and free distort hands-on, with the maintainer driving.** First-draft
  corner handles (8 screen px squares, 8 px hit reach, `packages/path-tools/src/warp/warpHandles.ts`), that a
  new distort starts Free rather than Perspective, the refit tolerance (0.5,
  `DEFAULT_WARP_TOLERANCE` in `packages/path-tools/src/warp/warpTargets.ts`), and its tool key, F
  (`KEYS` in `packages/path-tools/src/warp/useWarpTool.ts`). Its label lives in `WARP_LABELS` beside it; the
  name may change.
- **(P2) Tune Envelope mesh hands-on, with the maintainer driving.** First-draft 3 by 3 Bicubic
  mesh (`DEFAULT_ENVELOPE_SIZE`, `packages/path-tools/src/warp/warpTargets.ts`), the grid lines drawn
  between mesh points (`packages/path-tools/src/warp/warpHandles.ts`), that Rows and Columns change only
  through `configureWarp`, and its tool key, Shift+F beside Distort's F, since draw's crop mode holds C
  (`packages/path-tools/src/warp/useWarpTool.ts`).
- **(P2) Tune Puppet warp hands-on, with the maintainer driving.** First-draft pin falloff (1, so
  weights go as 1/d², `rigidPuppetMap` in `packages/geom/src/warp/puppet.ts`), that a click on the
  selection adds a pin and Alt-click on a pin takes it out, the pin dots (5 screen px radius,
  `packages/path-tools/src/warp/warpHandles.ts`), and its tool key, B
  (`packages/path-tools/src/warp/useWarpTool.ts`).
- **(P2) Tune draw's Symmetry toggle hands-on, with the maintainer driving.** Its key, the default
  kind and copy count, and where a new group's center lands (`toggleSymmetry`,
  `apps/draw/src/useSymmetry.ts`).
- **(P2) Tune the Measure tool hands-on, with the maintainer driving.** First-draft behavior and
  keys: its tool key, M, which moved Envelope mesh off it when the two met in draw; the Shift angle
  step; that Move by and Rotate by fall back to the newest measurement when none is picked; and the
  readout's look (`packages/core/src/tools/builtin/measure/`, `<MeasureReadout>` in `@weasel-js/ui`).
- **(P2) Tune path start and direction hands-on, with the maintainer driving.** First-draft
  behavior and keys: `setPathStart` and `reversePath` have no default keys, an open subpath's
  interior anchor cannot become its start, and the direction marks' look (a 9 px orange arrow per
  segment and an 8 px start ring, `DIRECTION_DEFAULTS`), off by default under
  `path-edit.direction` with draw's View toggle as the only switch
  (`packages/path-tools/src/pathStructure/`, `apps/draw/src/usePathDirection.ts`).
- **(P2) Tune segment type hands-on, with the maintainer driving.** First-draft behavior and keys:
  a curved segment's handles start at its thirds, Shift+C with no `to` flips the lot by whether
  any is straight, and Shift+double-click flips one segment
  (`packages/path-tools/src/segmentType/convertSegments.ts`). Shift+C is also what the path
  constraints lab tunes onto `unconstrainAnchors`.
- **(P2) Tune anchor fields hands-on, with the maintainer driving.** First-draft behavior: the
  panel shows X and Y for any selection and handles only for a lone anchor, a typed handle mirrors
  on a smooth anchor, `+=`/`-=` offsets each anchor by its own amount, and draw shows it at the
  top of Properties in points (`packages/ui/src/components/AnchorFields/`,
  `packages/geom/src/paths/anchorFields.ts`, `apps/draw/src/RightSidebar.tsx`).
- **(P2) Tune the Girth tool hands-on, with the maintainer driving.** First-draft behavior and
  keys: Shift+W in draw; how near an edge a press must land to grab it; Alt moving one edge alone
  and Alt-click clearing a width point; and whether a press between anchors should insert one
  (`packages/path-tools/src/girth/`).
- **(P2) Tune path snapping hands-on, with the maintainer driving.** First-draft behavior and
  keys: an 8px radius with every kind on, `nearest` included; that a path target beats
  `snapTargets` and `snapPoint`, so in range it wins over measurement ends and the grid, a move's
  grid behavior included; that a move and an anchor drag snap to targets only, never `snapPoint`; no key or modifier to turn it off mid-gesture;
  the marker's glyphs, its fixed orange, and where its label sits; and that draw does not turn it
  on yet (`packages/core/src/features/paths/pathSnap/`, `packages/geom/src/snap/`).
- **(P2) Two kit key bindings are chords a browser takes first.** `createOutlines` is on
  Mod+Shift+O (Chrome's bookmark manager) and `averageAnchors` on Mod+Alt+J (Chrome's console),
  so neither fires there. `browserReservedBindings.test.ts` pins the pair, so a new collision
  fails it; moving these two is a choice of new keys.
- **(P3) Roughen, zigzag and pucker/bloat exist only on the `pel-effects-push` branch.** That
  branch stored effects as a `data.effects` list on the path itself, a design main did not take
  (`f082c838e` adopted its push brush as Smudge and left the rest). Its math is in
  `packages/geom/src/effects/` there; carrying the three over means rebuilding each as a derived
  effect node beside blend, bend and repeat. Undecided whether to; the branch is kept until then.
- **(P3) A dependency that is itself derived reaches a derivation in its own frame.** Under a
  composing strategy a derivation is handed each dependency's pose in the deriving node's frame
  (`core/scene/depFrame.ts`), but a dependency's `path` — a blend whose source is another effect —
  is not carried across, so an effect of an effect in another container reads that path where
  its own container would put it.
- **(P3) A blend's spine is fixed when the blend is made.** `BlendEffect` takes a spine as an
  optional third source (`[from, to, spine]`), and Blend reads it from a third selected shape;
  nothing adds, swaps, or removes the spine of an existing blend.
- **(P3) Some path commands have no icons.** `resamplePath`, the anchor selection commands,
  `setSpiroKind`, `releaseSpiro` and draw's own `view.pathDirection` toggle show as text in draw's
  bar. The warp labs' tool lists borrow `ui:fitStretch`, `ui:grid` and `ui:pin` rather than the
  warp tools' own glyphs. `core:retractHandles`, `core:symmetricHandles`, `core:simplifyBrush` and
  `core:harmonize` (`packages/core/icons/anchor.mjs`) and `path-tools:spiro`
  (`packages/path-tools/icons/tools.mjs`) are first drafts, not proofed at high resolution.
- **(P3) A puppet warp's bends add anchors.** The puppet map (`packages/geom/src/warp/puppet.ts`)
  is piecewise affine over its mesh, so `warpPath` gains anchors where an edge crosses triangles
  that turned differently. A smooth interpolation of the solved vertices would refit with fewer.
- **(P2) A constraint link has no gesture that makes it, and only path edit keeps it.** A link
  node (`constraintLinkNode` in `@weasel-js/path-tools`) ties nodes, and every path edit of one
  solves them all together, but path edit opens one node at a time, so nothing in the UI picks an
  anchor in one node and a segment in another; a consumer adds the node itself. A whole-node move,
  resize, or rotate solves no links, and nothing reports one it breaks: `constraintConflictsOf`
  reads a node's own list. The drags that preview through `pathEditPreview` without finishing each
  frame — bend segment, corner, Lengthen, Balance, Simplify brush — commit the linked nodes but
  do not preview them, as they do not preview a node's own constraints.
- **(P3) WeaselDraw binds no constraint action.** It needs keys or a bar group for
  `constrainAnchors` and `unconstrainAnchors`, and icons for them.

### Pathfinder follow-ups (post-v1)

- **(P3) Create Outlines refuses synthetic-bold text.** `textToPath` answers `reason: 'synthetic-bold'`: emboldening it is a union with the glyphs' own outline stroke, but the width has to match what the renderer's distance-field shift (`SYNTH_BOLD_AMOUNT`, `packages/renderer/src/draw/text.ts`) draws. Read from `glyphCoverage` and `glyphFieldScale` (`packages/font/src/textSdf.ts`) and not measured against pixels: the shift moves the edge out by `SYNTH_BOLD_AMOUNT` of the field's span, which is `distanceRange` texels in a baked atlas and `SDF_RADIUS` in a runtime canvas page, and a texel is `1 / info.size` em, so the outline grows by `SYNTH_BOLD_AMOUNT × span / info.size` em on each side and differs by which tier serves the glyph. What is left: `textToPath` (`packages/text`) has no stroke outliner to call, since `strokeToPath` is in `@weasel-js/stroke`, which text does not depend on; the union flattens every curve of the glyph; and the result has to be compared with the field in a browser.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** The booleans flatten beziers before clipping (`packages/geom/src/booleans/adapter.ts`), so the result is straight-line. Skia/PathKit-style curve-preserving booleans are substantially harder.
- **(P3) Preview a Boolean operation by holding its key over a path.** Hovering or focusing a Pathfinder button shows the pieces it would make (`Action.preview`, drawn on the `previewPaths` dep). No Pathfinder action has a key or gesture to hold, so nothing asks for a preview from the canvas, and the pieces show as outlines rather than in the paint each would take.

---
- **(P3) draw's SVG files do not carry layers.** A saved file keeps paper size, title, groups, and
  line height under the `wd:` namespace (`apps/draw/src/svgInterop.ts`) but no layer list and no
  layer id on a shape; export only leaves hidden layers out (`svgExport.ts`). Nothing is lost yet:
  draw has the one layer, `'default'` (`WeaselDrawLayer`, `drawDocument.ts`), and no way to add
  another, and `openSvg.ts` puts every node on it. Whether a page has its own layers is undecided,
  and the file format waits on that.

## Rendering & paint

- **(P3) Pattern fills: no image-upload patterns.** WeaselDraw's picker covers the four built-in
  tiles only, each a paint kind of its own (`{ kind: 'hatch', color }`). A user-supplied bitmap
  needs a paint kind that persists the image itself (data URI, or a document-scoped asset table),
  which is a storage question rather than a paint one.

- **(P3) No marker icons.** `defaultNodeProperties`'s `markerStart` / `markerMid` / `markerEnd`
  leaves use a labeled `select`, where the sibling stroke enums (`cap`, `join`, `align`, `dash`)
  are icon toggles. The marker glyphs have to be authored to this repo's icon standard.

- **(P3) Renderer: geometry far from the origin is still single precision.** The transform stack
  is in doubles, a large model translation is rebased before upload (`setProjAndModel`,
  `u_origin`), and a gradient's or a pattern's paint space is rebased the same way (`bindGradient`
  measures from the gradient's own start, `bindPattern` drops whole tiles). Both are proven by
  float32 arithmetic (`draw.precision.test.ts`, `draw.paintPrecision.test.ts`), not in a browser;
  `gradientStart.browser.test.ts` checks where a ramp lands and has not been run. Still float32:
  a path's own coordinates (`PolygonPath.coords`, `Mesh.vertices`), which at world x = 262,144
  sit on a 1/32 world unit grid, 2 px at 64x, so a tessellated shape is quantized where a batched
  rect (doubles) is not; and what a consumer's own stage receives, which has no origin to rebase
  against: the model (`u_view` on a shader command, `u_model` in a registered paint kind) and the
  paint matrix a registered kind asks for (`PaintBindContext.spaceInverse`). The first cannot be
  fixed in tessellation alone: `PolygonPath.coords` is a `Float32Array`, so the grid is already in
  the path before the tessellator reads it. It needs the path itself to carry an origin (or
  double coords), which every reader of `coords` would then honor.

---

## Text

- **(P3) The edit overlay's text lands on whole CSS pixels; the canvas's does not.** The overlay
  cannot follow a fractional canvas baseline: moving its `top` by 0.4px moves its ink by exactly
  1px in Chromium at DPR 1, and the matrix rows of `scripts/measure-overlay-alignment.config.ts`
  show the same jump in WebKit, Firefox, and at DPR 2. That rounding is the whole of `dy` there
  (mean |dy| about 0.2px, max 0.75), and why `overlayAlignment.browser.test.tsx` allows
  `DY_TOLERANCE = 0.85`.

  Nothing on the overlay's side can carry the fraction (headless Chromium, DPR 1, macOS): with
  `top` floored and the remainder on `transform: translateY()`, every case's `dy` was the same to
  two decimals, with and without `will-change: transform`. The steady ink bias of about -0.35px
  the matrix rows suggested did not show: stepping the pose's `y` through a pixel in eighths gave
  a rounding sawtooth (Inter 40px from +0.43 to -0.42) whose mean was -0.01 for Inter 40px, -0.02
  for Inter 16px, -0.07 for Arial 40px, and -0.14 for Georgia 23px. Not checked in WebKit,
  Firefox, or at DPR 2. What is left is a ruling: snap the canvas's text baseline to device pixels
  as browsers do, which moves all canvas text, or keep the half pixel.

- **(P3) WebKit at DPR 1 fails one overlay-alignment case, because it paints text on whole
  pixels.** `"Hgd" Inter 72px small caps` reports `dRight -0.79` against the 0.75 bound in
  `npx vitest run -c scripts/measure-overlay-alignment.config.ts`; Chromium and Firefox pass it at
  both DPRs, and so does WebKit at DPR 2. CI runs Chromium only, so nothing gates on it. It is not
  advances, small-caps synthesis, or `text-rendering`: WebKit's DOM width of `GDGDGDGDGD` matches
  the atlas to 0.001px at 54.024px (the small-caps size), and turning off `font-variant`, kerning,
  or `geometricPrecision` on the overlay moves no pixel. WebKit floors a text box's paint origin
  to the device-pixel grid: the small capitals sit in their own span, which starts at x 73.5 and
  paints from 73, so `G` and `D` land 0.44 and 0.69px left of the canvas's. Not compensable from
  the overlay as far as measured: a WebKit-only half-device-pixel `translate` fixes this case but
  moves WebKit DPR 1's matrix mean `dx` from -0.14 to +0.36 and fails three other cases, and a
  0.492px nudge on the small-caps span alone moved `D` a whole pixel and `G` not at all.

- **(P3) At 12px with a script, the atlas tier's ink still sits ~0.55px off the overlay's at DPR
  1, and the sign follows the sub-pixel phase.** `dx` is −0.5 at `x` 20 and +0.5 at 20.5 in every
  engine; DPR 2 agrees within 0.06. The stems of a 7.2px `H` are ~0.65px wide, and the shader
  reads coverage from the distance at each pixel's center, so a stem centered on a pixel carries
  about twice the ink of one straddling two. Center-sampled coverage cannot do better; area
  coverage would need several field taps per fragment on small glyphs. The same rows show `dy` of
  ±0.45, which is unexplained. The `super`/`sub` 12px rows of
  `npx vitest run -c scripts/measure-overlay-alignment.config.ts` show both.

- **(P3) Complex-script text shaping (HarfBuzz).** `packages/text/src/layout/layoutEntries.ts` looks
  glyphs up one code point at a time and applies kerning pairs: sufficient for Latin, Cyrillic,
  Greek, and CJK ideographs, wrong for Arabic, Devanagari, Thai, and any script needing contextual
  shaping. The fix is a HarfBuzz WASM build (harfbuzzjs, ~1MB) behind a feature flag, so consumers
  who only need Latin stay slim. It touches the layout pipeline only; the renderer already takes
  pre-laid glyphs. Shaping is also what real small caps needs: `fontVariantCaps: 'small-caps'` is
  synthesized (capitals scaled by x-height over cap height), and a face with an `smcp` feature
  should get its own small-cap glyphs instead.

- **(P3) Text direction: the Align bar has no segment for `start` / `end`.** Under a stated
  `direction` they light the edge they resolve to; under `auto`, where each paragraph takes its
  own from its first strong character, they light nothing. A click on any segment still writes an
  edge over the reading-order value. Giving them segments of their own takes two glyphs, which
  have to be drawn and proofed in a browser (`packages/core/icons/text.mjs`).

- **(P3) Icons: the size family and `orbit` collapse at 16px 1x.** `taller`, `shorter`, `wider`,
  `narrower`, `tallest` and `shortest` carry two short arrows each, and at 16 device pixels the
  heads close up into dots; `orbit`'s head does the same against its ring. All resolve at 2x.
  They want heads on the pixel grid, or fewer of them (`packages/ui/icons/size.mjs`,
  `camera.mjs`). The straight arrows drawn before the 45-degree rule in CLAUDE.md ("Drawing
  icons") still use spreads of 36 to 42.

---

## Scene, adapters & layout

- **(P3) A layer hidden only in one view still shows its diagram ports.** `sceneParticipants`
  (`packages/diagram/src/portLayer.ts`) gates ports on the scene's own hidden and locked flags
  through `nodeGates`, but a canvas's `layerVisibility` (read by `pickWalk.ts` and
  `sceneViewRender.ts`) never reaches the port layer, so ports float over a layer that view hides.
- **(P3) A direct scene call made while a journal is open lands on the scene's own stack.**
  `scene.applyBatch` goes to the open journal; `scene.setPose` and its siblings, `scene.batch`, and
  `scene.history.apply` do not, so a mode that mixes the two splits its edits across two stacks.
  Ruled 2026-10-12 to leave it for now. Routing them means `recorder.record` and the history facade
  consulting the journal accessor. `scene.recordedForm.test.ts` pins today's split. Routing `scene.batch` also needs a new method
  on `Journal`: `batch` records ops that have already applied (`engine.recordEntry`), and `Journal`
  has only `applyBatch`, which would apply them again; a direct call that touches a laid-out
  container runs as a batch. draw opens a journal in every strict mode, and in every soft mode
  unless the Modes > Undo inside a mode pref says the document's history
  (`apps/draw/src/modality/machine.ts`), so the change moves where every direct call made during
  a mode lands.

### Symmetry follow-ups

- **(P3) Wallpaper tilings.** A new kind is a row in `SYMMETRY_KINDS`
  (`packages/symmetry/src/kinds.ts`), but a lattice has no last copy: `copiesFromPose` sees only
  the container's pose, so it would need an extent to tile within, which the spec would carry.
- **(P3) The angle knob sits on the shapes it turns.** It is fixed 64px out along the axis, where
  the lab's petal is, and can cover a path-edit handle there.

### Derived geometry follow-ups

- **(P3) The preview channel still carries pose twice.** `move` / `resize` / `rotate` publish each
  frame to the scene's pose overrides *and* keep their own `previews` map behind `previewIds` /
  `previewPose`. The overrides are what the scene reads (derived geometry, picking); the map is
  what the ghost layer and the selection-chrome bounds read. Collapsing them means teaching those
  two readers to resolve through `effectivePose`, after which the map is redundant for pose. It
  cannot go entirely: `previewData`, a path-anchor drag's in-flight `data`, has no override
  equivalent, and `PoseOverride` is `{ pose?, alpha? }`. Decide whether overrides grow a `data`
  field or the two channels stay split by what they carry rather than by who writes them.

### `useScene` follow-ups

- **(P3) A scene and its canvas each say how a pose is measured.** A container's layout
  (`ContainerNode.layout`) is measured by `UseSceneOptions.layoutFrame`, and everything a canvas
  does by its `poseDescriptor` prop, so a scene whose poses are not rects states it twice. The
  scene owns composition (`useScene({ composition })`); the descriptor could move there the same
  way, with the layout frame read from it.
- **(P3) A scene composes poses only when asked to.** Ruled 2026-10-11: the scene owns
  composition: a child's pose is relative to its container's frame, and moving a container writes
  one pose. The scene owns it now (`useScene({ composition })`, read everywhere as
  `scene.composition`), but the default is still the absolute-pose model, where `sceneToAdapter`
  translates every descendant of a moved container (`cascadingSetPose`,
  `packages/core/src/canvas/poseCascade.ts`) and `Scene.setPose` on a container leaves its
  children behind. Making a frame the default deletes that walk and the identity branches beside
  it. It needs an answer for a scene whose `TPose` is not a rect (`RIGID_POSE_COMPOSITION` reads
  `x`, `y`, `width`, `height`), and it rewrites every stored child pose as local: `apps/draw`'s
  saved documents and SVG import, `packages/diagram`'s layouts, and the tests that build a
  container with children, about ninety files.

### Container layout strategies

- **(P3) Reparent-on-layout-drop lives in the move action's `layoutDrop` behavior
  (`actions/move/commit/layoutDrop.ts`), not the strategies' `commitDrop`** (which are pose-only),
  as does choosing the destination container (`<SceneCanvas layoutDropTarget>`,
  `LayoutStrategy.dropRegion`). If a strategy needs container-specific reparent semantics, revisit
  whether `commitDrop` should own it.
- **(P3) Nothing scrolls a `'scroll'` tile grid.** `tileGrid({ overflow: 'scroll' })` places its
  overflow past the container's last visible line and reports the region through
  `LayoutStrategy.contentExtent`, but no kit host reads it: the overflow just sits past the
  container's bounds. Ruled 2026-10-11: a container's scroll offset is view state, part of the frame
  the container gives its children, and the document never moves. A scene that composes poses
  (`useScene({ composition })`) has that frame; an absolute-pose scene has none, and is the
  default until "A scene composes poses only when asked to" lands. That leaves the offset itself,
  folded in by painting, picking, selection chrome, move, resize, and snapping with the rest of
  the frame, and a host that reads `contentExtent` and scrolls.

### Units

- **(P3) Per-subobject scale: nothing in the kit reads a container's unit scope yet.** A container
  declares one (`ContainerNode.units`), and `sceneUnitScopes(scene, id, root)` answers the chain
  `resolveScoped` and `formatScoped` take. What is left is the readers. `gridSnapStrategy`,
  `createGridLayer`, `createCellHighlightLayer`, and `useGridCellHover` in `packages/guides`
  resolve their spacing against one `unitSystem` option, and a snap strategy is handed a gesture
  context with an adapter but no scene, so the adapter needs a scope read before a grid inside a
  millimeter sub-assembly can snap in millimeters. A property field's unit is built from one unit
  system (`prefUnit` in `packages/prefs/src/unit.ts`), whichever node it is showing. And a scope's
  `scale` only converts values: `RIGID_POSE_COMPOSITION` does not scale a container's frame by it,
  so whether a scoped container's children are also stored in its units is undecided.

---

## Animation

### Combining animations

Animations combine through targets, described in `docs/concepts.md` ("Animation target").

- **(P3) A target table row is read by itself while an animation is behind a hold on it** —
  a row is shown by the table's pass over its columns (`fill` in
  `packages/animator/src/targetTable.ts`) except while a tween or spring with a destination
  runs under a hold on it, and while something a stopped animation left waits beside a hold:
  then it is read at a single target's cost. What a hold hides of such a move is worked out
  per animation and per axis (`hidden` in `packages/animator/src/target.ts`), which the pass
  has no column for, and blits weighs a voice whole, so the hidden share cannot ride on the
  animation's own voice.
- **(P3) A hold whose value is a function costs 0.3 to 0.7 µs a frame, where a tween costs
  under 0.1** — `node tests/perf/target-reads/run.mjs table 10000 heldfn`. A timeline track, a
  rig clip, and any `animator.hold` given a function are such holds; a hold of plain values is
  not. What a function costs, from the CPU profile at 10,000: a quarter is blits running a
  voice that answers through a function (`rows`, `call`, `foldInto`, `ready`, and a `WeakMap`
  read per voice); the rest is the hold's own voice reaching, one after another, the group,
  each member, the function that gives its value, that value, and the committed value. The
  design left would move it and is not started: holds on a target table's rows could keep
  their values and weights as rows of the table's own arrays, which adds public API to the
  table whose shape is not ruled on.
- **(P2) Take the blits release that makes stopping an animation cheap.** With 100 animations
  restarted a frame, a cancel cost 5 µs with 1,000 running and 21 with 10,000, because blits'
  `forget` walked every subject the mix held. blits `b97c8c1` (unreleased, on 0.10.0) stops that:
  measured inside blits with `node bench/restart.mjs 1000 10000`, a stop went from 15.4–15.7 µs to
  2.4–2.9 at 10,000 and the frame after from 1.99–2.15 ms to 1.26–1.43. `animator`, `core`, and
  `labkit` pin `@msb235/blits` at exactly 0.10.0, so nothing reaches weasel until blits releases
  and the three pins move. blits' changelog holds a breaking change for that release, `loop`
  defaulting to one pass, so every `cue` here that leaves `loop` out needs reading first
  (`packages/animator/src/engine/holdVoices.ts` has one). After the bump, rerun
  `node tests/perf/target-reads/run.mjs churn 1000 10000`, which has not been run against the fix.

- **(P3) Playing an animation backward** — a time scale below 0 is refused where it is set
  (`timeScaleOf`, `engine/table.ts`). Playing backward needs the animator's clock to keep going
  forward and hand each voice a rate below 0, which blits 0.9.0 ends where the voice started,
  and an answer for what a tween run back to its start does: a blits voice past its start
  reads 0, which for a tween on a target is its destination.

### Earlier deferrals

From `docs/specs/2026-05-04-animation-primitive-design.md`:

- **(P3) GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts.

---

### labkit presentation mode

- **(P3) agnew plays from its own transport, not a lab clock.** agnew and rosee both mount
  `<Lab>` on their `main`. agnew's three.js view advances the pen itself and holds a finished curve
  before redrawing it, so moving it onto a lab clock is an agnew library change, and the owner's
  call.

## Audio

- **(P3) Nobody has listened to the side-scroller's music bed.** `MUSIC_GAIN`
  in `usePlatformerAudio.ts` is set by measurement, to the RMS of the render
  the bed replaced, and `platformerBed.browser.test.ts` holds it there. What is
  left is the bus gain chosen by ear, or `createCompressorEffect` on the music
  bus in its place.

- **(P3) Nobody has listened to the generative score.** Every number
  `scoreParams` maps a mood through was chosen from descriptions of the four
  cues and is tested as structure only. Whether dread reads as dread is for
  ears: the `score` demo (`apps/site/demos/ScoreDemo.tsx`) plays each cue with
  its parameters beside the sliders.

- **(P3) AudioWorklet voices** — immune to main-thread jank. What a stall
  delays is the callback that makes a voice's nodes, which has to run on the
  main thread, so immunity means synthesizing the voices inside a worklet
  processor from events posted ahead of time. The synthesis is built:
  `createNoteKernel` and `createNoiseKernel` (`voiceKernel.ts`) render what
  `playNote` and `playNoise` play, a block at a time, and
  `voiceKernel.browser.test.ts` holds them to the node graph. What is left:
  - a processor that mixes kernels onto a bus from posted events. A worklet
    cannot import the package's bundle, so the kernel has to reach it as source
    text, which needs a build step.
  - the engine's side. A worklet voice's handle, pool slot, steal, pan, and
    position have to behave as a node voice's do, and `createAudioEngine.ts` is
    one 611-line function at its size ceiling, so this starts by splitting it.
  - a browser test that blocks the main thread and hears no gap.

---

## Selection, actions & UI panels

- **(P2) The Properties W and H fields go under a node's `data.minSize`.** The insert and place
  actions, the resize handles, and a replayed scale all hold a node to it (`core/scene/minSize.ts`,
  `resize/minimum.ts`); typing a smaller W into the `pose.width` field does not, because a
  `PrefNumber`'s `min` is one static number for every node, and the field's write sees the pose,
  not the data the minimum lives in. Needs a per-node bound in `@weasel-js/prefs` that the
  selection panel resolves against the node.

- **(P2) `ThemeProvider` drops a `selection.mode` that is not a concrete mode, with no warning.**
  blits' site passed `selection={{ mode: 'auto' }}` and got the theme's default, dark, on a light
  page; it now resolves the mode first with `useResolvedColorMode('auto')`. Either accept `'auto'`
  there and resolve it, or warn in dev on a mode the theme does not have.

- **(P2) labkit's control panels never set their own text color.** Dimmed labels inherit the
  page's ink, so a light page puts dark text on a near-black panel — contrast about 1:1 on blits'
  Patch page. blits works around it with `color: var(--wzl-fg)` on the provider's wrapper (blits
  `ccda71e`, `site/src/styles/site.css`). The panel root should set `color` itself.

- **(P2) Gaps blits hit moving its playground onto labkit's `ControlPanel` and `f` (1.10.1).** Each
  is worked around in blits' `apps/playground/src/app/CompositionControls.tsx` (`DraftRow`,
  `drafted`) and `SpecFields.tsx`; those are the specs for the fixes.
  - Number and text rows write on every keystroke, so one typed value is many undo steps. Use the
    ui fields' draft-and-commit-on-blur; the text draft should also cancel on Escape.
  - `.resettable()` groups write each value through its own `setConfig`: several undo steps, and a
    stale-state race. Write the group as one change.
  - `.dialog()` has no cancel; Escape commits.
  - `showIf` on an enum value that is not among the enum's options throws, which crashed a whole
    panel. Treat it as never matching.
  - A number row cannot be cleared to mean unset/default (blank reverts), and `NumberNode` has no
    min-only bound.
  - `PropertyRow`/`ControlPanel` have no slot for a row's validation message.
  - A section whose rows are all hidden still draws its heading.
  - An `f.action` row repeats the button text as its label, and an action's run cannot reach the
    panel's props.
  - No "changed from baseline" marking; `PrefsForm` has one.
  - `f` boolean and string leaves get the auto-pin toggle on their label unless `.manual()`, which
    is easy to miss. Either make it opt-in or make the default obvious.
  - A custom renderer's context does not carry the config.
  - `ControlMatrix` cannot set a summary for a custom leaf's cell, and first-column inheritance is
    its only model; there is no plain grid.
  - `ListEditor` has no reorder and offers one kind of new entry.
  - `EasingPicker` always renders its own "Easing" label, doubling the row's.
  - In the two-column grid a bar or custom row takes a half cell unless its section is one-up.

- **(P3) The menu bar's default access chord, Alt, is unverified in Chrome on Windows, which may
  open its own menu on Alt+F; check there before relying on it.**

- **(P3) A schema drawn as a menu drops its number and color leaves.** `leafRows` in
  `packages/routing/src/menus/resolveMenu.ts` turns actions, booleans, enums, separators, labels,
  and aliases into rows and answers nothing for any other kind, so the same asset loses controls
  when it moves from a bar or a panel to a menu. draw's Loupe asset shows this: as a menu it keeps
  its switch, mode, and Copy, and loses magnification and the picked color. A number row (an inline
  field, or steps) and a read-only color row would close it.

- **(P3) Shift+F10 / the ContextMenu key may open the menu twice in Chrome on Windows/Linux.**
  The `menu.context` key binding opens it at the selection, and those platforms also send a
  native `contextmenu` event to the focused canvas, which would reopen it at that event's point.
  Headless Playwright sends no such event, so this is unverified. Check on a real Windows or
  Linux Chrome; if it reproduces, the likely fix is for the keydown to suppress the native event.

- **(P4) A headless-component layer shared by DOM and WebGL chrome.** The context menu already
  runs one behavior on both substrates: `@weasel-js/menu` holds its state, keys, typeahead and
  placement, ui's `MenuPanel` and hud's `drawPanel` draw it, and a hud widget's `accessibleTree`
  is the substrate-neutral description its DOM mirror is built from. Generalizing that so buttons,
  lists and other chrome draw on either substrate is several arcs: the roving highlight and
  typeahead as a list behavior not typed to `MenuEntry` (`keys.ts`'s `step`/`firstRow`,
  `typeahead.ts`); focus that means one thing whether it is DOM focus or `hud.focus`; a
  measure/draw contract a DOM component and a hud widget both implement; then porting a button and
  a list onto it. **Open decision before the first arc: where the layer lives.** A new package
  (it needs nothing else from weasel, so it qualifies, and needs a first publish) or
  `@weasel-js/menu` widened and renamed; the first arc moves the list behavior out of `menu` either way.

- **(P3) Should grid and guide snaps line up the stroke?** Decision for the maintainer. The guides
  package's move snaps (`snapToGrid`, `snapToGuides` in `packages/guides/src/behaviors/move`) put
  the dragged pose's origin on a grid line or guide, so a rect with a centered stroke 10 wide
  lands with its stroke's outer edge 5 short of the line. Snapping the drawn box instead would put
  the stroke's edge on it, which is what the selection chrome, resize, and `alignMoveBehavior` now
  measure — and every stroked shape would land half a stroke from where it lands today. The insert
  snaps are a different case and stay as they are: they place the point the pointer defines, before
  the node has a stroke to measure.

- **(P3) Nobody has looked at a theme's prefs schema in a form.** `themePrefsSchema`
  (`@weasel-js/theme/prefs`) is drawn in `PrefsForm` at `apps/theme-editor`'s `#/prefs` page
  (`ThemePrefs.tsx`, "Theme prefs" in the lab menu): a rail page per token group, a color that
  differs by mode split into a member per mode, and a preview of the pinned theme beside it. Built
  and tested in jsdom, not yet looked at in a browser. Nothing drives `applyTheme`'s `weights` from
  an animator either, which is the same gap as the selector weights under "What the split rows in
  `PrefsForm` left".

- **(P3) What the split rows in `PrefsForm` left.** The marks a split leaf draws in a group's
  heading and in a bar cell are tested in jsdom and were never seen. A row that can be split is a
  group and no `<label>`, so an app renderer's control on such a leaf has to name itself: the
  toggle that opens the row is a button on the label line, and a `<label>` would hand its name and
  every click on the label's text to that button. Undecided, and a look to settle in a browser:
  move the toggle out of the label line so the row can stay a `<label>`, or keep it there and
  leave naming to the renderer (`ctx.pref.name`), as a `group` renderer already does. Nothing
  animates a selector's weights yet: `store.get(path, { weights })` is there for an animator
  target to drive.

- **(P3) A removable badge's remove control can wrap onto a line by itself.** On a wrapped `pill` or
  `plain` `Badge`, when the line cannot hold the last word and the control together, the control
  breaks alone and takes its negative margin with it, so it sits left of the line's start. Measured
  in bare markup, not on a badge. A word joiner, a non-breaking space, and `white-space: nowrap` do
  not stop Chromium breaking before an inline-block. Seen once in a screenshot and not read to a
  cause: a removable `pill` with a two-word label wrapped onto two lines in a flex row with room
  to spare. Both need a browser to work in.

- **(P3) Disabled has no signal of its own, now that emphasis is an alpha.** Disabled is `opacity:
  0.4`–`0.5` on the whole control, and subtle text is 0.54–0.64 alpha, so a disabled control and a
  subtle label can read alike. Ruled 2026-10-11: disabled gets a second cue besides fading. Which
  cue is not chosen yet; that leaves choosing it and giving it to every control that fades when
  disabled.

- **(P3) apps/site's body text is still the system face.** It loads `@weasel-js/theme/fonts.css`
  now, but `canvas-kit-demo.css` sets `body { font-family: system-ui, … }`, which beats that
  file's `:root` rule, so only text naming a `--wzl-font-*` token gets the kit's faces.

- **(P3) `QuantityText` draws no kind's MathML form.** `present` hands back `mathml` for a kind that
  has one (a fraction's), and `QuantityText` draws only the HTML form. A number field's string unit
  draws through `QuantityText` now; a unit handed as JSX (`<sup>°</sup>`) is still drawn as given.

- **(P3) labkit and the apps hand-build what weasel-ui already draws.** Each waits on something
  the ui component lacks, or on a look at the result in a browser:
  `.lk-titlebar-button` is 18px square and `Button`'s smallest size is `--wzl-control-h-sm`;
  `.lk-toolbar-button`'s `danger` reddens on hover, which a ghost `Button` has no way to do;
  `SidebarRegion`'s section head and undock button against `SidebarPanel`, which takes no
  `actions`, no undock control, no stance, and no `fill`; `LabHeader`'s bare "Add trial" button,
  which sets its own baseline so its label lines up with the title and would lose that as a
  `Button` with a leading icon; the theme editor's swatch tabs against `ToggleBar`'s flat variant
  and its hex and number inputs against `Input` and `NumberField`.

- **(P3) The site's demos are colored for a dark page.** The demo shell's sidebar has a
  `ColorModeControl` now, dark until a reader picks. Nobody has looked at the pages in light
  mode: demo scenes still draw in colors chosen for a dark page (`#d4c4a8` labels in
  `ViewportDemo`, `AudioDemo`, and other demos), a few rules darken with `rgba(0, 0, 0, 0.2)`
  in either mode, and the front page pins its own theme to dark.

- **(P3) Overlays still set React Aria's deprecated `UNSTABLE_portalContainer`.**
  Its replacement, `UNSAFE_PortalProvider`, is exported by `react-aria` but not
  re-exported by `react-aria-components`, and depending on `react-aria`
  directly risks a second copy whose context the overlays never read — which
  fails silently, as an unthemed overlay. Switch `useOverlayPortal`
  (`packages/ui/src/overlays/portalHost.tsx`) to the provider once RAC exports it.
  The same switch lets a contained `ToastRegion` drop its own region for RAC's,
  which would make it an F6 landmark again. Still absent from RAC's index at the
  installed 1.21.1, at 1.22.1 (the latest), and at nightly `3.0.0-nightly-2691598d3-261008`, last
  checked 2026-10-17.

- **(P3) The loupe's aim is a pair of hand-attached listeners.** `hover` is a gesture
  (`HoverSpec`; `docs/taxonomy.md`, "Gesture"), and with `motion: 'leave'` it says when the
  pointer passes out of its target or off the surface. The loupe
  (`packages/labkit/src/loupe/useLoupe.ts`) still attaches `pointermove` and `pointerleave`
  itself: its lens follows a pressed pointer too, which a hover stands down for, and
  `<LoupeGestures>` mounts its own dispatcher with the pointer channel off. Moving it needs a
  gesture for a pointer's moves pressed or not, or a ruling that the lens holds still through a
  drag. Only jsdom has run a hover binding.

- **(P3) A `carry` spec takes no `target`.** A carry (`startCarry`, `CarrySpec`)
  is matched on the surface as a whole, like an OS `drop`, so a binding cannot
  say "dropped onto a selected body" or onto an affordance: the carry channel
  (`routing/src/interactions/dispatcher/channels/carry.ts`) classifies nothing
  under the pointer. Nor does `Action.enabled`'s `carried` argument see a
  carry's payload; it is typed for ingest items only.

- **(P3) Confirm Safari's trackpad pinch in real Safari.** `useGestureDispatcher`
  dispatches WebKit `gesturechange` as a `pinch` gesture, which `viewport.zoom`
  binds, and swallows ctrl+wheel while a claimed gesture is live. All of it is
  tested in jsdom against a stand-in event. Unverified: that Safari fires
  `gesturestart` before the first ctrl+wheel copy (if it does not, that first
  sample zooms once through the wheel binding), and that preventing
  `gesturestart` / `gesturechange` stops the page zoom in the Safari versions
  that send both channels.

- **(P3) Reconcile `BandEditor` with `Slider`.** `BandEditor` (bands: a contiguous tiling of an
  axis, seams draggable, each band carrying a payload) ships alongside `Slider` (a thumb list on
  an axis, `constraint: 'ordered'`, `onAddThumb`/`onRemoveThumb`, `renderTrack`). Under a
  contiguous tiling the two are the same control — N seams determine N+1 bands, so seams *are* an
  ordered thumb list — and they were kept separate deliberately: bridging them means teaching
  `Slider` about the region *between* thumbs (payload, hit-testing, selection). The other trigger
  is `Slider` needing a non-linear axis. A third option is `windease`: its `LayoutStrategy` is
  public API — `layout()` returns placements plus affordances, `reduce()` folds a gutter drag
  into strategy state — so a band control is a strategy you write rather than a control you
  build, and it brings widened gutter grab targets, `affects` for lock suppression, and
  keyboard-operable gutters with it. It ships no band strategy of its own, and mapping domain
  values onto seams is still the consumer's.

- **(P3) `<ToggleBar>` polish.** Visual still needs polish — literally, polish this, by eye in a
  browser. Measured in Chromium 2026-10-13, three text segments, each variant at `md` and `sm`:
  every segment sits inside its track at one height, none clips its label, and a focused segment
  draws a 2px outline, so nothing measured is known to be off. Since then `minimal` takes its font
  size from `size`, where both sizes drew at the `sm` font; nobody has looked at its `md`.

- **(P3) A lab's config schema takes no `over`.** A lab resolves its instrument's config schema
  with none (`useConfigSchema`), so that schema cannot alias into another schema or hold a
  condition on its setting. Every surface reads `over`'s values from the config it is handed, and
  a trial's config holds its instrument's alone: where a lab keeps another schema's values (each
  trial's config, the lab's store, or the app's) is not decided, and the instrument's `render`
  would need them too.

- **(P3) Nobody has looked at what a standalone `Bar` opens in a browser.** A group a `Bar` opens
  draws its nested groups through the form's pane (`paneChildren`, with `WalkCtx.leaves` handing
  each leaf back to the bar's own rows and cells), so tabs, panels, sections, and fragments draw as
  a `PrefsForm` draws them; jsdom only. A `heading` leaf there stays a row, since the bar's rows
  read an absent value as unset and a heading's control would read it as the default. Nobody has
  looked at `ActionBar` in a browser since it became a `Bar` of `action` leaves.

- **(P3) An empty fragment takes no drop in the live preview.** It draws nothing
  (`display: contents` with no rows), so `Prefs/dropTarget.ts` has no rect to measure it by, and
  only the structure tree drops into it. Needs a call on the look: drawing it a slot while a drag
  is on would give the preview somewhere to land, and would also move the rows around it.

- **(P3) `PrefSchemaEditor` sees only a `ResolvedConfig`'s `group`.** A schema built with
  `f.section` keeps its sections, `showIf` rules, `.render` overrides, and `.dialog` rows beside
  the `PrefGroup` tree, not in it, so the editor shows a sectioned schema as one flat list and its
  export drops all four. A schema is sectioned rather than nested where `f.group` would move its
  config paths. `ResolvedConfig` is labkit's and `@weasel-js/ui` cannot import labkit, so this
  needs decisions before it is built: how a labkit section shows in the structure tree (a
  `PrefSection` cannot sit in a `PrefGroup` root outside an `object` leaf, so either a new node
  kind or a group marked to keep its config paths); what the export writes for a schema whose
  source is `f.section(…)` calls rather than a literal; and whether labkit wraps `AssetEditor`
  and converts both ways, or `@weasel-js/ui` gains the vocabulary itself.

- **(P3) Nobody has looked at a `heading` leaf's control in a browser.** `PrefsForm`, labkit's
  `ControlPanel`, and `SelectionPanel` each draw a leaf marked `heading` in the heading of the group
  or section holding it (`prefHeadingKey`); `SelectionPanel` sets it in a title row beside its
  dimmed title. `PrefsForm`'s sticky section heading's `scroll-margin-top` assumes one line of text.

- **(P3) Nobody has looked at the desktop themes' bevels.** Under `win9xTheme` and
  `platinumTheme` (`@weasel-js/theme/themes/*`), every control in `@weasel-js/ui` that draws a
  raised face, a well, or a button that stays down reads the `--wzl-bevel-*` hooks;
  `packages/theme/src/hooks.ts` says which takes which. Each was chosen from computed values
  and one headless screenshot per theme, not by eye. Drawn with no bevel: `StatusBar`, a
  `minimal` segmented control, a mixed segment, and a notched slider thumb, whose clip path a
  box shadow ignores. The checkbox, radio, switch, overlays, flat segment cells, and toolbar
  strips keep their own 1px border inside the bevel, where the field frame drops its border
  through `--wzl-field-border`. The systems' own faces are named in the font stacks and not
  bundled; a bundled lookalike needs a face whose license allows it.

- **(P3) What a leaf shows when its value is absent is decided in each params surface.** Which
  control a leaf draws is one table now (`PARAMS_CONTROLS`, `Prefs/surfaceControls.ts`, through
  `prefFieldProps`' `surface` argument). The value handed to it is not: a stored value that is
  absent is the default in the form (`prefRenderContext`, `Prefs/PrefsRow.tsx`), unset in the
  panel, and `?? default` in labkit (`controls/rows.tsx`, `panelRows.tsx`, `MatrixCell.tsx`,
  `MatrixEditor.tsx`), where `null` also reads as absent. Two rows of the table are labkit's alone
  and were carried over undecided: `enumAsAsked: false` (`radio` draws as segments, `menu` as a
  select) and `openSlider: false` (a slider needs both bounds). Outside the table:
  `Bar/BarField.tsx` draws an enum's `radio` as segments on every surface, and `MatrixEditor`
  always lists an enum as radios.

- **(P3) What each group `as` draws differs across the params surfaces.** The run of neighboring
  `tab` groups is collected once (`prefTabRuns`, `@weasel-js/prefs`); what is drawn is not: `panel`
  is a bordered box in ui and a plain `PropertyGroup` in labkit; `section` is a `Subpanel` in
  labkit and a heading elsewhere; a group's `description` shows under a tab in `PrefsPane` and is
  dropped for tabs and sections in labkit; `SelectionPanel`'s top level flattens nested sections
  (`flatten` in `model.ts`), so a nested `tab` or `panel` loses its `as` while the object leaf
  beside it honors nesting; an empty tab section is left out of the run in `objectRows`, a hidden
  one in labkit, and `PrefsPane` has no emptiness check.

### WeaselDraw app follow-ups (defer)

- **(P2) Tune draw's surface assets hands-on, with the maintainer driving.** Which groups form which
  asset, each one's default surface, and where switching lives were picked without anyone using
  them (`apps/draw/src/surfaces/assets.tsx`). Today Arrange (reorder, align, distribute, flip),
  Pathfinder, and Path (path, anchors) default to toolbars in the command strip; a panel's header
  switches it from a menu button showing its surface, and a toolbar or menu button switches from its
  context menu and, for a menu, from the menu's last rows. Preferences lists every asset with its
  surface and flags.
- **(P3) Draw's Properties, Colors, Layers, and History panels are code, not schemas,** so they can
  only be panels: each is a `render` asset that allows `'panel'` alone. Each moves to a schema once
  what it shows can be one: the selection's properties already are, while the swatch strip, the
  layer list, and the history list need leaf kinds of their own.
- **(P3) The rest of draw's command strip is not surface assets.** File, history, clipboard, edit,
  structure, view, text, compound, record, and app stay `ActionBar`s in `CommandBar.tsx`, and
  Simplify, Offset, Corner shape, and the paper size are draw's own controls with no pref form: each
  needs a custom pref kind before it can sit in a schema asset.
- **(P3) New and Debug are not menu assets.** Their rows are not registered actions: New hands a
  paper size to `onNew`, and Debug opens a dev route in a new tab. A `file.new` action with a
  variant per paper size would make New an `actions` leaf, with a key binding besides; the debug
  routes could be `run` leaves.
- **(P3) A schema bar has no strip of its own to match `ActionBar`'s.** `ActionBar.module.css` draws
  the bordered strip under its buttons, and draw's `SchemaSurfaces.module.css` restates it for a
  `Bar` drawn from a surface asset. `Bar`'s `framed` is a different strip (margin, height). One strip
  form on `Bar` would serve both.

- **(P3) Multi-page documents.** A document's pages are rects in one world space over one scene,
  so one view, history, and selection serve all of them, and an object is on the page it overlaps
  most. Core has the geometry (`packages/core/src/core/pages/`): `layoutPages` places a page list,
  `pageAt` and `pageOfBounds` say which page a point or an object is on, `pagesLayer` paints the
  sheets, and `fitViewToPage` frames one. draw paints its one page through it. Left, in order:
  1. draw's document holds a page list where it holds `paperSize` (`useDocumentState.ts`,
     `docPersistence.ts`), and `usePageFit` fits the current page.
  2. Adding, removing, reordering, and resizing a page are undoable. The page list sits outside
     the scene, so they need a history entry of their own, and a removed page has to say what
     happens to the objects on it.
  3. A page navigator in draw, and `viewport.recenter` on the current page.
  4. SVG save and export per page: `svgInterop.ts` keeps one paper size under `wd:`, and
     `svgExport.ts` writes one `viewBox`.

---

### Domain bundles

- **(P3) A presentation bundle and a whiteboard bundle.** Each would be a `Contribution` bundle,
  the way `@weasel-js/diagram` is (`createDiagramContribution`).
  - Presentation: to be rethought before anything is built. This bullet predates sherpa (the
    presentation runtime) and blits (concurrent effects).
    Ruled 2026-10-17: a presentation strategy now runs through those two, not an in-canvas
    slide bundle. What weasel contributes, if anything, is undecided. The page primitives it would
    have used are in `packages/core/src/core/pages/` (`layoutPages`, `fitViewToPage`,
    `adjacentPage`).
  - Whiteboard. The tools are all in core: `usePencilTool`, `useTextTool`, and `useStickyTool`
    (built-in id `sticky`, a text node with a `background`; its look is `toolOptions.sticky`).
    The bundle itself is not to be built yet (decided 2026-10-17). apps/draw leaves `sticky` out
    of its tools: its `TextObj` and SVG round trip carry no text `background` or `padding`, and
    SVG import reads a written note back as a rect and a text node.
### d3 integration plugin

- **(P3) `d3-zoom` / `d3-drag` adapters — parked.** Both duplicate kit systems
  (the `viewport.zoom` / `viewport.dragPan` / `viewport.wheelPan` actions, `useHandTool`,
  `useViewAnimation`; `useDragGesture`).
  Worth building only for d3 semantics the kit genuinely lacks, not for parity —
  none identified yet.

---

## forge

`@weasel-js/forge` is the component workshop built on labkit: each story renders
in the workshop page as a lab trial with controls. A story that sets `isolate`
renders in an iframe ("frame") instead; that path is frozen, kept for as long
as any story needs it, and `check:forge-isolate` holds the count. It is the
only story runner in the repo.

- **(P3) A story whose `render` takes no args has no controls.** forge reads a
  control for each prop of the meta's `component` (`packages/forge/src/vite/propTypes.ts`),
  and leaves them off a story whose `render` declares no parameter, since nothing
  would read them. `grep 'render: () =>'` lists them. Every story that draws one
  instance of the meta's component, plain or inside a harness holding state, now
  takes `args` and passes them on (`storyArgs.test.tsx` in `packages/ui/src/components`
  and `packages/labkit/src`). What is left draws several instances, something other
  than the meta's component (`Timeline`'s `Live` draws `AnimatedTimeline`, `BarField`'s
  `<Strip>` every field kind), a generic component (`DataGrid<Route>`), or one whose
  props are all supplied by the harness (`DragGhost`, `BarAction`'s `Snap`). Open:
  whether a matrix story should take args and apply them to every cell.

- **(P3) Marks are off in the workshop until annotations are a feature.** forge's
  instruments do not declare labkit's `annotations` capability, so trials show
  no Marks section and no tool rail. The removed wiring — the story as the one
  annotation target, sized and captured through the trial's frame registry — is
  in `git log --grep 'take marks out of forge'`.

- **(P3) The CSS Vars panel does not save a token the theme derives.** A token
  edited by hand saves when the definition writes its value out: a pin, a
  component, or a literal semantic, in the branch the trial's globals read
  (`applyTokenEdits`, `packages/forge/src/shell/cssVars/saveTokens.ts`). One
  that follows another token, a ramp, a contrast rule, or an alpha stays a
  per-trial override, and so does a scale step changed after its scale, because
  a value written over it would drop the derivation for every mode and density
  the branch covers. Not decided: whether such an edit should save at all, and
  if so as a pin over the one step or as a change to what it follows.

- **(P3, isolated stories only) Watch in a browser that a story whose `viewport` the index cannot
  read keeps its frame when first opened.** The stage for a computed size, or a CSF story's
  `parameters.viewport`, arrives with the frame's `ready`, and labkit's `Trial` then remounts
  `FrameView` inside a `<Stage>`. The frame now moves to the new view with `moveBefore`
  (`useKeptFrame`, `packages/forge/src/shell/keptFrame.ts`), tested in jsdom as the same element on
  the same port, which cannot show that the document did not reload. A browser without
  `moveBefore` still reloads it once.

- **(P3) windease lays out a node that was registered and never shown.** A
  strip gives a `mounted` node its room and a seam, while `Container` renders
  only `visible` ones, so the pane is an empty gap with a live separator
  (`layout-node-adapter.js` skips `hidden` and `destroyed` only; windease
  2.0.0). `Split` works around it by showing its sidebar node and hiding it
  again (`createSplitStore`, `packages/labkit/src/primitives/Split.tsx`). The
  fix belongs in windease; the workaround goes when it lands.

- **(P3) What holds `fseventsd` when macOS file events stop arriving is not known.** Measured
  2026-10-13 with `fseventsd` at 98% CPU and 2.6 GB: a write in a temp directory reached neither
  `fs.watch` on that directory nor the `fsevents` module in 12 seconds, while a watch on the file
  itself fired at once, and a dev server served none of three edits. Every dev server in the repo
  now warns when it starts in this state (`watchProbe`, `packages/forge/src/vite/watchProbe.ts`),
  and the one test that needs a real watcher skips. The cause needs the machine in that state.

- **(P2) Confirm in forge that a hot update is no longer followed by a full reload.** wake set a
  new stamp on every hot update and the page kept the one it loaded with, so about three seconds
  after forge reloaded a story in place the tab reloaded itself, and every isolated frame polled
  and reloaded on its own. wake `c9f75c3` sends the stamp to the page with the update and skips the
  client in a frame whose parent already runs it. Tested in wake against stubbed globals only.
  To confirm: build wake (`npm run build` there; weasel reads `~/src/wake/dist`), edit a story in
  forge, and watch that trial state survives past the grace and that `/frame.html` draws no
  `.wake-badge`.

- **(P3) wake (`~/src/wake`, not this repo): a server's exit-time release can drop another app's
  registry entry.** `releaseSync` and `releaseExtraSync` in `~/src/wake/src/claim.ts` read the
  registry and write it back without the lock `updateRegistry` (`~/src/wake/src/state.ts`) takes.
  Scenario: server A exits while server B, another app, is inside `updateRegistry`; A reads, B
  writes its entry, A writes back its earlier read with only its own holder cleared, and B's entry
  is gone, so B's next start picks a port as though it had never run. Nothing synchronous can take
  the port lock; either re-read and compare just before the write, or have the next `claim` treat a
  dead holder as released and make the exit-time release a no-op.

---

## Demos & visual regression

- **(P3) EffectChart visual baselines are not captured.** `tests/visual/effect-chart.spec.ts`
  names `effect-chart.png` and `effect-chart-rack.png`; the update-baselines workflow has to
  write them. Its `maxDiffRatio` of 0.004 was copied from `diagram.spec.ts`; set it
  from the first captured baselines.

- **(P3) A dev server on orochi has missed a file write.** A site dev server there served a file
  as it was before an edit on 2026-10-12, and a `touch` did not wake it. Seen once and not
  reproduced. `forge/src/vite/plugin.test.ts` lost file events for its temp directory the same way,
  7 of 26 tests in one run on 2026-10-13, and polls now; whether a checkout loses them too is not
  measured.

- **(P3) A freshly started site dev server's first page load can come up blank.** Started from a
  worktree with `WAKE_EXTRA=<port> npx vite --port <port>`, the first one or two loads of a demo
  show an empty page with wake's "dev server unreachable" pill, and a reload renders it. Seen on
  every one of a dozen servers on 2026-10-14. The server logs no dependency re-optimization or
  reload, so the cause isn't known; the first load after an agent edits a lab once threw
  `instrument.defaultConfig is not a function` before a reload fixed it. A visual spec run on its
  own meets it too: `hud-context-menu`'s first test waited 30s for a canvas, twice on teitou on
  2026-10-15, and passed in 2s on the next try; `--timeout 90000` gets a lone spec through.

- **(P3) Package pages: undescribed exports and unchecked source links.** Every published package
  has a page at `#pkg/<name>` (how each tab is fed is in `CONTRIBUTING.md`, "Package pages"), and
  only geom, gestures, and labkit have guides. About 420 exports have no doc comment, so their row
  in a module's list has no description. A page's "Declared in"
  line links to GitHub only where TypeDoc found the repository, which it cannot from a git
  worktree (it looks for a `.git` directory); the deployed build has not been checked for links.

- **(P3) SVG export writes wrapped text unwrapped.** `data-weasel-wrap` round-trips
  `TextStyle.wrap` for weasel's own reader, but SVG `<text>` never wraps, so any other reader draws
  a wrapped node as one line per hard break. Exporting the laid-out lines needs fonts at serialize
  time, which `@weasel-js/svg` does not have. A justified node is written at its start edge with
  `data-weasel-align="justify"` for the same reason: once lines are exported, its wrapped lines
  need per-word `x` placement too, since `text-anchor` has no justify. The hard-break lines are
  pitched at the node's font size times its line height (`linesXml` in `tspanLines.ts`), which is
  where the layout puts them only when no run on the line is larger; a line holding a larger run
  needs the same fonts. How a browser draws the `<tspan x dy>` lines has not been looked at in one.

- **(P3) The animation wrappers have no canvas seat.** `animateOnSetPose` and `animateLifecycle`
  wrap an adapter the caller holds. `<SceneCanvas>` builds its own and takes neither, so nothing a
  tool writes is animated; `apps/site/demos/AnimationDemo.tsx` wraps `useSceneAdapter(scene)` and
  its buttons write through that. Wrapping the canvas's adapter would animate every op applied
  through it, a drag's release, a resize, and an undo among them (read from `applyOps` in
  `canvas/sceneAdapter.ts`, which hands each op the adapter it was called on; not run), so the
  seat has to say which of those glide. It would still miss a button's `scene.setPose`, which
  reaches no adapter: animating that needs the scene to report the write, as `onReflow` reports
  a settle. `<SceneCanvas reflowTransition>` is that shape for layout writes already: the scene
  hands `useLayoutDepSource` each move with the pose it left, and the transition glides what is
  shown from there through a pose override, writing nothing. A removal cannot follow it, since
  the node is gone by the time a report arrives.

---

## Backends (WebGL future)

- **(P3) WebGPU backend.** Separate future spec.
- **(P3) Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win,
  significant API complexity. Defer until measured pain on the single-thread pipeline. The
  main-thread `OffscreenCanvas` that rasterizes pattern tiles in
  `packages/core/src/features/patterns/` is not worker offload.
- **(P3) Headless server-side rendering in Node.** `renderSceneToPixels`
  (`packages/core/src/canvas/renderSceneToPixels.ts`) accepts a caller-supplied `gl`, which has to
  be WebGL2. `headless-gl` cannot supply one: `gl@8.1.6` (read 2026-10-17) implements WebGL 1.0.3
  only, vertex arrays through `OES_vertex_array_object`, and Node has no `OffscreenCanvas`. Left:
  find a Node binding that provides WebGL2, or host the render in headless Chromium.
- **(P3) Screen adoption of mipmap image minification** — `imageMinification: 'auto'` on
  `WeaselRenderer` builds an image's mipmaps the first time a frame draws it at half size or
  smaller, so only an image that is drawn small pays for them. The screen path still builds its
  renderer with the default `'linear'` (`packages/core/src/canvas/canvasRenderer.ts`), and
  `<Canvas>` has no prop for it. Making `'auto'` the screen default changes the pixels of every
  minified image, so it needs the visual baselines regenerated and a look at a sprite sheet drawn
  small: trilinear filtering blends neighboring cells at the higher mip levels, which `'linear'`
  does not. The cost of `generateMipmap` on a large sheet is not measured. Never mipmap
  `GLTextureCache`; it holds MSDF atlases.
- **(P3) Gradient ramp resolution at print scale** — 1×256 LINEAR ramps verified adequate for 8-bit
  output (interpolation error < 1/255 per channel); revisit only if >8-bit output lands.

(WebGL1 fallback explicitly rejected — WebGL2 only.)

---

## Release-gate & build hygiene

- **(P3) `onto test --spread` fails a run whose tree moved, where the other commands sync again.**
  onto `f621d8b` makes a launch carry the stamp its own sync was answered with, so a suite can no
  longer start in a tree another session synced; `scripts/fleet-tree.gate.ts` stays as the check
  on this side. `--spread` calls `prepare()` once and runs its shards outside the retry, since
  retrying would rerun groups already finished. The fix reaches a machine when its `onto` binary
  is rebuilt, and a node's agent refuses a launch against a tree that lost its stamp only after
  `onto push <node>`.

- **(P2) What is left of the `browser` project's fleet failures.** Measured on 2026-10-15 from the
  logs of 136 fleet runs (2026-10-11 to 10-15) and from runs of the `browser` project alone on
  teitou, msb-uai and studio. Running it after the other projects (`sequence.groupOrder`) ended the
  timeouts in Playwright actions: 8 of 18 fleet runs before that change had one; after it only
  `LabLightbox`, which also builds WebGL contexts, did (3 of 118). The timeouts that followed, from
  2026-10-13, were the project's own: it failed the same tests alone as in a full run, and sixteen
  busy cores beside it changed nothing. Its tabs share one Chromium, and on teitou 17 of them took
  the same 72 to 78 s as six while tests making WebGL contexts ran three to five times as long, so
  it now runs six (`maxWorkers`). A tab that lost its connection mid-run ("Browser connection was
  closed while running tests", every file after it left unrun; at six workers too, on
  `17bd67dea`'s first fleet run) had a renderer full of Mach ports, which a removed test frame
  holds until a full GC; `vitest.browser.setup.ts` now collects garbage at each file's start.
  Measured on teitou, one or two workers: before, 11 of 11 runs lost a tab, 36 to 78 files in, and
  in the 5 runs sampling ports each second its renderer held 14,086 to 16,661 when it went; with a
  full GC between files, 8 of 8 kept every tab, the 5 sampled peaking at 414 ports, and a lone
  tab ran all 176 files twice. That the port count is what closes the sockets is inferred from this,
  not traced inside Chromium: every socket and request of that page closes at once from the
  browser's side (a net log shows it), the page itself lives on, and no crash is reported. Left
  open:
  - **`text-dom/src/overlayTyping.browser.test.tsx`'s first test failed `frame.evaluate: Frame was
    detached` under `userEvent.keyboard`**: 8 runs, all at the old worker count. vitest finds the
    frame a command acts on by name, `page.frame('vitest-iframe')`, and every test file's iframe has
    that name, so while Playwright still lists the previous file's iframe it can return that one.
    `vitest.browser.setup.ts` now waits at each file's start (`settleFrame`, in
    `scripts/vitest-browser-commands.ts`) until the lookup returns the file's own frame. That this
    lookup is the cause is inferred, never caught in a run; a sighting with the wait in place
    means it is something else.
  - **A trial's status strip grows 2 px when its numeric face arrives**, which refits the view a
    second time. The strip itself now takes its room on the first layout (`TrialChrome` reads an
    unplaced view as the default), so this is the only refit left; `presentation.browser.test.tsx`
    loads the face first to test the structural half, and its "entering refits" test still waits
    for the settled box. The readouts' boxes depend on the face because `ScaleIndicator` is
    inline-flex inside a line box; made face-independent the strip would settle near 27 px (estimated)
    rather than 30, which is a look to decide, not a fix to make.
  - `forge/src/vite/plugin.test.ts` has its own entry under "Demos & visual regression".

- **(P2) HUD vs DOM text: what the idle rerun left open.** `tests/perf/hud-vs-dom.spec.ts` prices
  the HUD against plain DOM, a React overlay, and a DOM layer moved as one element
  (`tests/perf/README.md`, "HUD text against a DOM overlay").
  - **The all-threads figures leave out the renderer's worker pool**, which the HUD keeps 1.8–2.4
    ms a frame busier than the DOM at 5,000 glyphs changing every frame (`HVD_CENSUS=1`, teitou and
    msb-uai, 2026-10-17; README, "Frame rate"). Rerunning the every-frame half of the sweep with
    the census on would say whether "off the main thread the HUD is cheaper" survives, and the
    pool's self times would say what it is doing. The 70 ms frame gap this entry used to ask about
    no longer reproduces.
  - **A static label on a fixed camera still favors the DOM**, 1.38 ms of main thread against 0.33
    at 5,000 glyphs, because the renderer walks every unchanged text command each frame. A
    layer-level skip for a HUD whose widgets are all unchanged would need `content` painters kept
    out of it.

- **(P3) Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one
  is desired. The barrel test (`packages/core/src/index.barrel.test.ts`) asserts parity for op
  factories, shape kinds, and the `features` presets; the rest of the public exports are uncovered.

- **(P2) What still breaks the batch, now that a rect clip does not.** `batchClip.ts` cuts staged
  quads to an axis-aligned clip rect on the CPU. Measured on teitou (Apple M5 Max, ANGLE Metal),
  2026-10-06, one frame a task, each sample ending in a one-pixel `readPixels` so the GPU's own
  time counts; result files in `tests/perf/recorded/render-cost-2026-10-06/`.

  | at 60 Hz, `frame-budget.spec.ts` | before | now |
  |---|---:|---:|
  | clipped groups, depth 1 | 3,424 | 83,968 |
  | clipped groups, depth 4 | 2,080 | 42,496 |

  The before column was measured through `gl.finish()`, which does not wait for the GPU
  (`tests/perf/README.md`, "Timing a frame"); its files are in
  `tests/perf/recorded/render-cost-2026-10-04/before/`. Re-measuring it means that renderer under
  today's timing, so the size of the gain is not settled.

  The figures below dated 2026-10-17 are one pass of each spec on teitou, with the specs as of
  `539738293`; result files in `tests/perf/recorded/batch-specs-2026-10-17/` (they name onto's
  base commit, `f32b06842`, marked dirty). What is left:

  - **A run-breaker costs about 21 us a flush** (`flush-anatomy.spec.ts`, 2026-10-17: 21.41), and 17.4 of it
    goes when the vertex `bufferSubData` is dropped, leaving 3.4 for the bind and the draw. No other
    call in `flushBatch` moves it by more than 0.4 us. A stencil clip around a solid rect costs
    24.4 us a clip, 22.2 of it the break; an axis-aligned rect clip, cut on the CPU, costs 0.09
    (`clip-cost.spec.ts`). What still ends a run is a sixteenth texture, a ninth color matrix, a
    clip only the stencil expresses, and a paint that draws for itself (a pattern, a shader,
    per-vertex colors).
  - **What joined the run since is checked in a browser but not timed.** Each is pinned by draw
    count through the GL recorder, and its `*.browser.test.ts` passes in headless Chromium (run
    2026-10-17):
    - Synthetic bold: the threshold shift rides a glyph's `a_post` (`syntheticBold.browser.test.ts`).
    - Fifteen textures where a run held seven, fetched through a tree of four compares where the
      chain took up to seven (`batchSlots.browser.test.ts`). Not timed: the tree per fragment
      (`fill-rate.spec.ts`), and the wider `u_samplers` and `u_fieldScale` uploads per flush.
    - A gradient or an image under any color matrix: each vertex names one of up to eight
      (matrix, group alpha) pairs the run draws under, `u_colorMatrix[i]`, packed into `a_texSlot`
      (`draw/batchMatrices.ts`, `colorMatrixFold.browser.test.ts`). A gradient under a matrix that
      only scales channels down rides a vertex tint, as an image does. Not timed: the indexed
      matrix per fragment, and three array uniforms a flush where the matrices changed.
    - Earlier, and in the same state: a solid's or a glyph's color mapped on the CPU
      (`draw/foldColor.ts`), and an image's tint.
  - **A clip only the stencil can express still flushes on entry and exit**: a polygon, a rect
    turned off the axes, and a rect clip with a slanted item crossing it (`DrawBatch.clipQuad` says
    why a slanted edge cannot be cut). The stencil itself costs about 2.2 us a push and pop around a
    pattern rect, 2.4 at 8 leaves, clipping to a quad with one slanted edge (`clip-cost.spec.ts`,
    2026-10-17); on 2026-10-06 the same spec read 4.9 and 7.9 with a rect clip, so shape and date
    are not separated. The stencil reference is state, so one draw cannot test two
    depths; putting such a clip in the run means deciding coverage in the fragment shader, from
    half-planes a vertex names. That has to agree with the stencil where an item that draws for
    itself sits under the same clip, at pixel centers on an edge and per sample on a multisampled
    target, and only a browser can say whether it does.
  - **Caching `u_synthBold` (a uniform then), `u_samplers`, and `u_fieldScale` was tried and
    reverted**, measured through `finish`: it saved about 0.1 us a flush on color-matrix breaks and
    made a frame of 20,000 stroked rects 30% slower, with both renderers interleaved in one page.
    The cause was not found. The run's color matrices are cached the same way now
    (`uploadBatchMatrices`), where `setColorMatrixUniforms` cached the one before.
  - **Changing kind costs 1.35–4.9 us a boundary** (`transition-matrix.spec.ts`): text and gradient
    the least, shader (4.9) and vcolor (4.4) the most. Pairs whose kinds share a batch cost nothing
    extra; the rest add 8–16 us, with a run-to-run spread up to 9.7 us, so the spec ranks pairs but
    does not price one.

- **(P2) A ring of buffers measures slower than rewriting one.** `SOLID_RING_SIZE` (64) exists so a
  flush never writes a buffer a draw is still reading. On teitou (Apple M5 Max, ANGLE Metal),
  2026-10-06, four passes back to back in ABBA order, a quad that ends its run (`image-quad`,
  `renderer/unmerged`, 20,000 a frame) cost 22.50 and 21.99 us through a ring of 64 against 17.75
  and 18.09 through a ring of 1, with no overlap between the sides' samples; `flush-anatomy` did
  not separate them. Result files: `tests/perf/recorded/ring-size-2026-10-06/`. Only one GPU and
  backend has been measured, and the ring's own case was made on an M2 Max by the retired block
  method; D3D and Vulkan backends are where an in-flight buffer write would stall, if anywhere.
  A single `image-quad` rerun on teitou on 2026-10-17, ring of 64, read `unmerged` at 27.4 us
  (`tests/perf/recorded/batch-specs-2026-10-17/`), so the 22.5 / 22.0 above has drifted; why is
  not known.

- **(P3) The mesh batching caps are measured on one GPU.** A mesh joins a run up to
  `MAX_BATCHED_MESH_VERTICES_IN_RUN` (1,024) vertices when one is open, and up to
  `MAX_BATCHED_MESH_VERTICES` (96) when none is (`packages/renderer/src/draw/batch.ts`).
  `tests/perf/mesh-batch.spec.ts` times 256 convex meshes a frame, batched against drawn alone:

  | Frame | Break-even, two passes (vertices) | At 256: alone less batched (us/mesh) |
  |---|---:|---:|
  | meshes back to back | 136 and 92 | -2.36 and -1.00 |
  | a rect before every mesh | 1,488 and 1,724 | 26.31 and 21.02 |

  Drawn alone among rects, a mesh costs 26–37 us whatever its size, because it closes the rect's
  run and switches program twice; back to back it costs 1.4–6.7 us. Both caps sit below their
  break-even because being wrong on the open-run side costs about ten times more a mesh. Measured
  on teitou (Apple M5 Max, ANGLE Metal), 2026-10-07, two passes 20 minutes apart; result files in
  `tests/perf/recorded/mesh-batch-2026-10-07/`. Left: the same run on a D3D or Vulkan backend,
  where the break-evens may sit elsewhere.

- **(P3) A consumer's `sampling: 'nearest'` costing up to 8x does not reproduce here.** They drew a
  5652px atlas (~122MB) and saw nearest cost 8.11x linear at 2:1 minification, 5.98x at 1.33:1,
  1.08x at 1:1, and 1.14x magnified, in single runs on a contended box. `atlas-wall.spec.ts` with
  `WEASEL_PERF_SHEET=5652` builds sheets that size, cells sampling tiles across all of it. On
  teitou (Apple M5 Max, ANGLE Metal), 2026-10-07, in ABBA passes against our 0.1–3MB sheets, 5 runs
  a pass, nearest over linear was:

  | Sheet | Pass | 1:1 (56px) | 1.33:1 (42px) | 2:1 (28px) |
  |---|---:|---:|---:|---:|
  | 5652px | 1 | 1.30 | 1.20 | 0.66 |
  | 3MB    | 2 | 1.11 | 0.97 | 0.77 |
  | 3MB    | 3 | 1.17 | 1.68 | 1.11 |
  | 5652px | 4 | 0.63 | 1.08 | 1.25 |

  Every ratio, magnified rungs included, falls between 0.6 and 1.7 either way with no trend in
  sheet size or minification. The frames are 0.2–0.6 ms, where 0.1 ms is noise; an 8x would be 3 ms
  and could not hide. That matches the code: `GLImageCache` uploads with MIN_FILTER LINEAR and no
  mipmaps by default, and `sampling` reaches GL only as `setMagFilter`, which skips a value the
  texture already holds. Result files: `tests/perf/recorded/atlas-wall-sheet-2026-10-07/`. What is
  left is their side: whether their build predates `fee0c98db` (which stopped re-asserting
  MAG_FILTER per flush), their GPU and backend, and their dpr. Only their harness can answer it.

- **(P3) Whether the batched path costs a co-tenant on the same page.** Reported, not measured
  here. A consumer benchmarking its wall against a canvas2d control found that at one rung the
  *canvas2d* side went from ~8.8 ms to 102-160 ms, and only when the page also held a build with
  the merged batch. Reproducible in both directions.

  Its seven rungs narrow it to an interaction. Five rungs share one byte-identical 12MB atlas, and
  only the densest of them is anomalous — canvas2d costs 160.4 ms at 16px / 2,700 commands against
  5.2 at 24px / 1,419, on the same sheet — so it is not residency. The two rungs with *more*
  commands, 8px at 7,500 and 12px at 4,275, are fine on a smaller sheet, so it is not command
  count. What is unique is the pair: the most commands anyone draws against the large texture.

  Two axes move together across that ladder and want separating. Holding the cell at 16px and
  drawing fewer of them varies command count at a fixed 2:1 minification; drawing 24px cells until
  the count reaches 2,700 varies the sampling ratio at a fixed count. `GLImageCache` sets
  MIN_FILTER to LINEAR and generates no mipmaps on the screen path, so a minified draw scatters its
  taps, and 16px is where a 32px tile is minified hardest by anything drawing that many of them.

  **The control has to run in their harness.** Every number in it is canvas2d on a page that also
  holds a WebGL2 context. Nobody has measured that rung with no GL context at all, so "the batch
  costs its co-tenant" and "this rung is expensive whenever GL is resident, and the batch only
  changes the timing" are not yet separated. Nothing in this repo can take that run: no spec under
  `tests/perf/` draws with canvas2d, and `atlas-wall.spec.ts`, which builds walls of this shape,
  draws them only through `WeaselRenderer` (checked 2026-10-17). It is one run on their side, the
  16px / 2,700-command rung with the GL build left off the page, and it could retire the entry.

- **(P3) Retained layer surfaces: what the first arc left.** An unchanged layer of 250 commands or
  more is now drawn once into its own texture and composited (`GroupDrawCommand.retain`,
  `packages/renderer/src/retain/`; the policy is `packages/core/src/core/layers/retain.ts`). Memory
  is bounded by a cap, `WeaselRendererOptions.retainBudget`, not by content: every surface is the
  size of the drawing buffer, 16 MB at 1280x800 and dpr 2, plus one shared multisampled scratch
  buffer of 8 bytes a sample (131 MB there at 4x). Left:

  - **Content-bounded surfaces.** Size each surface to its layer's device bounds, clamped to the
    viewport, and composite a quad over just that. Less memory and fill than a canvas-sized quad;
    needs a bounds pass over every command kind and an offset projection inside the surface.
  - **Retaining through camera motion.** A world layer stops retaining while the view moves, and its
    surface is freed after a frame without it, so a pan resubmits every layer and reallocates on the
    first still frame. An oversized, bounded surface could be translated instead of redrawn.
  - **Layers with `effects`, and layers inside a `LayerGroup` that owns a surface,** are never
    retained: the renderer declines a retained group inside another render target.
  - **No `Canvas` prop** sets the threshold or the budget, or turns retaining off for a whole canvas;
    today that is `RenderLayer.retain: false` per layer, or the renderer's own options.
  - **No timing of the real path yet.** The 250 threshold comes from `tests/perf/layer-dispatch.spec.ts`,
    which stood in for a retained layer with one canvas-sized image (composite cheaper than submitting
    from about 130–250 commands a layer, at 4 to 64 layers; 58 ms submit against 5.4 composite at 64
    layers of 1,000). Its composite side should be rerun through `retain` itself, which adds the
    resolve blit, and the threshold set from that.

  Measured on teitou (Apple M5 Max, ANGLE Metal, headless Chromium 153), 2026-10-07; one GPU and
  backend only. Result files: `tests/perf/recorded/layer-dispatch-2026-10-07/` and
  `tests/perf/recorded/layer-dispatch-dirty-2026-10-07/`.

- **(P3) The pull request benchmark job does not fit its time limit, and its comment shows
  seven of fifteen benchmarks.** Its steps ran on keiei (Apple M2, 8 cores, load about 6.9) on
  2026-10-15, outside GitHub: base checkout, `npm ci`, `perf:bench` and `test:perf` on each side,
  `compare.mjs`, and `pr-comment.mjs --dry-run`. Every step worked. Measured:
  - **Time.** `test:perf` took 53.8 min on the base and 51.1 on the head, and `perf:bench` about 4
    min each; checkout to comment was 113 min against the job's `timeout-minutes: 100`.
    `hud-vs-dom` alone is 27.2 min a run. One full `test:perf` also outruns `perf.yml`'s 45
    minutes. Not measured on the runner itself (studio, M1 Max), so the overrun there is inferred.
    Which to change is open: the limits, `hud-vs-dom`'s rounds, or which specs a pull request runs.
  - **The comment.** `compare.txt` was 536,682 characters; `MAX_COMMENT_CHARS` keeps 60,000, which
    is `animation-stress` through `flush-noise` in file order. Everything after, `image-quad` and
    `layer-dispatch` among them, never reaches the pull request. What the comment should hold
    instead (the largest ratios, one summary line per benchmark) is undecided.
  - Still unmeasured: whether the base, measured first, reads differently from the head for that
    reason alone. Result files and logs from that run were not kept.

- **(P3) `selectTool.rotate === false` is decided in three places that do not agree.** Making them
  one changes behavior three ways, each needing a decision; `docs/audits/2026-10-12-SceneCanvas.md`
  lists them. Left open by the preset table and the rule context.

- **(P3) Three classifiers name a node's kind.** The kind label published with the selection and the
  routing kind disagree on every node, and `SelectionPanel` has a third. The command palette's
  summary prints the label, so making them one needs a decision on what it should say. Left open by
  the selection pass.
