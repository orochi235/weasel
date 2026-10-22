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

- **(P2) `features` names two things.** The `<SceneCanvas features>` prop composes behavior presets
  (`canvas/SceneCanvas/features.ts`); `packages/core/src/features/<name>/` is a source directory
  bundling one domain's primitives, and `docs/taxonomy.md` calls each of those a "feature" too.
  Ruled 2026-10-11: the directory and the taxonomy's term take a new word, and the prop keeps
  `features`; the new word is not chosen yet. That leaves choosing it, then renaming the one path,
  its imports, and the section of the taxonomy.

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

- **(P3) A 3D move of several roots lands only the first one exactly.** kernel3d's snap session
  answers in the screen point that `translate` turns back into the snapped world delta for the
  anchor, the first selected node. `translate` converts a screen delta per node, from that node's
  own screen center and on the plane at its own height, so every other root, at a different height
  or place on screen, moves by a slightly different world delta, and a target one of them snapped
  to is missed. A fix needs either a group-rigid 3D move or a world-delta channel in the pose
  descriptor that a 3D move could use in place of a screen delta.

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

## Viewport

- **(P3) Raw WebGL that skips `useOrbitView` escapes labkit's missing-camera check.** A trial with
  `orbit` undeclared flags a 3D view in the console and with a "no camera" title-bar badge when the
  instrument calls `useOrbitView()` or a three.js `WebGLRenderer` or `WebGPURenderer` lands in it
  (`packages/labkit/src/trial/threeWatch.ts`); a hand-written WebGL view does neither. Watching
  `getContext('webgl2')` on canvases in the trial cannot tell it apart, because weasel's own 2D
  renderer opens the same context there.

- **(P3) A loupe over a view takes that view's camera but not its layers or selection.** A lens
  aimed over a `<CanvasView>` panel magnifies and edits the panel's world (`SceneCanvasApi.viewAt`),
  but it paints the canvas's whole stack — a layer the panel hides shows in the lens — and acts on
  the canvas's selection where the panel owns one. Its view would need to follow the view under its
  aim the way a `parent` does, without being measured from or cut to that view's rect.

- **(P3) A view marker drags only where the surface installs the always-on `view.marker.drag` entry.**
  `actions={null}` and a `tools` takeover both leave it out, so markers paint but stop dragging until
  the consumer passes `createViewMarkerContribution()` in `ambient` (or the takeover's own `useTools`
  ambient list). Long-press feedback has the same gap.

- **(P2) A view marker claims presses anywhere inside its outline.** That suits a minimap marker in a
  small picture-in-picture. A marker drawn in a larger frame — a zoomed-out PiP's aim shown in the
  root — can cover the whole frame and take every press there. Decide between grabbing the interior
  and grabbing near the rim before arc 3's markers ship
  (`docs/superpowers/specs/2026-10-21-lens-views-design.md`); until then `interactive={false}` is the
  escape.

- **(P3) A marker whose source is an `AimSource` repaints only when something else asks for a
  redraw.** An aim handed in by value has no way to say it changed. Arc 3's detached
  `<MinimapCanvas>` draws its marker this way and needs one.

- **(P3) kernel3d's frustum outlines into a 2D view only as its footprint on z = 0.** In kernel3d's
  y-up world that plane is a wall facing yaw 0, but a top-down map wants the ground plane. And the
  outline draws only when all four corner rays meet the plane, so a tilted camera with the horizon in
  view draws none. Decide which plane 2D and 3D views share, and what a partial footprint draws,
  before building a 3D minimap (`packages/kernel3d/src/aim.ts`).

---

## Paths & booleans

- **(P3) svg import: absolute and turned glyph positions are not read.** A `<tspan dx>` list is
  read as letter spacing (`packages/svg/src/glyphShifts.ts`), and so is a `dx` on a `<text>`
  holding only text. `rotate`, list-valued per-glyph `x` / `y`, and a `dx` on a `<text>` that
  holds a `<tspan>` are not applied; each warns
  (`packages/svg/src/tspanLines.ts`). Kerned text exported with an `x` per glyph imports with the
  glyphs run together: turning a position into a letter spacing or a space needs the advance of
  the glyphs before it, which a parse with no face loaded cannot measure.
  `serializeSvg` writes no line height either, so a pitch read on import is dropped on export
  unless a caller carries it, as WeaselDraw does in `wd:line-height`.

### Path editing tricks

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
  `DEFAULT_BRIDGE_TENSION`), how Tension is reached outside the lab, and the Alt+J binding
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
- **(P2) Tune Puppet warp hands-on, with the maintainer driving.** First-draft mesh density (about
  400 vertices, `puppetMesh` in `packages/geom/src/warp/puppetMesh.ts`), the solve's round caps
  (`ARAP_ROUNDS` and `ARAP_INJECTIVE_ROUNDS` in `packages/geom/src/warp/arap.ts`), that a click on the
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
- **(P2) Tune snapping hands-on, with the maintainer driving.** First-draft behavior: one
  `targets.snapPx` reach of 8; every canvas snapping point gestures to other nodes' anchors through
  a default `'path-snap'` source; every path kind on, `nearest` included, once a consumer registers
  `pathSnapSource()`; the readout's glyphs, its fixed orange, and where a label sits; Ctrl to
  suspend; and that draw turns on the grid, measurement ends and anchors but not the other path kinds
  ([`docs/snapping.md`](./snapping.md), `packages/core/src/features/snap/`,
  `packages/core/src/features/paths/pathSnap/`).
- **(P3) Equal spacing on a turned resize, and where its alignment marks sit.** Decision for the
  maintainer (2026-10-18). A resize whose frame turns or skews the box moves no side of its
  axis-aligned extent alone, so `resizeEdges` (`packages/core/src/features/snap/resizeBox.ts`)
  answers no edges and `spacingSnapSource` offers nothing; alignment still runs, but its marks span
  the box at the press rather than where it lands. Open question: should spacing on a turned box
  measure its extent, its own frame, or stay off?
- **(P3) Are the snap readout's drawing helpers public API?** Decision for the maintainer
  (2026-10-18). `tickedSegment`, `pillCommands` and `measuredSegmentCommands` are on
  `@weasel-js/core`'s barrel because guides' layer draws with them. Either they stay as designed
  public surface, or they move to an `internal` entry (as `@weasel-js/routing/internal` does),
  which `audit:jsdoc` treats as a sibling-package surface.
- **(P3) Roughen, zigzag and pucker/bloat exist only on the `pel-effects-push` branch.** That
  branch stored effects as a `data.effects` list on the path itself, a design main did not take
  (`f082c838e` adopted its push brush as Smudge and left the rest). Its math is in
  `packages/geom/src/effects/` there; carrying the three over means rebuilding each as a derived
  effect node beside blend, bend and repeat. Undecided whether to; the branch is kept until then.
- **(P3) Some path commands have no icons.** `resamplePath`, the anchor selection commands,
  `setSpiroKind`, `releaseSpiro`, `setBlendSpine`, `releaseBlendSpine` and draw's own
  `view.pathDirection` toggle show as text in draw's bar. The warp labs' tool lists borrow `ui:fitStretch`, `ui:grid` and `ui:pin` rather than the
  warp tools' own glyphs. `core:retractHandles`, `core:symmetricHandles`, `core:simplifyBrush` and
  `core:harmonize` (`packages/core/icons/anchor.mjs`) and `path-tools:spiro`
  (`packages/path-tools/icons/tools.mjs`) are first drafts, not proofed at high resolution.
- **(P3) A puppet warp's bends add anchors.** `warpPath` refits a puppet-warped outline with more
  anchors than its shape needs, and a smoother map does not fix it. Measured with `foldCases.ts` at
  tolerance 0.5 (2026-10-20), the squashed 4-anchor disc refits with 5 anchors under the piecewise-affine
  map and 6 under the Clough–Tocher one that replaced it (`packages/geom/src/warp/cloughTocher.ts`), and
  the bar pushed into an S with 21 and 22. Blending vertex Jacobians (a C0 quadratic map) did worse, 6
  and 23. The extra anchors are in the refit's reading of the warped curve, not the map's smoothness
  (inferred).
- **(P3) A puppet warp that folds costs milliseconds a frame.** When the local/global rounds leave
  a triangle turned over, the injective pass in `packages/geom/src/warp/injective.ts` runs many
  rounds: measured on the fleet (2026-10-19), the disc squash takes 28 rounds and 5.3 ms a solve
  on a 547-vertex mesh, the bar S 51 rounds and 6.8 ms on 517. The back-solves are not the bulk of
  a round: each of its two takes 15 to 33 µs, and a George–Liu starting vertex for the
  Cuthill–McKee order (`profileCholesky.ts`) left them unchanged. The rest is the per-triangle
  passes (gradient, flip bound, energy per line-search step, least area); fewer rounds from a
  better step is the larger lever.
- **(P3) WeaselDraw binds no constraint action.** It needs keys or a bar group for
  `constrainAnchors` and `unconstrainAnchors`, and icons for them.

### Pathfinder follow-ups (post-v1)

- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** The booleans flatten beziers before clipping (`packages/geom/src/booleans/adapter.ts`), so the result is straight-line. Skia/PathKit-style curve-preserving booleans are substantially harder.
- **(P3) Preview a Boolean operation by holding its key over a path.** Hovering or focusing a Pathfinder button shows the pieces it would make, each in the paint it would wear (`Action.preview`, drawn on the `previewPaths` dep). No Pathfinder action has a key or gesture to hold, so nothing asks for a preview from the canvas; nor does the keymap have a hold-to-preview form (press shows, release fires, Escape cancels) for any action.

---
- **(P3) draw's SVG files do not carry layers.** A saved file keeps paper size, title, groups, and
  line height under the `wd:` namespace (`apps/draw/src/svgInterop.ts`) but no layer list and no
  layer id on a shape; export only leaves hidden layers out (`svgExport.ts`). Nothing is lost yet:
  draw has the one layer, `'default'` (`WeaselDrawLayer`, `drawDocument.ts`), and no way to add
  another, and `openSvg.ts` puts every node on it. Whether a page has its own layers is undecided,
  and the file format waits on that.

## Rendering & paint

- **(P2) Readers that still read an `'inherit'` fill or stroke as none** (2026-10-21). Painters, picking,
  drawn bounds, the panel, SVG, the text editor, booleans and WeaselDraw's export resolve it against
  the node's containers. These do not yet:
  - a path effect's source (`features/pathEffects/readSource.ts`): `readEffectSource` gets a
    `DerivedDep` and no scene, so an inheriting source lends its effect no paint;
  - every registered painter that does not read `ctx.inherited` (`diagram:shape` does); and
    `diagram:shape` still paints a diagram container's own fill, where the kit's painters paint no
    container's — whether a diagram node with children counts as a group is open (2026-10-21);
  - the drag ghost (`usePreviewGhostLayer`) resolves against the scene's container, so a container's
    fill edited mid-gesture reaches its members only when the gesture commits;
  - the headless cull (`defaultPaintBounds`) gives up on a node with an inherited stroke, since it
    has no scene to measure it by.

  The panel's Inherit segment is a text label among icons; it wants a glyph (`docs/icons.md`).

- **(P2) A lab nested under another surface owner has no `top` buffer unless that owner offers one**
  (2026-10-21). A `<Lab>` with a surface owner above it takes that owner's `SurfaceCanvases`
  (`labkit/src/lab/LabSurface.tsx`), and an owner publishing only `over` and `under` leaves
  `useSurfaceCanvas('top')` null for good, so the lab's lenses paint nothing. `useSurfaceCanvas` now warns
  in dev when this happens. The fix is for such a lab to make its own `top` canvas when the owner offers
  no `claimTop`.

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
  float32 arithmetic (`draw.precision.test.ts`, `draw.paintPrecision.test.ts`), not in a browser
  far from the origin. Near it, `gradientStart.browser.test.ts` shows the shader honors the rebase:
  a linear, radial and conic ramp each land where their paint says in headless Chromium on the
  fleet, and all three fail with `bindGradient` handing over the unrebased inverse (2026-10-21).
  Still float32:
  a path's own coordinates (`PolygonPath.coords`, `Mesh.vertices`), which at world x = 262,144
  sit on a 1/32 world unit grid, 2 px at 64x, so a tessellated shape is quantized where a batched
  rect (doubles) is not; and what a consumer's own stage receives, which has no origin to rebase
  against: the model (`u_view` on a shader command, `u_model` in a registered paint kind) and the
  paint matrix a registered kind asks for (`PaintBindContext.spaceInverse`). The first cannot be
  fixed in tessellation alone: `PolygonPath.coords` is a `Float32Array`, so the grid is already in
  the path before the tessellator reads it. It needs the path itself to carry an origin (or
  double coords), which every reader of `coords` would then honor.

- **(P3) The tessellate rows of `tests/perf/bench/BASELINE.md` predate two deliberate costs.**
  Bisected on studio (2026-10-19), the node that measured the 2026-09-29 rows, which still
  reproduces them at the baseline commit, so the node has not drifted. `tessellate` slowed about
  40% at 2026-10-17's 7cbedd8b0, which checks every nonzero fill for crossings; a faster check
  (2026-10-19) brought the 64-curve fill from 0.21 ms to 0.18 ms, against 0.15 ms before.
  `tessellateStroke` slowed at 2026-10-14's ab9ea7afa, which caps a thick stroke's flattening at
  10° of turn per vertex: the 4-wide benchmark stroke now flattens to 1258 points where the fill
  takes 474, so 64 curves take 1.44 ms against 0.48 ms, and 512 curves 12.0 ms against 1.65 ms. Left:
  re-record those rows; and decide whether the cap should still subdivide wiggles smaller than
  the stroke is wide, which is where the 512-curve case spends its 10034 points.
  The re-record is one command, `bash tests/perf/recorded/tessellate-bench-2026-10-21/run.sh` sent with
  `onto do --kind bench --node studio --solo`, then `node tests/perf/bench-report.mjs --merge` on its
  `vitest-bench.json`. It did not run on 2026-10-21: onto's solo check (`soloBlock` in
  `~/src/onto/queuesolo.go`) counts studio's idle `brick-spot-render` service as a running job, so a
  `--solo` job never starts there.

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

- **(P3) Area and lasso picks walk every node; the scene has no spatial index.** `walkArea`
  (`packages/core/src/canvas/deps/hitTestArea.ts`) goes through `pickWalk` over the whole scene
  and rejects node by node on its bounds, so a marquee costs time linear in node count:
  `tests/perf/bench/BASELINE.md` has `hitTestArea` at 3.59 ms for 10,000 rect nodes and 5.06 ms
  for 24-gons (2026-09-29, M1 Max), about a third of a 60 Hz frame on every drag move. A
  bounding-volume tree kept beside the scene, updated from the ops that move poses, would make
  that grow with the number of hits instead. Containers, clips, and `inPlane`/`inCopy` regions
  all have to keep working through it. Noted 2026-10-21 while asking whether WASM would help:
  this is an algorithm cost, and WASM would only make the same walk a constant factor faster.

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

### `useScene` follow-ups

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

- **(P3) The drawn grid ignores a container's unit scope.** Grid snapping reads one
  (`gridSnapSource({ scopes })`), and so does a node's length field (`SelectionPanel`'s `units`,
  through `prefLeafInScopes`), but `createGridLayer`, `createCellHighlightLayer`,
  `useGridCellHover`, and `pointToGridCell` in `packages/guides/src/grid` still draw and hit-test
  one lattice against one `unitSystem`. Drawing a millimeter lattice inside a millimeter
  sub-assembly is painting work past the pitch, which `scopedGridPitch` already answers: the
  layer has no scene to find scoped containers in, the root lattice needs clipping out of each
  one (an even-odd clip of the view with holes, nested per scope), a rotated container wants its
  lattice turned with its frame, and a hovered cell has to name the lattice it belongs to. The
  result needs a human eye on the drawn grid at both zoom extremes.

---

## Animation

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

---

## Selection, actions & UI panels

- **(P3) Rows other than `Bar` do not follow an `Along` yet.** `ButtonBar`, `ToggleBar`, segmented
  controls, `SwatchStrip`, `Tabs`/`PageTabs` and `RadioGroup` still lay out on a straight line. They
  follow on what `BarAlong` uses: `runPlaces` and `useRunScroll` (`Bar/`) for where items fall and how a run
  scrolls, and `placeOnRun` (`Along/placeOnRun.ts`) for the custom properties that put a part there.

- **(P3) No gradient painter for a curved track.** `paintGradientTrack` paints straight tracks only and
  draws nothing on a curve; a curved painter strokes the `TrackCtx.shape` run with sampled stops.

- **(P3) Gaps left in controls along a curve.**
  - `Jog` stays straight inside an `Along`: its buttons and readout have no curved layout yet.
  - `thicknessOf` in `sliderGeometry.ts` reads `--rp-track-height` as px only, so a rem or `calc()` height
    is misread.
  - `Along` measures its box with the client rect, so a CSS scale on an ancestor shrinks its arc.
  - `BarSideContext` leaks through portals into popovers nested in a curved bar's popover.
  - A separator on a curved bar keeps `aria-orientation="horizontal"`.
  - A curved bar's menu opens above only for side `'top'`; `'left'` and `'right'` fall back to below,
    because `above` is a boolean where a side is meant.
  - `ReadoutsAlong` has no ResizeObserver, so a font load does not restack its rows.
  - A run is turned over by its middle alone, so on a run across 3 or 9 o'clock the items toward one end tip
    past 90° and read upside down: the `ui/Along/Clock sweep` lab shows it at a 90° span (2026-10-21).
  - The arc controls measure pointers against their box's client rect, so a rotated ancestor (inferred from
    `curvedGeometry`, not seen) maps a press as wrongly as a scaled one does. The `ui/Along/Lens rim` lab turns
    its controls by their arcs' angles instead, which works.

- **(P3) No `path` track shape.** `TrackShape` has `lineShape`, `arcShape` and `ellipseShape`; a shape over any path
  would build on geom's `measurePath` and `nearestOnPath`, and needs no change to the interface.

- **(P3) draw's asset editor renders two large lists whole.** Measured 2026-10-21 in
  `apps/draw/src/dev/AssetsPage.test.tsx` with a node property schema open: the Export panel's
  highlighted literal (`pre[data-testid=schema-literal]`) is about 3,300 elements and 130 ms of a
  jsdom test, and `IconAttrField`'s grid of every registered icon about 2,200 and 90 ms. Virtualizing
  either, or mounting the literal only while its panel is open, changes the UI.

- **(P3) The menu bar's default access chord, Alt, is unverified in Chrome on Windows, which may
  open its own menu on Alt+F; check there before relying on it.**

- **(P3) A schema drawn as a menu still drops or flattens some leaves.** `leafRows` in
  `packages/routing/src/menus/resolveMenu.ts` draws a number and a string as rows edited in place
  and a color as a read-only row. What is left:
  - A color that is not a `readout` shows read-only; neither menu renderer hosts the kit's color
    picker. A swatch submenu, or a picker the DOM menu opens beside its row, would make it editable.
  - The HUD menu draws a text row read-only (`textCommands` in `hud/src/menu/valueRows.ts`): it has
    no text entry. The DOM menu's text field (`MenuTextValue`) is tested in jsdom and has not been
    looked at in a browser.
  - `paint`, `field`, `object`, `list`, `map`, `union`, and app-defined leaves are still left out.

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

- **(P3) Should grid and guide snaps line up the stroke?** Decision for the maintainer.
  `gridSnapSource` and `guideSnapSource` (`packages/guides/src/sources/`) snap the subject's
  `origin` probe, its pose origin, so a rect with a centered stroke 10 wide lands with its stroke's
  outer edge 5 short of the line. Snapping the drawn box instead would put the stroke's edge on it,
  which is what the selection chrome, resize, and `alignmentSnapSource` measure, and every stroked
  shape would land half a stroke from where it lands today. Either answer is now a one-line change
  to the two sources' `roles` (`'origin'` to `'box'`). Insert and the pen are a different case and
  stay as they are: they snap the pointer, before the node has a stroke to measure.

- **(P3) The theme prefs form: long token names, and references shown raw.** `apps/theme-editor`'s
  `#/prefs` page (`ThemePrefs.tsx`) was looked at in Chromium (2026-10-21): the rail pages, a
  per-mode split color (setting `accent`'s Light member recolors only the light preview), and the
  preview all work. Left, both seen on the Button page: a long token name such as
  `BUTTON-PRESSED-SURFACE` wraps mid-name, and its "from theme" tag sits at the label column's right
  edge, away from the name; and a token whose value refers to another shows the reference as raw
  text, `var(--btn-glass)`, in a text field. Nothing drives `applyTheme`'s `weights` from an
  animator either, which is the same gap as the selector weights under "What the split rows in
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

- **(P3) Disabled has no signal of its own, now that emphasis is an alpha.** Disabled is `opacity:
  0.4`–`0.5` on the whole control, and subtle text is 0.54–0.64 alpha, so a disabled control and a
  subtle label can read alike. Ruled 2026-10-11: disabled gets a second cue besides fading. Which
  cue is not chosen yet; that leaves choosing it and giving it to every control that fades when
  disabled.

- **(P3) labkit and the apps hand-build what weasel-ui already draws.** Each waits on something
  the ui component lacks, or on a look at the result in a browser:
  `.lk-titlebar-button` is 18px square and `Button`'s smallest size is `--wzl-control-h-sm`;
  `.lk-toolbar-button`'s `danger` reddens on hover, which a ghost `Button` has no way to do;
  `SidebarRegion`'s section head and undock button against `SidebarPanel`, which takes no
  `actions`, no undock control, no stance, and no `fill`; `LabHeader`'s bare "Add trial" button,
  which sets its own baseline so its label lines up with the title and would lose that as a
  `Button` with a leading icon; the theme editor's swatch tabs against `ToggleBar`'s flat variant
  and its hex and number inputs against `Input` and `NumberField`.

- **(P3) Some site demos still draw a dark look in light mode.** Every demo now sits under a
  theme in the reader's mode, and a scene reads a theme color with `useColorHex`
  (`ViewportDemo`'s background). Left after the 2026-10-21 pass through every demo in light mode:
  `Kernel3dDemo`'s room, `ScoreDemo`'s roll and `EffectChartDemo`'s ground stay dark in both
  modes, which may be the look they want; undecided. Separately, the `.ckd-canvas` stage is
  `#6a6a6a` in both modes, and the scene labels drawn on it (`#a89878` in `AudioDemo`,
  `RigDemo` and `EasingsDemo`, `#1a130d` in `StrokeMarkersDemo`) are hard to read in either;
  whether the stage follows the mode is undecided, and the labels follow from that. The code
  panel's header still darkens with `rgba(0, 0, 0, 0.18)`: it sits on a sunken panel, and the
  theme's step toward `fg` would lighten it in dark mode.

- **(P3) Holding the peek key and then moving onto a loupe no longer raises it.** Since #40's fix
  (2026-10-19) the peek binding takes `opts: { over: true }`, so Alt goes to the loupe under the
  pointer when it goes down and to none if the pointer is over no loupe; nothing re-sends a held key
  when the pointer arrives. Keeping both behaviors with two loupes on a page needs routing to re-send
  a held key when the pointer enters a host that binds it. Undecided whether the sweep-on gesture is
  worth that.

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

- **(P3) An `ActionBar` fills its container's width.** Its `framed="segmented"` strip is a
  block-level flex box, so in a forge story the horizontal bar's frame runs the stage's full width
  with its buttons at the start, and the vertical one is a full-width column with its buttons
  centered (seen in headless Chromium, 2026-10-21).
  `Bar`'s own vertical stories size it with an `inline-flex` rail around it. Needs a call: whether a
  segmented strip sizes itself to its buttons, or its host sizes it.

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

- **(P3) Two control choices are labkit's alone, and two controls draw an enum their own way.**
  Which control a leaf draws is one table (`PARAMS_CONTROLS`, `Prefs/surfaceControls.ts`), but two
  of its rows were carried over from labkit undecided: `enumAsAsked: false` (`radio` draws as
  segments, `menu` as a select) and `openSlider: false` (a slider needs both bounds). Outside the
  table, `Bar/BarField.tsx` draws an enum's `radio` as segments on every surface, and labkit's
  `MatrixEditor` always lists an enum as radios. The value a leaf shows is one function
  (`prefLeafValue`, 2026-10-20), which `Bar` and `MenuBar` do not call: a path their `values` lack
  draws unset, where a params surface draws the default.

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

- **(P3) Multi-page documents in draw.** Core has pages end to end (`packages/core/src/core/pages/`, and
  "Page" in `docs/concepts.md`): the page list is the `core:pages` document value, the edits in
  `pageEdits.ts` move each page's nodes with it in one undo entry, and `PageTabs` (`@weasel-js/ui`) is
  the strip. weaselchart uses all of it. draw still paints one page from `paperSize`. Left, in order:
  1. draw's document keeps its pages under `core:pages` where it keeps `paperSize`
     (`useDocumentState.ts`, `docPersistence.ts`), and `usePageFit` fits the current page.
  2. A `PageTabs` strip in draw, and `viewport.recenter` on the current page.
  3. SVG save and export per page: `svgInterop.ts` keeps one paper size under `wd:`, and
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

- **(P3) Undo after a drag on a lens's rim zoom waits for the lens canvas to have focus** (2026-10-21). The drag
  leaves focus on the zoom's thumb (`lens/LensZoom.tsx`), and the lens history answers only while its input element
  has focus, so Cmd+Z does nothing until the body is pressed. Two loose ends from the same work: a square body's
  zoom labels nearly touch at the default 160 px (`32×` and `64×`, the end label held inside the track), and a
  `Slider` given a `lineShape` ignores its coordinates, so the square body's zoom is a straight slider placed by
  `.lk-lens-zoom__line` rather than a line track.
- **(P2) A popover opened in a magnified Live copy lands off by the lens factor.** react-aria's
  `calculatePosition` places an overlay in client px inside its containing block, and a Live copy is that block
  scaled by `transform: scale(f)`, so the popover's offset from the copy's corner is multiplied by `f`. Measured in
  `shell/loupe/live.browser.test.tsx` at `f = 2` (2026-10-21): the copy's trigger spans client y 159 to 202 and the
  popover opens at y 303 where about 214 is expected, wholly below a 200-px lens at y 80 to 280. Scaling with CSS
  `zoom` instead places the trigger the same and the popover at y 303 too. The lens clips the popover, so nothing
  paints over the lab, but it is out of sight. A fix lies in ui's overlay positioning (a container whose scale it
  undoes) or upstream in react-aria.
- **(P2) A Pixels lens cannot capture a component's index page** (2026-10-21). It says "Pixels unavailable: this
  trial shows no story to capture": `trialPayload` (`shell/loupe/capturePayload.ts`) builds a capture from the
  trial's story entry, and an index page's trial has none. Live shows the page; Pixels and Difference need the capture
  route to render an index page as it renders a story.
- **(P2) A lens on a scrolled isolated story shows a different patch than the one under its reticle**
  (found 2026-10-21). The story's scroll lives inside the frame document, and no protocol message reports it to the
  shell. So a Live lens's copy frame loads at its own scroll position, where an in-document copy follows its trial's
  `.fg-story__scroll` (`LensCopy` in `shell/loupe/LiveCopies.tsx`); and a Pixels capture is taken at scroll 0, since
  the payload's `scroll` is read from a `.fg-story__scroll` a frame host does not have. The fix: the frame reports
  its scroll to the shell (a new `FromFrame` message), and the shell forwards it to each copy frame of that trial (a
  new `ToFrame` message that the frame applies to its scroller) and into the capture payload.
- **(P3) Glass is unbuilt as a user-facing aim** (2026-10-21). `setAimOps(scene, id, 'glass')` makes the reticle's
  pose depend on the body and is tested (`labkit/src/loupe/lens/lensScene.test.ts`), but no lens action switches to it,
  so the Loupe keymap has no key for it. What is left: a `loupe.aim.glass` action and key in `lensActionDefs.ts`.
- **(P2) A Live lens with no comparison never tells its readouts the main story changed** (2026-10-21). With nothing
  compared, Token and Contrast read the main story, but the Live source notifies them from a `MutationObserver` on the
  lens's own copy (`shell/loupe/liveSource.ts`). A change only the main story shows, such as a hover or a menu opened in
  it, leaves the readout on its old reading until the lens next renders.
- **(P2) A story's own scroller cannot be wheel-scrolled under a lens** (2026-10-21). labkit's wheel pass-through
  (`useWheelPassThrough`) hands the wheel on as a dispatched copy, which is untrusted, and a browser scrolls an element
  only for a trusted wheel. A camera's wheel zoom answers the copy; a story's native `overflow` scroller under a lens
  does not move. A fix scrolls the element the copy lands on by its deltas when nothing called `preventDefault`.
- **(P3) A Live copy of an isolated story is drawn soft at magnification** (2026-10-21, inferred, not seen). A
  `<CanvasStack>` puts the scale an ancestor transform shows it at into its backing density, so an in-document copy
  is sharp at any factor. Inside an isolated story's frame the lens's transform is outside the frame's document,
  where the stack's measurement cannot see it, so its canvas is enlarged instead.
- **(P3) A `<CanvasStack>` under a scaled ancestor maps the pointer in client px** (2026-10-21, read in the code, not
  seen). `CameraInput`'s `clientToWorld`, `worldToClient` and `hostSize` read the host's client rect, which an
  ancestor transform (a `<Stage>`, `<TrialOverview>`) scales, while the stack now draws in its layout px. Nothing
  takes input there today: a lens's copy takes no clicks.
- **(P2) Two Follow lenses share one reticle hold** (review finding, 2026-10-21). `createApi`
  (`shell/loupe/ForgeLoupe.tsx`) keeps one `PoseHold` for every Follow lens and each `follow` sets it to the
  focused lens's reticle alone, so moving the focus to another Follow lens drops the first one's held pose. One hold
  per lens, released when its lens leaves Follow or closes, fixes it.
- **(P3) A Live copy of an isolated story is backed by the lab's background, not the compared mode's**
  (2026-10-21). `.fg-lens-copy > .fg-frame-host` paints `var(--wzl-bg)` as the shell resolves it there, and the
  compared globals apply inside the copy's frame, not to its host in the shell. A transparent isolated story under
  an opposite-mode lens shows the lab's background through it.
- **(P3) The Live source notifies its readers once per DOM mutation** (2026-10-21). Its `MutationObserver` calls every
  listener on each batch of records, so an animating story keeps Token and Contrast recomputing styles every
  mutation. Coalesce the notifications to one per frame through `useVisibleRaf`.

- **(P3) On Linux, a second save within 50 ms of the first can leave the dev server serving the
  first until the next save.** This is chokidar inside vite, not forge, so it hits every vite
  server in the repo. chokidar drops, rather than defers, a `change` that lands within 50 ms of the
  one it last reported. If the page re-fetches the module in that window (its HMR fetch after the
  first save), the second save never invalidates it. Run 2026-10-19 in a Linux container
  (`node:26-alpine`, vite 8.3.1): save, wait 25 ms, save again, with a fetch 5 ms after the first
  `change`. The server kept the first text after 3 s idle. This held for plain vite and for forge,
  and for both rename-over and in-place writes. With
  `server.watch.awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }` it served the
  second text at 25 ms and at 80 ms gaps, because events that wait for the write to finish skip
  that throttle. The cost is about 60 ms more latency on every edit. The throttle sits in
  chokidar's `_emit` (3.6.0, bundled in vite 8.3.1's `chunks/node.js`), which the fsevents handler
  goes through too, so macOS is likely affected as well: read, not measured. Open: whether to pay
  the latency everywhere, and whether forge's plugin or each app's vite config sets it. `replacedFile.test.ts` rewrites until served for the
  same reason.

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

- **(P3) One of forge's two idle `/frame.html` frames reloads with every hot update.** Seen
  2026-10-19 in headless Chrome on the Button story: each edit reached the page in place, with no
  reload of the page and no `.wake-badge` in either frame past wake's grace, but the second frame's
  document was replaced at the instant the update arrived, three edits running. The first frame
  kept its state. Whether that frame is meant to rebuild on an update is not known.

- **(P3) wake (`~/src/wake`, not this repo): a server's exit-time release can drop another app's
  registry entry.** `releaseSync` and `releaseExtraSync` in `~/src/wake/src/claim.ts` read the
  registry and write it back without the lock `updateRegistry` (`~/src/wake/src/state.ts`) takes.
  Scenario: server A exits while server B, another app, is inside `updateRegistry`; A reads, B
  writes its entry, A writes back its earlier read with only its own holder cleared, and B's entry
  is gone, so B's next start picks a port as though it had never run. Nothing synchronous can take
  the port lock; either re-read and compare just before the write, or have the next `claim` treat a
  dead holder as released and make the exit-time release a no-op.

- **(P3) wake (`~/src/wake`, not this repo): the pill calls a busy server unreachable.** It shows "dev
  server unreachable" whenever `/__wake` takes over 5 s to answer, so a server stalled in a slow
  module load reads the same as a dead one. That is what a fresh site server showed until
  a598e6b2d (2026-10-20) took the demo timestamps' per-file `git log` out of its first load.

---

## Demos & visual regression

- **(P3) `AssetsPage`'s first test still times out in some full fleet runs.** "opens on WeaselDraw
  preferences, and opens a node property schema picked from the list" (`apps/draw/src/dev/AssetsPage.test.tsx`)
  hit its 5 s limit at 5195 ms on 2026-10-21 (onto job 9139de7e), after 69d135f92 moved its one-off
  warmup into a `beforeAll` and memoized `CodeBlock` (501 ms locally, about 1.5 s under moderate
  load). Its body still renders about 6,800 elements; the two big lists are the entry under
  "Selection, actions & UI panels".

- **(P3) `LabFit.browser.test.tsx`'s "sidebar fits a medium viewport" failed once in a full fleet
  run.** At 5aad5f94b on 2026-10-21 (onto job fe292e77, 2791 ms) the browser project failed it; the
  same file passed 15 of 15 in three runs alone on the fleet at the same commit. 2791 ms is the
  test's 2 s `waitFor` running out, so whatever was wrong held for 2 s. Its assertion is lost
  because `onto logs` keeps only stdout, and vitest's failure report goes to stderr (checked
  2026-10-21 with a test failing on purpose); the test now prints to stdout each problem it saw
  and when, plus `document.fonts.status`, so the next sighting names the cause. Ruled out on
  2026-10-21, on teitou: CPU slowness — the sidebar fixture settled within 412 ms at every
  viewport under 20× CDP CPU throttling (36 runs) — and six tabs of contention, where 12 copies
  of the file at 4× throttling settled all 540 cases within 321 ms. The lab has no `storageKey`
  here, so no persisted sidebar width carries between tests or files.

- **(P2) `theme.browser.test.tsx`'s "grows a shape with its text" once saved no typed text.** In
  Linux CI on 179f2409d (2026-10-21, run 39523286313) `savedBody().row.data.text` stayed `''` past
  the poll after Escape, so the six typed `M`s presumably went somewhere other than the open editor
  overlay (inferred; no screenshot survives). Seen once, in a run where 10 other browser tests
  failed; not reproduced in 158 fleet runs of the test that day. The fleet sweep's failures of this
  test were a different thing, pixels read from the frame before the repaint, fixed 2026-10-21.

- **(P2) Visual Regression stays red on `main` until six baselines are captured.** Run the
  "Visual Regression — Update Baselines" workflow and commit these from its artifact; every other
  spec passes. Each one changed on purpose (checked against CI's captures, 2026-10-21):
  - `diagram-nodes.png`, `diagram-edges.png`: fd3875dc1 moved `DiagramView`'s `className` onto a
    new box around the canvas, so the demos' 1px `.ckd-canvas` border now sits outside the canvas,
    which reads 638×358 rather than 640×360. Offset by that pixel, the old baselines differ by
    0.32% and 0.39% (limit 0.4%): body text centered in 10da7a020 and moved edge labels.
  - `hud-context-menu-light.png`, `hud-context-menu-dark.png`: c4e499e30 lists each reorder
    action's two variants (Bring to Front and Send to Back appear), and b14dec111, 4a446579f and
    58e558da6 draw shortcuts, rounded corners, a shadow and row icons.
  - `effect-chart.png`, `effect-chart-rack.png`: never captured. Their `maxDiffRatio` of 0.004
    was copied from `diagram.spec.ts`; set it from the first captures.

- **(P3) A dev server on orochi has missed a file write.** A site dev server there served a file
  as it was before an edit on 2026-10-12, and a `touch` did not wake it. Seen once and not
  reproduced. `forge/src/vite/plugin.test.ts` lost file events for its temp directory the same way,
  7 of 26 tests in one run on 2026-10-13, and polls now; whether a checkout loses them too is not
  measured. Polling did not save "indexes a file added under a glob written with a leading ./", which
  timed out at 15 s in a full fleet run on 2026-10-21 (onto job 2c564a18).

- **(P3) SVG text export: lines written without a layout sit half the leading off.** Without
  `textLayout`, `serializeSvg` writes `dominant-baseline="text-before-edge"`, which puts the face's
  ascent on the box top, where weasel's layout first puts half the leading. Every line is off by the
  same amount: in Chromium, Inter at 24px sits 2.28 up at line height 1.4 and 2.52 down at 1.0,
  every glyph at its laid-out x (`laidLines.browser.test.ts`, 2026-10-21). Closing it needs the
  face's ascent and descent, which this path lacks when it is the fallback for a face nothing
  measured; given them, a `dy` on the `<text>` would move the drawing and leave weasel's reader,
  which reads only `y`, where it is. Undecided whether this path should reach for the metrics.

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
  smaller, so only an image that is drawn small pays for them. `<Canvas imageMinification>`
  (and `<SceneCanvas>` through it) opts a canvas in; the default is still `'linear'`. Making
  `'auto'` the screen default changes the pixels of every
  minified image, so it needs the visual baselines regenerated and a look at a sprite sheet drawn
  small: trilinear filtering blends neighboring cells at the higher mip levels, which `'linear'`
  does not. The cost of `generateMipmap` on a large sheet is not measured. Never mipmap
  `GLTextureCache`; it holds MSDF atlases.
- **(P3) Gradient ramp resolution at print scale** — 1×256 LINEAR ramps verified adequate for 8-bit
  output (interpolation error < 1/255 per channel); revisit only if >8-bit output lands.

(WebGL1 fallback explicitly rejected — WebGL2 only.)

---

## Devtools

- **(P3) The devtools extension's 16 px icon is the whole site logo shrunk.**
  `apps/devtools-extension/scripts/gen-icons.ts` renders the full mark at every size, and at 16 px
  1x it reads as an orange and dark blob. A crop to the head for the 16 and 32 px sizes would read
  better; that is a call on the mark, not made (2026-10-19).

## Release-gate & build hygiene

- **(P3) `check:first-publish -- --warn` fails the gate when the registry is down.** The gate runs it
  with `--warn`, which should only warn, but `fetchPackument` (`scripts/lib/registry.mjs`) throws after
  its retries on a 5xx, so the step exits 1. On 2026-10-21 npm answered 502 for
  `@weasel-js/symmetry` alone, on its packument, abbreviated and `/latest` endpoints, while `core`
  answered 200, and a full run of `main` (7b231aebe) failed on that step with every test green. With
  `--warn`, a registry error belongs in the warning, not the exit code; the release run, without it,
  should still stop.
- **(P3) The browser project may be capped by sharing one Chromium.** It runs 6 tabs in one headless
  Chromium (`vitest.config.ts`, `maxWorkers: 6`), and more tabs measured no faster on 14- and 18-core
  nodes, plausibly because every tab's WebGL goes through one GPU process (inferred, not measured).
  Splitting the project across 2 or 3 Chromium processes (vitest `--shard` per process) is untested:
  run the browser project alone at 1, 2 and 3 processes, once each first, on msb-uai and teitou, keeping
  every run's raw numbers like `scripts/bench-overlap-reserve.mjs` does (2026-10-21).
- **(P2) The fleet-tree check passes on another session's commit.** `npm run test:fleet` arms the
  tree with a marker and a plan whose prelude exports `WEASEL_FLEET_COMMIT`, and both travel inside
  the synced tree (`scripts/lib/fleet-tree.mjs`). Two branches tested on one node at once share its
  one weasel tree, so the later sync replaces the marker and the asked-for commit together, and
  `checkTree` finds them in agreement: on 2026-10-21 two runs of `feat/no-paint-readers` logged
  `fleet-tree: … match 87199f258` and `match 3e022b9af`, commits of `feat/container-inherit`, with
  the gate green. The commit the run asks for has to reach the node from outside the tree, such as
  the job's own environment, so a sync cannot rewrite it. Pinning the two runs to different nodes
  does not keep them apart: a run pinned to keiei still logged `updated weasel on msb-uai` and
  shards matching both branches, so the crossing happens on this machine's side. Until it is fixed,
  run one branch's fleet jobs at a time and compare the logged SHA with the branch tip.
- **(P2) `onto logs` drops stderr, so a fleet run's log never says why a test failed.** vitest
  writes its failure report to stderr; `onto do` shows it live, but `onto logs <job>` keeps stdout
  only, so a finished job's log holds the failing test's name and nothing else (tested 2026-10-21
  with a test failing on purpose, job 401c89a8). This is onto's (`~/src/onto`), not this repo's. Until
  it changes, a browser test can print its own diagnosis with `console.log`, which does reach the log
  (`LabFit.browser.test.tsx` does).

- **(P3) Browser-project runs print "ResizeObserver loop completed with undelivered notifications"** (2026-10-21).
  The notice is on stderr from passing tests in `labkit/src/loupe/lens/LensOverlay.browser.test.tsx`,
  `forge/src/shell/FrameView.browser.test.tsx`, `LabLightbox`, `Lab.sidebar`, `AnnotationOverlay.clip`'s and the site's
  `PuppetSolverLabDemo` browser tests, seen across the forge-loupe branch's runs. Nothing fails on it, so a new loop hides among the old ones;
  `SidebarPanes.browser.test.tsx` shows the shape of a test that asserts none is raised. Find which observer resizes
  its own target in each, and fail the browser project on the notice once they are gone.

- **(P3) `npm ci` aborted once with code 134 inside labkit's `prepare` build.** Seen in the first
  `test:fleet:postbuild` run of `34de8c76d` under Node 24 (2026-10-21); labkit's build passed alone
  on the same node and on the rerun. Not looked at.

- **(P2) CI tests Linux Chromium; the fleet does not.** `ci.yml` runs the `browser` project on
  `ubuntu-latest`, while every fleet node is a Mac. CI run 39349499006 (2026-10-20, at
  `f01d3e010`) failed 10 browser tests the fleet passes — `menus.browser.test.tsx` reads
  `CutCtrl+X` where it expects `Cut`, `Badge.browser.test.tsx`, `Bar.overflow.browser.test.tsx`
  and `PropertyList.pairs.browser.test.tsx` measure boxes a fraction of a pixel wider, and
  `retained.browser.test.ts` counts 2 draws where it allows 1. No later run reached that step, so
  whether they still fail is unknown. The fix is a Linux node (or container) for the `browser`
  project. (CI's Node 22 leg has a fleet twin since 2026-10-21: `npm run test:fleet:matrix`.)

- **(P3) Decide whether a swapping node should take full fleet runs.** On 2026-10-20 keiei
  (8 cores, 24 GB, 7–11 GB of swap) failed `packages/forge/src/timeline/timeline.test.tsx` in five
  full runs, `main` at `416328e36` among them; msb-uai failed it once. Nothing in the tests waits
  on a timer or a load that could be cut: the time is the whole workshop mounting, which is React
  in development mode plus jsdom, and the tests that fail mount it two or three times.

  | keiei, 2026-10-20 | one mount, to the first playhead | the timeline file |
  |---|---:|---:|
  | alone | 0.5–0.7 s | 14 s |
  | full run, 16 GB free | 1.4–2.7 s | 42 s, passed |
  | full runs that failed | — | 88–102 s |

  teitou, studio and msb-uai run the file in 20–44 s. That the failing runs were the swapping ones
  is inferred from `onto status` at the time, not measured inside them. Keeping a node that reports swap out of full runs is an onto setting, left unchanged.
  Of a mount's CPU, 11% is `Element.closest` in jsdom, which `useOverlayPortal` calls through
  `nearestPortalHost` on every render of every `Tooltip`, and about 4% is axe, which the a11y panel
  runs on each mount. A timeout no longer leaks: the file's helpers stop once vitest aborts the
  test's signal, where before a timed-out test could mount into the next one's document.

- **(P3) forge serves ui and labkit file by file unless `WEASEL_DEV_BUNDLE_STORIES=1`.** Their
  stories import through package specifiers, so the flag bundles both (`scripts/vite-prebundle.ts`).
  Measured 2026-10-21: a forge load falls from 1,624 requests to 1,270, and at 20 ms of emulated
  latency from 7.1 s to 4.5 s to network idle; a ui component edit goes from a 0.28 s hot update to
  a ~3.6 s re-bundle and reload. Whether to make it the default is the open decision. Under the flag,
  159 of the 1,270 requests are Badge's `shapes/`, `bases/` and `effects/`, which the Badge story and
  its `lab/` import by path because ui does not export them; removing those needs a published
  subpath.

- **(P3) Drop `--no-sparkplug` from `vitest.config.ts` once Node 26 is shown free of the crash it avoids.**
  Five vitest runs died with a worker-thread SIGSEGV in V8's GC (teitou, studio, msb-uai, 2026-10-15
  to 10-19), all under nvm's Node 24.21.0. The crash reports match nodejs/node#62393, a Sparkplug bug
  that Node 24.22.0 fixes, and every fleet node's nvm resolves `.nvmrc`'s `24` to 24.22.0 since
  2026-10-19. The flag stays because the same crash is reported on Node 26.7 and 26.8.1, which ad-hoc
  `onto run`s and local runs use; remove it once a 26 release carries the V8 fix. The fix is the
  backport `fb0d0ca289` (nodejs/node#65753); no Node 26 changelog through 26.12.0 lists it (checked
  2026-10-19).

- **(P3) `onto test --spread` fails a run whose tree moved, where the other commands sync again.**
  onto `f621d8b` makes a launch carry the stamp its own sync was answered with, so a suite can no
  longer start in a tree another session synced; `scripts/fleet-tree.setup.ts` stays as the check
  on this side, in every shard. `--spread` calls `prepare()` once and runs its shards outside the retry, since
  retrying would rerun groups already finished. The fix reaches a machine when its `onto` binary
  is rebuilt, and a node's agent refuses a launch against a tree that lost its stamp only after
  `onto push <node>`.

- **(P3) The `browser` project spends about a second per file outside its tests.** Alone on teitou
  (2026-10-20) it took 89 s on six workers, 534 worker-seconds, of which its 227 files' tests were
  310 s; the rest is each file's page and module load, and from 35 s on the run is a stream of small
  files paying it. Splitting the longest files would not help: the tail is the small ones.
  `--no-isolate`, which would reuse one page, failed every file at about 5 s with its tests skipped.
  Serving the workspace packages pre-bundled, as `scripts/vite-prebundle.ts` does for the dev
  servers, is the likely fix (inferred, not tried). The prebundle already keeps out of a bundle
  whatever source imports by relative path, so no module would load twice, but tests import their
  own package that way, so most of each package would stay unbundled. forge got its gain by moving
  its stories onto package specifiers first (2026-10-21); the tests would need the same.

- **(P2) What is left of the `browser` project's fleet failures.** The project runs after the
  others (`sequence.groupOrder`), in six tabs (`maxWorkers`), collects garbage at each file's start
  so a tab's renderer cannot pile up the Mach ports that closed its sockets, and waits at each
  file's start until vitest's frame lookup returns that file's own frame (`settleFrame`,
  `scripts/vitest-browser-commands.ts`); the measurements behind each are in the commits that
  made them (2026-10-13 to 10-17). On 2026-10-19, 15 runs of the project alone on the fleet, beside
  other jobs (teitou 12, studio 2, keiei 1), passed all 220 files with no detached frame and no
  lost tab. Left open:
  - **`text-dom/src/overlayTyping.browser.test.tsx`'s first test failed `frame.evaluate: Frame was
    detached` under `userEvent.keyboard`** in 8 runs before `settleFrame`, all at the old worker
    count. That the frame lookup was the cause is inferred, never caught in a run; a sighting
    with the wait in place means it is something else.
  - **A trial's status strip grows 2 px when its numeric face arrives**, which refits the view a
    second time. The strip itself now takes its room on the first layout (`TrialChrome` reads an
    unplaced view as the default), so this is the only refit left; `presentation.browser.test.tsx`
    loads the face first to test the structural half, and its "entering refits" test still waits
    for the settled box. The readouts' boxes depend on the face because `ScaleIndicator` is
    inline-flex inside a line box; made face-independent the strip would settle near 27 px (estimated)
    rather than 30, which is a look to decide, not a fix to make.
  - `forge/src/vite/plugin.test.ts` has its own entry under "Demos & visual regression".

- **(P2) HUD vs DOM text: the HUD's every-frame text keeps a garbage collector busy.**
  `tests/perf/hud-vs-dom.spec.ts` prices the HUD against plain DOM, a React overlay, and a DOM
  layer moved as one element (`tests/perf/README.md`, "HUD text against a DOM overlay").
  - **With the readout changing every frame the DOM is still the cheaper overlay** once the
    renderer's worker pool is counted: at 5,000 glyphs on a fixed camera 8.41 ms a frame of all
    threads against 6.12, down from 11.28 (msb-uai, one run of each tree, 2026-10-20; README,
    "What the HUD allocates"). The garbage is the text re-laid out for every label that changed:
    6.0 MB a frame, down from 9.7, against the DOM's 0.12. Most of what is left is the layout's
    own output — `placeLine`'s cells and placed glyphs, `paintRuns`' quads, `measureRuns`'
    entries — one object per glyph with every number in it boxed. Cutting that means a layout
    held in typed arrays, or one that a label whose text changed can update rather than rebuild.
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
  - **What joined the run since is checked in a browser.** Each is pinned
    by draw count through the GL recorder, and its `*.browser.test.ts` passes in headless Chromium
    (run 2026-10-17):
    - Synthetic bold: the threshold shift rides a glyph's `a_post` (`syntheticBold.browser.test.ts`).
    - Fifteen textures where a run held seven, fetched through a tree of four compares where the
      chain took up to seven (`batchSlots.browser.test.ts`). The tree costs a fragment what the
      chain's deepest slot did: `fill-rate.spec.ts`'s `batch` came within 1.2% of
      `batch-chain8-7` on msb-uai (Apple M3 Max) and keiei (Apple M2), two passes each with no
      other onto job on the node, 2026-10-19; the chain's slot 1 was 2–4% cheaper. The wider
      `u_samplers` and `u_fieldScale` uploads are under `flush-anatomy`'s noise: dropping them
      saved 0.06 us a flush on teitou (2026-10-17), and 0.1–1.9 us in four passes on msb-uai
      (2026-10-19) where a flush cost 31–34 (result files with the ring measurement below).
    - A gradient or an image under any color matrix: each vertex names one of up to eight
      (matrix, group alpha) pairs the run draws under, `u_colorMatrix[i]`, packed into `a_texSlot`
      (`draw/batchMatrices.ts`, `colorMatrixFold.browser.test.ts`). A gradient under a matrix that
      only scales channels down rides a vertex tint, as an image does. The program such a run
      draws with costs each of its fragments 12–13% more than the one-matrix program on msb-uai
      and 22–23% on keiei (`batch-8-matrices`, the same runs). The matrix uploads are under the
      same noise as the sampler uploads (`-colormatrix`: 0.08 us on teitou, 0.3–2.2 on msb-uai).
    - Earlier, and in the same state: a solid's or a glyph's color mapped on the CPU
      (`draw/foldColor.ts`), and an image's tint.
  - **The shipping batch fragment costs three times the spec's stand-in for it.** `fill-rate`'s
    `batch` variant draws `BATCH_FRAG_SRC` through `BATCH_VERT_SRC` (`tests/perf/lib/batchFragments.ts`);
    it cost 2.95–2.98 times `split-sample`, the hand-written fragment the spec's older variants
    price the glyph math and the gradient split against, on both nodes, and 4.7 (M3 Max) and 5.9
    (M2) times a plain textured fragment. So those variants' percentages are shares of a fragment
    a third as dear as the real one. What the rest is spent on (the color matrix and clamp,
    `straightRgb`, the flat varyings) is not broken down. On msb-uai the last two of eight runs
    ran 2.5–4 times slower in both passes, every variant alike; the spec keeps the fastest run,
    so they do not reach a figure. Result files: `tests/perf/recorded/fill-rate-batch-2026-10-19/`.
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

- **(P3) `SOLID_RING_SIZE` is measured only on Metal.** The ring (64 slots) exists so a flush never
  writes a buffer a draw is still reading. On 2026-10-06 a ring of 64 measured 24% slower than a
  ring of 1 on teitou (`ring-size-2026-10-06/`); on 2026-10-19 it did not reproduce. Eight passes
  a node in ABBA order, ring of 64 against ring of 1, `image-quad`'s `renderer/unmerged` at 20,000
  quads of 8 px, us a quad, medians of each pass's 3 runs, each node with no other onto job:

  | Node | ring of 64 | ring of 1 |
  |---|---|---|
  | teitou (Apple M5 Max) | 20.79, 22.92, 22.40, 22.09 | 20.89, 19.68, 22.25, 21.42 |
  | msb-uai (Apple M3 Max) | 34.49, 33.59, 34.30, 34.54 | 33.46, 33.66, 33.68, 33.74 |
  | keiei (Apple M2) | 66.31, 67.54, 69.17, 65.58 | 65.37, 64.89, 64.97, 65.21 |

  A ring of 1 is 2–5% cheaper on each, with the sides' samples overlapping. `flush-anatomy`'s
  `bind+draw` (no vertex upload) separates them on two nodes, in opposite directions: a ring of 1
  costs 0.3 us a flush less on teitou (3.05–3.23 against 3.34–3.79) and 2.8 more on keiei
  (10.2–11.6 against 7.6–9.1); on msb-uai the samples overlap.
  So no Apple GPU makes a case for changing the size. The 27.4 us the 2026-10-17 rerun recorded was
  not drift: it ran `image-quad` at its defaults, 512 quads of 48 px. Left: a D3D or Vulkan
  backend, where an in-flight buffer write would stall if anywhere; no fleet node has one. Result
  files: `tests/perf/recorded/ring-size-2026-10-19/`.

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

- **(P3) Retained layer surfaces: what is left.** An unchanged layer of 250 commands or more is
  drawn once into its own texture and composited (`GroupDrawCommand.retain`,
  `packages/renderer/src/retain/`; the policy is `packages/core/src/core/layers/retain.ts`;
  `<Canvas retain>` sets the threshold and budget). Each surface covers only the device pixels its
  layer can paint, but text, custom shaders and `effects` cannot be bounded yet, so a layer holding
  any of them still gets a canvas-sized surface (16 MB at 1280x800 and dpr 2). Left:

  - **The budget still caps canvas-sized layers at about 16.** `retainBudget` (256 MB default) counts only
    kept surfaces; the multisampled scratch buffer they are drawn in is left out and freed after a
    frame that redraws nothing. A canvas-sized surface is 16 MB, so at 64 layers holding text 48 are
    still drawn straight through (below). Two things are open: a frame that redraws can hold the
    budget plus one canvas-sized multisampled buffer (131 MB at 4x), which drawing in tiles would
    cap; and whether the default should scale with the drawing buffer.
  - **Bounds for text and custom shaders.** Text needs its laid-out extent plus glyph overhang;
    a custom shader may read `gl_FragCoord`, which the offset viewport moves.
  - **Retaining through camera motion.** A world layer stops retaining while the view moves, and its
    surface is freed after a frame without it, so a pan resubmits every layer and reallocates on the
    first still frame. An oversized, bounded surface could be translated instead of redrawn.
  - **Layers with `effects`, and layers inside a `LayerGroup` that owns a surface,** are never
    retained: the renderer declines a retained group inside another render target.
  - **The threshold.** `tests/perf/layer-dispatch.spec.ts` times the real path (`retained`), each
    variant on a renderer of its own. On msb-uai (Apple M3 Max, ANGLE Metal, headless Chromium 153),
    2026-10-18, ms a frame over the control, medians of 3 runs, with the scratch buffer outside the
    budget:

    | layers | cmds | submit | retained | kept / declined |
    |---:|---:|---:|---:|---:|
    |  4 |   30 |  0.240 |  0.510 |  4 /  0 |
    |  4 |  100 |  1.255 |  0.490 |  4 /  0 |
    | 16 |   30 |  1.670 |  2.035 | 16 /  0 |
    | 16 |  100 |  3.785 |  1.705 | 16 /  0 |
    | 16 |  300 | 11.595 |  1.765 | 16 /  0 |
    | 64 |  100 |  9.030 |  9.515 | 16 / 48 |
    | 64 | 1000 | 56.125 | 43.005 | 16 / 48 |

    Where every layer fits the budget, retaining wins by 100 commands a layer and loses at 30, well
    below the 250 in force. It was left at 250: one GPU, and frame time does not price the memory a
    lower threshold commits. With the scratch buffer counted, the same node kept 8 of 16 and 8 of
    64. Result files: `tests/perf/recorded/layer-dispatch-scratch-unbudgeted-msb-uai-m3max-2026-10-18/`
    (now) and `tests/perf/recorded/layer-dispatch-retained-msb-uai-m3max-2026-10-18/` (scratch
    counted).

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

## weaselchart

`apps/chart`, a Visio-style diagram editor with a pipeline mode, built on `@weasel-js/diagram`.

- **(P3) Two wires can't meet at one audio input in pipeline mode.** `livePlan` sums every wire
  into an input, but the editor lets a wire join only a free input
  (`packages/diagram/src/effect/editorHandlers.ts`), so Mix is the only way to combine sounds.
  Decision needed: whether audio inputs accept several wires, as a port-level flag, or Mix stays
  the way to combine (2026-10-20).
- **(P3) Pipeline mode doesn't drag edge labels yet.** `EffectWire`
  (`packages/diagram/src/effect/types.ts`) has nowhere to store a placement, and the `lanes` look
  rewrites each label's `labelPlacement` on every build (`packages/diagram/src/effect/lanesRoutes.ts`).
  Wiring `onMoveLabel` through `EffectEditor` needs a wire field and a rule for which of the two wins.
  Left open by label drag (2026-10-20).
- **(P3) `cullDrawCommands` keeps every group with effects.** `contentBounds` already bounds one by
  `effectsReach`, but that is device pixels and the cull rect is CSS pixels with no pixel ratio to
  convert by, so culling one needs `cullDrawCommands` to take that ratio (2026-10-21).
- **(P3) Check `@weasel-js/rig`'s and `@weasel-js/diagram-formats`' trusted-publisher
  registration.** Both are on the registry at 1.11.1 under `latest` and `pre` (`npm view`,
  2026-10-21); whether each is registered as a trusted publisher (`docs/releasing.md`, "Setting up a
  new package") can only be read on npmjs.com.
- **(P3) Pipeline mode groups one stage at a time.** Arrange › Group (`EffectEditorApi.group`)
  takes any ids, but `DiagramView` picks one node (`useSelection` in `'single'` mode, and
  `selected`/`onSelect` carry one id), so the app can only hand it the picked stage or group.
  Grouping several at once needs `DiagramView` to pick and report a set. Left open by pipeline
  groups (2026-10-20): it changes `DiagramView`'s selection props for every host.
