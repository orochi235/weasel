# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@weasel-js/core`). The
kit aims to be a generic scene-graph foundation: 2D in core, 3D in
`@weasel-js/kernel3d` beside it. Items here are evaluated for cross-app reuse,
not consumer-app value.

For history of completed work, see `git log` and the dated specs under
`docs/superpowers/specs/`. Plans are deleted when their work merges.

When work merges, retire its entry here in the same change.

Performance work (runtime costs, and test-suite and dev-server speed) is in `docs/PERF.md`.

Priority tags:
- **(P1)** — foundational genericity gap; the kit can't do this today
- **(P1.5)** — ranked between P1 and P2
- **(P2)** — broad reuse, or friction-likely
- **(P3)** — specialized, or resting on a foundation not built yet

Owner tags, after the priority (2026-10-26):
- **[agent]** — an agent can take it alone, making any engineering call inside it itself
- **[maintainer]** — needs the maintainer: a look, name, feel or saved-output change he reserved,
  hands-on tuning, a ruling he made to revisit, or hardware or an account only he has
- **[recheck]** — unsure which; the next pass settles it, asking if it has to
- **[waiting]** — nothing to do until something outside happens: a second sighting, CI history, a
  consumer's own run, a backend no node has

---

## Tools & gestures

- **(P3) [agent] A refused gesture's reason tag lands off the pointer on a canvas under a transformed ancestor.**
  `GestureReason` (`packages/core/src/canvas/GestureReason.tsx`) is `position: fixed` at the reason's client
  point, and a transformed ancestor becomes the containing block of a fixed element, so the tag is placed in
  that ancestor's scaled, offset frame. Not fixed in audit round 19 (2026-11-12) with the rest of the
  ancestor-transform work: it needs the tag positioned in the canvas root's own frame (absolute, measured the
  way `useSceneTextEdit` measures its overlay box) or portaled out, and either changes how it clips and stacks
  against the page. Closes when the tag sits beside the pointer on a canvas inside `transform: scale(0.5)`.

- **(P2) [agent] A key pressed right after a click acts before the click's selection lands.** Measured in
  collego (2026-11-10): its `watch.spec` clicks a node and presses Backspace at once. On 1.17.3 the node was
  deleted; on 1.18.2 nothing is deleted, though the node shows as selected within 100 ms. The selection comes
  from `@weasel-js/core`'s select binding. Inferred, not traced: since 1.18 a press is dispatched again as the
  click it settles into, so the selection commits on release (or later) instead of on press, and a key
  pressed in between finds the old selection. A person clicking then typing quickly hits it too. Closes when a
  key pressed straight after a click acts on what the click selected, or the delay is ruled acceptable.

- **(P3) [maintainer] External-content ingestion — the drag ghost seen in a real OS drag.** While a drag
  hovers, the dispatcher calls the drop action's `preview`, and `ingest` draws a placeholder box per claimable
  file (or one for text) through `previewPaths` (`packages/core/src/domains/ingestion/ghost.ts`). No test can
  start a real OS drag, so the ghost has not been seen: check that it follows the pointer, clears on Esc, on
  leave and on drop, and looks right in WeaselDraw. A handler-supplied ghost (a handler naming its own
  preview size or shape per MIME) is not built.
  Closes when the maintainer has watched a real OS drag in WeaselDraw and the ghost follows the
  pointer, clears on Esc, on leave and on drop, and looks right.


- **(P3) [agent] `apps/theme-editor` cannot become a `<Lab>` without being rebuilt.** `<Lab>` is the trial
  runtime: it requires a non-empty `instruments` list, seeds a trial, and renders `children` into
  the header while its body is fixed as the surface buffers plus a `Workspace` of trials.
  PaletteLab's page *is* the shell body, and the `#/theme` workbench beside it is a second bare
  `LabShell` page. Moving them in means making each an instrument and running it in a trial pane,
  with labkit's per-trial store and persistence beside its own, and a trial titlebar beside its own
  `PropertyPanel`. Its own arc, and the first question is whether labkit should support a lab with
  no trials at all.
  Ruled (2026-11-07): labkit supports a lab with no trials, rendering its children as the body.
  Closes when `<Lab>` takes no instruments and `apps/theme-editor` runs as one.

- **(P3) [maintainer] Long-press: the native `contextmenu` a touch hold sends is unseen on a real device.**
  `useGestureDispatcher` treats a `contextmenu` that arrives while a touch or pen hold is in
  progress as that hold's long-press, so a `contextMenu` binding runs once. Tested only in jsdom
  with a hand-sent event (`useGestureDispatcher.nativeLongPress.test.tsx`). Left: hold a finger on
  a canvas with a `contextMenu` binding in Android Chrome and confirm one menu, and that the event
  really arrives while the pointer is still held rather than after a `pointercancel`.
  Closes when a held finger on a canvas with a `contextMenu` binding in Android Chrome opens exactly
  one menu, with the event arriving before any `pointercancel`.

- **(P3) [maintainer] AltGr matching is unchecked in a real browser.** The keyboard channel
  (`packages/routing/src/interactions/dispatcher/channels/keyboard.ts`) dispatches the chord as
  reported, and when nothing takes it and `getModifierState('AltGraph')` holds, dispatches again
  without Ctrl and Alt. Only jsdom has seen it. Left to check on Windows, with a layout that has
  AltGr: that Chrome and Firefox both report AltGraph for it, and that a plain Ctrl+Alt+letter, for
  which Firefox reports AltGraph too, is still read as a chord.
  Closes when, on Windows with an AltGr layout, Chrome and Firefox both type the AltGr character and a
  plain Ctrl+Alt+letter still runs its chord binding.

### Cursor package follow-ups

- **(P3) [maintainer] Cursor rasterization is unmeasured in Safari.** Chrome and headed Firefox are measured
  (`packages/cursor/scripts/probe/README.md`, "Measured browser behavior"); the
  baker's plain SVG `url()` is right for both. `node probe.mjs <dir> --browser safari` in
  `packages/cursor/scripts/probe/` is the instrument, and its readings cannot be trusted yet: its
  first run drew the arrow control and then the crosshair for every case after it, and every later
  run drew the crosshair even for the arrow — with the page frontmost, over HTTP (`--page http`) as
  well as `data:`, stepping by reload as well as by hash. Safari's cursor is not following the page
  under this driver, and why is the open question. A finding lands in `bake.ts`.
  Closes when two Safari probe runs in a row draw each case's own cursor and the reading is recorded in
  the probe README and `bake.ts`, or on 2027-01-31 with no driver Safari's cursor follows, delete it.

---

## Paths & booleans

- **(P3) [agent] Path edit through a text-along effect dims the curved text with everything else.** Ruled
  (2026-11-07): light it, and let a press on it edit the text. Closes when path edit does both.
- **(P3) [agent] `mergeRegion` leaves edges inside the fill where two curves cross nearly tangent.** Two
  round-joined synthetic-bold outlines whose corner arcs lie 0.001 em apart (`M0 -0.001h0.02v0.02h-0.02Z` and
  `M0 0h0.021v0.1h-0.021Z`, grown by the canvas tier's 1/75 em) merge with spikes and slivers a stroke traces.
  The pass on 2026-11-10 fixed shared and near-shared straight edges and exact duplicate contours; this needs
  near-tangent curve crossings snapped or merged, a change to the curve boolean core. Closes when
  `glyphGeometry.pbt.test.ts` checks the bake's round-joined outlines for inner edges too (it checks the
  mitered atlas ones only).

### Path editing tricks

- **(P1) [maintainer] Rename the path tools the maintainer deferred to the end of the adoption pass.**
  Envelope mesh becomes Cloth warp, among others; the Width tool is already Girth. Ruled (2026-11-07): the
  adoption pass is over; Cloth warp goes in now, and the maintainer picks the rest from a field of candidates. They live in
  `@weasel-js/path-tools` now (`packages/path-tools/README.md`); the move kept every name.
  Closes when every path tool the maintainer renames carries its new name in `@weasel-js/path-tools`,
  Envelope mesh as Cloth warp among them.
- **(P2) [maintainer] Tune Balance handles hands-on, with the maintainer driving.** First-draft behavior: a
  grip drag scales both handles by one factor, read off the pointer's projection onto the line the
  grip slides along, and a length lock (`handleLock.length`, or Mod) holds it still
  (`packages/geom/src/paths/balanceHandles.ts`, `packages/path-tools/src/balance/handleBalance.ts`). Its look: a purple
  line between the handle tips and a 4px hollow grip, drawn under the anchor markers and beaten by
  them on a press (`packages/path-tools/src/balance/balanceMarks.ts`). Off by
  default under `path-edit.balance`, with no key to show it, and Equalize handles has only the
  grip's double-click (`apps/site/demos/BalanceHandlesLabDemo.tsx`).
  Closes when the maintainer has driven Balance handles hands-on and the defaults and keys he picks are
  committed.
- **(P2) [maintainer] Tune handle locks hands-on, with the maintainer driving.** Which locks deserve keys, and
  whether a lock holds through a modifier drag (`handleLock.*`, `packages/path-tools/src/handleLocks/handleLocks.tsx`).
  Closes when the maintainer has driven handle locks hands-on and the defaults and keys he picks are
  committed.
- **(P2) [maintainer] Tune anchor selection along the path hands-on, with the maintainer driving.**
  First-draft behavior and keys: `]` grows and `[` shrinks by one anchor, Alt+N selects every Nth
  (N defaults to 2, counted from the first selected anchor, with no UI for N outside the lab's
  `tune`), Alt+C corners, Alt+M smooth anchors, and Alt+I the complement; grow and shrink stay
  within a subpath, and none of them is an undo step
  (`packages/path-tools/src/anchorSelect/anchorSelect.ts`, `packages/geom/src/paths/anchorSelection.ts`).
  Closes when the maintainer has driven anchor selection along the path hands-on and the defaults and
  keys he picks are committed.
- **(P2) [maintainer] Tune Resample hands-on, with the maintainer driving.** First-draft behavior: no key,
  run as a command whose params are adjusted afterward in the last-operation panel; a count of 0 keeps
  the path's anchor count, corners are held by default, the refit tolerance is 0.5 and a piece that
  misses it is halved up to six times, so the result can hold more anchors than asked for (`packages/path-tools/src/resample/resample.ts`,
  `packages/geom/src/paths/resamplePath.ts`).
  Closes when the maintainer has driven Resample hands-on and the defaults and keys he picks are
  committed.
- **(P2) [maintainer] Tune corner shape hands-on, with the maintainer driving.** First-draft behavior and keys:
  a widget sits 14 screen px inside each corner anchor, past the middle of its cut, and is hit
  within 6px; anchors within 0.05 rad of straight get none. A widget drag sets the radius from the
  pointer's travel along the bisector, every selected corner's when its anchor is selected, and a
  corner with no spec takes `round` (Shape for sharp corners in the last-operation panel after a drag). Giving a
  sharp corner a shape cuts a quarter of its room (`DEFAULT_CORNER_TRIM_SHARE`, Size for sharp corners in the panel
  after Next corner shape). `cycleCornerShape` has no key of its own (its lab tunes K onto it, the
  Slice tool's key elsewhere), `setCorners` is reached only through the panel, the
  panel's curvature slider spans -4 to 4, and the widgets show by default under
  `path-edit.corners` with no key to hide them (`packages/path-tools/src/cornerShape/`,
  `packages/geom/src/paths/cornerShape.ts`, `apps/site/demos/CornerShapeLabDemo.tsx`).
  Closes when the maintainer has driven corner shape hands-on and the defaults and keys he picks are
  committed.
- **(P2) [maintainer] Tune Blend, Bend along a path, and Repeat along a path hands-on, with the maintainer
  driving.** First-draft step counts, spacing, and turn defaults, their keys, and how an effect is
  re-edited and expanded (`packages/path-tools/src/pathEffects/`, and core's `domains/pathEffects/`).
  Closes when the maintainer has driven Blend, Bend along a path, and Repeat along a path hands-on and
  the defaults and keys he picks are committed.
- **(P2) [maintainer] Tune Lengthen hands-on, with the maintainer driving.** First-draft behavior and keys: the
  path-edit tool (`useLengthenTool`) has no key; a plain drag grows along the end tangent and Shift along the end
  curvature (the `mode` param, Shape in the last-operation panel after a drag, flips which, and `'eased'` makes the
  plain drag ease out of the bend as Extend to next path does, Shift then going straight); a curvature arc stops at a full turn, and a trim always
  leaves a thousandth of the subpath (`packages/geom/src/paths/lengthenPathEnd.ts`); an end is
  pressed within 8 screen px, the cursor is the pen with an `add` mark, nothing previews where a drag will land
  before it starts, and the end anchor is left selected after a drag
  (`packages/path-tools/src/lengthen/lengthenPath.ts`). Its toolbar glyph, `path-tools:lengthen`, has
  not been proofed large.
  Closes when the maintainer has driven Lengthen hands-on, the defaults and keys he picks are
  committed, and `path-tools:lengthen` has been proofed large.
- **(P2) [maintainer] Tune the Smudge brush hands-on, with the maintainer driving.** First-draft brush radius
  (40 screen px) and strength (0.6) (`DEFAULT_SMUDGE_RADIUS_PX`, `DEFAULT_SMUDGE_STRENGTH` in
  `packages/path-tools/src/smudge/smudgeBrush.ts`), the falloff `(1 − (d/r)²)²` and the subdivision threshold of a
  third of the radius (`packages/geom/src/paths/smudgePath.ts`), the size and strength steps (`[` `]` and
  Shift+wheel ×1.25, `Shift+[` `Shift+]` ±0.1) and their bounds (`SMUDGE_BRUSH_PARAMS` in `smudgeBrush.ts`; draw's options row draws
  them, and the last-operation panel after a stroke, which replays it and writes back to the row), that it pushes
  every unlocked, shown path and text node while nothing is selected (only the selection otherwise, a ruling of 2026-10-31), that text converts to outlines the moment the brush's disc meets
  its drawn box, the conversion and the smudge landing as one undo entry (ruled 2026-10-31;
  `packages/path-tools/src/shared/outlineSession.ts`), and its tool key, S
  (`packages/path-tools/src/smudge/useSmudgeBrushTool.ts`).
  Closes when the maintainer has driven the Smudge brush hands-on and the defaults and keys he picks
  are committed.
- **(P2) [maintainer] Tune path constraints hands-on, with the maintainer driving.** First-draft behavior and
  keys: `constrainAnchors` and `unconstrainAnchors` have no default keys (the lab binds C and
  Shift+C through `tune`); WeaselDraw binds Alt+Shift+H, V, L, P, C and F to horizontal, vertical,
  parallel, perpendicular, coincident and fixed, Alt+Shift+U to remove, and lists every kind in a
  Constraints menu (`apps/draw/src/constraintKeys.ts`, `apps/draw/src/surfaces/assets.tsx`); the two
  actions' glyphs (`packages/path-tools/icons/constraints.mjs`); the marks' look, their 12 px offset and 8 px click
  reach, and their teal and red (`packages/path-tools/src/constraints/constraintGlyphs.ts`,
  `packages/path-tools/src/constraints/constraintsExtension.ts`); a drag frame the constraints cannot hold in is dropped, so
  the path sticks rather than giving way (`edit-anchors/action.ts`); how far a dragged anchor
  yields to the rest (`HELD_MOBILITY` in `packages/geom/src/constraints/solve.ts`); and that the
  whole-path commands drop the list rather than keep what still applies
  (`pathCommands/pathNodes.ts`).
  Closes when the maintainer has driven path constraints hands-on and the defaults and keys he picks
  are committed.
- **(P2) [maintainer] Tune Perspective and free distort hands-on, with the maintainer driving.** First-draft
  corner handles (8 screen px squares, 8 px hit reach, `packages/path-tools/src/warp/warpHandles.ts`), that a
  new distort starts Free rather than Perspective, the refit tolerance (0.5,
  `DEFAULT_WARP_TOLERANCE` in `packages/path-tools/src/warp/warpTargets.ts`; Mode and Tolerance are in the
  last-operation panel after a drag, which replays it, `warpParams.ts`), that a selected group warps as
  one under a single quad around its paths, and that selected text converts to outlines when the drag begins,
  conversion and warp one undo step (both ruled 2026-10-31; `warpSelection.ts`,
  `packages/path-tools/src/shared/outlineSession.ts`), that the selection's resize and rotation handles hide
  while a warp tool is active (`hides` in `useWarpTool.ts`), and its tool key, F
  (`KEYS` in `packages/path-tools/src/warp/useWarpTool.ts`). Its label lives in `WARP_LABELS` beside it; the
  name may change.
  Closes when the maintainer has driven Perspective and free distort hands-on and the defaults and keys
  he picks are committed.
- **(P2) [maintainer] Tune Envelope mesh hands-on, with the maintainer driving.** First-draft 3 by 3 Bicubic
  mesh (`DEFAULT_ENVELOPE_SIZE`, `packages/path-tools/src/warp/warpTargets.ts`), the grid lines drawn
  between mesh points (`packages/path-tools/src/warp/warpHandles.ts`), that Rows and Columns change through
  `configureWarp` or the last-operation panel after a drag, which resamples the mesh the drag bent, and its tool
  key, Shift+F beside Distort's F, since draw's crop mode holds C (`packages/path-tools/src/warp/useWarpTool.ts`).
  Closes when the maintainer has driven Envelope mesh hands-on and the defaults and keys he picks are
  committed.
- **(P2) [maintainer] Tune Puppet warp hands-on, with the maintainer driving.** First-draft mesh density (about
  400 vertices, `puppetMesh` in `packages/geom/src/warp/puppetMesh.ts`), the solve's round caps
  (`ARAP_ROUNDS` and `ARAP_INJECTIVE_ROUNDS` in `packages/geom/src/warp/arap.ts`), that a click on the
  selection adds a pin and Alt-click on a pin takes it out, the pin dots (5 screen px radius,
  `packages/path-tools/src/warp/warpHandles.ts`), the refit tolerance (in the last-operation panel after a pin
  drag), and its tool key, B
  (`packages/path-tools/src/warp/useWarpTool.ts`).
  Closes when the maintainer has driven Puppet warp hands-on and the defaults and keys he picks are
  committed.
- **(P2) [maintainer] Tune draw's Symmetry toggle hands-on, with the maintainer driving.** Its key, the default
  kind and copy count, and where a new group's center lands (`toggleSymmetry`,
  `apps/draw/src/useSymmetry.ts`).
  Closes when the maintainer has driven draw's Symmetry toggle hands-on and the defaults and keys he
  picks are committed.
- **(P3) [maintainer] Undoing draw's symmetry group leaves Symmetry on, drawing into nothing.** Turning
  Symmetry on (or a New, an Open, or deleting the page its group is on, with it on) makes the group as an undo
  step of its own; one Undo removes it, the `view.symmetry` pref still reads on, and new shapes draw unmirrored
  until it is toggled off and on
  (`apps/draw/src/useSymmetry.ts`). Re-making the group on undo would wipe redo, and turning the pref off
  breaks Undo past a New, which today lands back in the old document's group. Needs a ruling: whether
  Symmetry's on/off is a pref or document state that undo moves.
  Closes when the ruling is made and an Undo of the group leaves the toggle and the drawing agreeing.
- **(P2) [maintainer] Tune the Measure tool hands-on, with the maintainer driving.** First-draft behavior and
  keys: its tool key, M, which moved Envelope mesh off it when the two met in draw; the Shift angle
  step; that Move by and Rotate by fall back to the newest measurement when none is picked; and the
  readout's look (`packages/core/src/tools/builtin/measure/`, `<MeasureReadout>` in `@weasel-js/ui`).
  Closes when the maintainer has driven the Measure tool hands-on and the defaults and keys he picks
  are committed.
- **(P2) [maintainer] Tune path start and direction hands-on, with the maintainer driving.** First-draft
  behavior and keys: `setPathStart` and `reversePath` have no default keys, an open subpath's
  interior anchor cannot become its start, and the direction marks' look (a 9 px orange arrow per
  segment and an 8 px start ring, `DIRECTION_DEFAULTS`), off by default under
  `path-edit.direction`, switched by the `pathEdit.show.direction` toggle, which draw keeps as a View
  preference (`packages/path-tools/src/pathStructure/`, `apps/draw/src/usePathOverlays.ts`).
  Closes when the maintainer has driven path start and direction hands-on and the defaults and keys he
  picks are committed.
- **(P2) [maintainer] Tune segment type hands-on, with the maintainer driving.** First-draft behavior and keys:
  a curved segment's handles start at its thirds, Shift+C with no `to` flips the lot by whether
  any is straight, and Shift+double-click flips one segment
  (`packages/path-tools/src/segmentType/convertSegments.ts`). Shift+C is also what the path
  constraints lab tunes onto `unconstrainAnchors`.
  Closes when the maintainer has driven segment type hands-on and the defaults and keys he picks are
  committed.
- **(P2) [maintainer] Tune anchor fields hands-on, with the maintainer driving.** First-draft behavior: the
  panel shows X and Y for any selection and handles only for a lone anchor, a typed handle mirrors
  on a smooth anchor, `+=`/`-=` offsets each anchor by its own amount, and draw shows it at the
  top of Properties in points (`packages/ui/src/components/AnchorFields/`,
  `packages/geom/src/paths/anchorFields.ts`, `apps/draw/src/RightSidebar.tsx`).
  Closes when the maintainer has driven anchor fields hands-on and the defaults and keys he picks are
  committed.
- **(P2) [maintainer] Tune the Girth tool hands-on, with the maintainer driving.** First-draft behavior and
  keys: Shift+W in draw; how near an edge a press must land to grab it (6 px, Grab reach in the last-operation
  panel after a drag); Alt moving one edge alone (One edge only in that panel flips it) and Alt-click clearing a
  width point; and whether a press between anchors should insert one
  (`packages/path-tools/src/girth/`).
  Closes when the maintainer has driven the Girth tool hands-on and the defaults and keys he picks are
  committed.
- **(P2) [maintainer] Tune snapping hands-on, with the maintainer driving.** First-draft behavior: one
  `targets.snapPx` reach of 8; every canvas snapping point gestures to other nodes' anchors through
  a default `'path-snap'` source; every path kind on, `nearest` included, once a consumer registers
  `pathSnapSource()`; the readout's glyphs, its fixed orange, and where a label sits; Ctrl to
  suspend; and that draw turns on the grid, measurement ends and anchors but not the other path kinds
  ([`docs/snapping.md`](./snapping.md), `packages/core/src/domains/snap/`,
  `packages/core/src/domains/paths/pathSnap/`).
  Closes when the maintainer has driven snapping hands-on and the defaults and keys he picks are
  committed.

## Text

- **(P2) [agent] Text cannot shrink to fit its box.** A poster's headline in a fixed box needs the largest
  size at which its text fits; `fitTextPose` only does the reverse, sizing the box to the text. The seam is one
  decision every reader shares, not a helper: a text node field (`fit: 'shrink'`) that `layoutTextPose` resolves to
  a scale on the node's and every run's `fontSize` and `letterSpacing`, `{ px }` sizes included, so the `kit:text`
  painter, `textToPath`, `measureTextBounds`, `caretIndexAt` and the edit overlay all set the text at the fitted
  size. A search over `layoutTextPose`'s bounds is the easy part; threading the scale through those readers is not
  an audit pass (found building a poster designer, audit round 20, 2026-11-12). Closes when a node with
  `fit: 'shrink'` paints, outlines and opens its editor at the fitted size under a test.

- **(P2) [agent] SVG export can neither embed the faces its text is set in nor write the text as outlines.**
  `serializeSvg` writes `<text font-family="…">`, which another renderer sets in whatever face it has. For
  outlines a consumer writes a `svgNodesFromKit` `leaf` over `textToPathsByPaint` and `svgPaintFromKit`; for an
  embedded face there is no way at all, though `fontEmbedding(family, weight, style)` already hands back the sfnt
  and its `embeddable` license bit. The seam: a `svgNodesFromKit` option lowering text leaves to their outline
  paths, and a `serializeSvg` option writing an `@font-face` per face from `fontEmbedding`, loaded by `warmSvg`
  (found building a poster designer, audit round 20, 2026-11-12). Closes when both write a text node set in a
  registered outline face, under a test, and an unembeddable face falls back to outlines with a warning.

- **(P3) [agent] A diagram body measured while its face is still loading keeps the fallback's size.**
  `rendererMeasure` (`packages/diagram/src/rendererMeasure.ts`) measures synchronously through
  `measureTextBounds`, and `templateSpecs`, `documentSpecs`, `commitSequence` and `applyChartTheme` store
  the sizes it returns in the scene. A face registered `lazy` (every app's Inter, `apps/shared/defaultFont.ts`)
  is measured as the fallback until it lands (`subscribeGlyphReady`'s doc), and nothing measures those bodies
  again when `faceGeneration()` moves, so a chart built before the face loads keeps bodies sized for the wrong
  font (read from the code, 2026-11-12; not reproduced in a browser). Too big for audit round 19: the fix is
  either an async wait for the faces a commit names before it measures, or bodies re-measured on a face
  change, and both touch every diagram commit path.
  Closes when a body committed while its face is pending ends up sized for the face once it loads, under a
  test that holds a lazy face pending across the commit.

- **(P3) [agent] WebKit at DPR 1 sets the overlay's glyphs on a third-pixel grid, rounding down,
  and starts each inline box on a whole pixel.** Measured 2026-10-29 by stepping `x` through a pixel
  in eighths: WebKit's overlay ink moves in steps of a third of a pixel, each taken late (Inter
  16px stays put from `x` 20 to 20.25 and moves next at 20.375 and 20.75), where Chromium and
  Firefox step by quarters to the nearest. A piece that starts between pixels paints from the one
  below: the small capitals of `"Hgd" Inter 72px small caps` start at 73.508 and paint from 73, so
  that case's `dRight` runs from -0.07 to -0.91 across the pixel, and is -0.79 at `x` 20 against
  the test's 0.75. It is the whole configuration, not that case: in
  `npx vitest run -c scripts/measure-overlay-alignment.config.ts`, 22 of WebKit DPR 1's 160 matrix
  rows fall outside the test's bounds, every one trailing the canvas (mean `dx` -0.14); WebKit DPR 2
  has 2, the same Arial 72px rows that Chromium DPR 2 has. Advances are not it: WebKit's DOM width of
  `GDGDGDGDGD` matches the atlas to 0.001px. Nothing on the overlay moves the grid: `will-change`,
  `translateZ(0)`, either `text-rendering`, and `-webkit-font-smoothing` left every pixel in place
  (the last moved the small-caps case 0.76px further left). A WebKit-only nudge only trades one
  case for another: a half pixel took the matrix mean `dx` to +0.36 and failed three cases, and a
  sixth of a pixel halved the mean `dx` at 40 and 72px but took Inter 16px's worst `dRight` from
  0.32 to 0.74. CI runs Chromium only. What is left is a ruling: accept it as WebKit's and give
  WebKit DPR 1 its own bound in the alignment test, or detect WebKit in text-dom and nudge.
  Ruled (2026-11-07): accept it as WebKit's. Closes when `overlayAlignment.browser.test.tsx` gives WebKit DPR 1
  its own bound.

- **(P3) [agent] A HUD menu's text row places its caret, selection and click as though the draft runs left to
  right.** `offsetsX` in `packages/hud/src/menu/valueRows.ts` puts offset `i` at the row's right edge less the width
  of the characters after it, which is where it sits only in left-to-right text; with a bidi engine registered the
  renderer lays a Hebrew or Arabic draft out right to left, so the caret, the selection band and `caretAt`'s click
  mapping land mirrored (read from the code, 2026-11-12; not run). Fixing it means taking each cluster's x from the
  laid-out line (`layoutRuns`, with its bidi levels) rather than from prefix widths, a split selection band where a
  selection crosses a direction change, and a caret affinity at those changes: more than an audit pass. Closes
  when a test typing a Hebrew draft into a HUD text row finds the caret at the line's left end and a click on a
  character's left half putting the caret after it.

---

## Scene, adapters & layout

- **(P3) [maintainer] A scene's pick ids are never given back, so a scene that keeps minting node ids
  stops painting.** `scenePickIds` numbers each node on its first paint and keeps the number for the
  scene's life, so an id learned from an id frame stays good. Nodes removed keep theirs, and once a scene
  has painted `MAX_PICK_ID` (2^24 - 1) distinct ids, `idOf` throws in the paint: a particle emitter
  minting 100 ids a frame reaches it in about 45 minutes at 60 fps. Reusing a removed node's number
  breaks the "stays good" promise for ids read before the removal, so it needs a ruling. Closes when
  removed nodes' numbers are reclaimed or the promise is kept some other bounded way (filed 2026-11-11).
- **(P2) [maintainer] The rulers' look is provisional.** `<Rulers>` (`packages/ui/src/components/Rulers`)
  draws with theme tokens only: `--wzl-surface` strips, `--wzl-fg-muted` ticks and labels at
  `--wzl-font-size-2xs`, a `--wzl-border` edge, an `--wzl-accent` pointer marker, 20 px thick, minor
  ticks 35% of the strip, labeled steps at most 100 px apart (2026-11-07). Nobody has looked at it in
  a browser yet; draw shows it under View > Show rulers and the site under the Rulers demo. Closes
  when the maintainer settles the look and the component draws it.
- **(P3) [maintainer] draw's guides are not saved with the document.** Guides dragged off draw's
  rulers live for the session (`apps/draw/src/useRulers.ts`); saving them is a change to the saved
  SVG. Closes when the maintainer rules whether and how a document keeps its guides, and draw does it.
- **(P2) [agent] An editor's session can only be saved to `localStorage`.** `useSessionPersistence`,
  `useAutosave` and `readStored` (`packages/editor/src/`) call `localStorage` directly, so an app that wants
  its document in IndexedDB rebuilds all of them over `@weasel-js/storage`'s `openRecords`: the debounce, the
  flush on leave, the undo stack dropped beside a snapshot that loads rebuilt (`snapshotRebuildsTree`), and the
  unreadable entry kept aside. An image the canvas ingests is embedded as a `data:` URI by default, so a
  document holding a few photos passes `localStorage`'s quota and every save fails. The seam is the hooks
  taking a `RecordCache` opened before the scene is made (its reads are synchronous once open), with
  `localStorage` the default; whether entries stay JSON text or become structured-clone values is the call
  to make. Closes when an app can keep its session in IndexedDB through the editor's hooks (filed 2026-11-12).
- **(P2) [recheck] Exporting a page as SVG, PNG or PDF lives only in `@weasel-js/diagram-formats`.**
  `exportPageSvg`, `exportPagePng` and `exportPagesPdf` (`packages/diagram-formats/src/page*.ts`) read
  nothing diagram-specific except the default background (the `diagram:theme` page color) and the diagram
  painters `pageSvgNodes` consults, yet an editor of any other kind must install `@weasel-js/diagram` and
  `@weasel-js/plot` to get them, or copy the walk from page rect through `planPixelRender` to `writePdf`.
  draw has no PNG or PDF export. Closes when a page of any scene exports through a package
  that does not depend on diagram, and diagram-formats builds its exports on it (filed 2026-11-12).
- **(P2) [agent] A sync layer can hear a scene's ops but cannot apply them to another scene.**
  `scene.history.observe` reports each entry's ops as `{ name, args }` (`kit:add`, `kit:setPose`, and an
  inverse as `revert:<kind>`), but those are the scene's registered ops, which `rebuildOp`
  (`@weasel-js/core/engine`) does not know, and no public call applies one to a peer scene; only
  `restoreHistory` rebuilds them (`OpTable.rebuild`), into a history. Closes when a scene can apply a
  serialized op another scene emitted, an undo included, without recording it (filed 2026-11-12).
- **(P3) [maintainer] A container with an output-grid `drawn` pose clips its children at its stored
  pose.** `buildSceneTree` paints and culls a node at the quantize rule's drawn pose (2026-11-11), but
  takes its `clip: 'outline'` (`ownClipOf`) from the pose it is stored at, so the clip can sit up to
  a grid cell off the container's painted edge. Children still compose from the stored pose, and
  picking reads it by design. Closes when the maintainer rules whether a clip follows the drawn pose,
  and the walk does what was ruled.

---

## Audio

- **(P3) [maintainer] Nobody has listened to the side-scroller's music bed.** `MUSIC_GAIN`
  in `usePlatformerAudio.ts` is set by measurement, to the RMS of the render
  the bed replaced, and `platformerBed.browser.test.ts` holds it there. What is
  left is the bus gain chosen by ear, or `createCompressorEffect` on the music
  bus in its place.
  Closes when the maintainer has listened to the side-scroller and set the music bus by ear, as a gain or
  a compressor.

- **(P3) [maintainer] Nobody has listened to the generative score.** Every number
  `scoreParams` maps a mood through was chosen from descriptions of the four
  cues and is tested as structure only. Whether dread reads as dread is for
  ears: the `score` demo (`apps/site/demos/ScoreDemo.tsx`) plays each cue with
  its parameters beside the sliders.
  Closes when the maintainer has listened to all four cues in the `score` demo and kept or retuned their
  `scoreParams`.

---

## Selection, actions & UI panels

- **(P3) [maintainer] A labkit tile drag shows its node's UUID as the ghost.** `<Workspace reorderable>` mounts
  windease's `DragProvider` with its default overlay, which labels the chip with the node's `meta.title` and falls
  back to its id; labkit sets no title, so dragging a trial by its title bar shows a UUID in an unthemed blue chip
  (seen 2026-11-11). Closes when the ghost shows the trial's title, or labkit draws its own.

- **(P2) [agent] labkit's annotation overlay crashes once about two dozen targets mount in one commit.**
  iconfab's lab (`~/src/iconfab/apps/lab`, labkit 1.19.0) declared one target per glyph proof, 66 at once,
  and the page died with React's "Maximum update depth exceeded"; registering the targets 12 at a time
  avoids it (iconfab's README, "Known problems", 2026-11-11). Reported by the agent that built the lab and
  not yet reproduced in weasel. Closes when a labkit test mounting 100 targets in one commit renders without
  the error and iconfab drops its batching.
- **(P3) [agent] labkit's annotation overlay trails a scrolled pane by a frame or two.** In the same lab, a
  stroke begun in the instant a pane scrolls lands on the target that was under the pointer before the
  scroll (2026-11-11, reported, not reproduced here). Closes when the overlay reads target rects in the same
  frame as the scroll, with a browser test that starts a stroke mid-scroll and finds it on the right target.
- **(P3) [agent] Annotation arrowheads scale with the target's content box, not the screen.** On a 20-unit
  target shown at 300px the heads draw very large (iconfab, 2026-11-11). Closes when a head's size is set in
  screen pixels, so the same arrow reads the same on a 20-unit and a 2000-unit target.
- **(P3) [agent] A list of objects summarizes as raw JSON on its control.** `f.list(def, f.object({ name, width }))`
  draws its trigger as `{"name":"primary","width":1.5,…}, …` (`summarizeValue`, `written`); a map of objects does
  the same. Seen in iconfab's Composer, 2026-11-11. Closes when an object entry summarizes by its first string
  field, or by a summary the schema supplies, with a test on the trigger's text.
- **(P3) [maintainer] `<Sequence>` past two sweeps.** It lays one sweep out as a list and two as a grid
  (`sweep` × `across`), both spatial. A third parameter and beyond needs some other way of showing it, not
  necessarily another spatial axis: color, opacity or overlay (onion skin) within a cell, or a sweep shown
  over time in each cell. Raised as a direction, not to build yet (2026-11-08). Closes when the maintainer
  has said how a third sweep shows and `<Sequence>` takes any number of sweeps.
- **(P3) [maintainer] Should the arrow keys land on an `aria-disabled` item?** `useRovingTabIndex` skips it,
  and `useRovingTabIndex.test.tsx` pins that. But `ToolButton`'s `ariaDisabled` promises such a button stays
  "reachable by keyboard (roving-tabindex still applies)", and a segment with a `disabledReason` swaps `disabled`
  for `aria-disabled` (`segmentTooltip.tsx`) so its reason can be read: in a `ToggleBar` or `ToolPalette` the
  keyboard never gets there, so the reason is mouse-only. APG allows either for a toolbar (2026-11-07). Closes when
  the maintainer has picked one and the hook, `ToolButton`'s doc and the test agree.
- **(P3) [maintainer] A timeline with a nonzero `start` can read "2.50s / 2.00s".** `PlayheadReadout`
  (ui `Timeline/Transport.tsx`) shows the absolute playhead over the duration, while the scrub bar runs from
  `start` to `start + duration`; `Transport.test.tsx` pins `-0.50s / 3.00s` for a timeline from −0.5 s to
  2.5 s. Either the second number becomes the end time, or the first becomes relative to `start`
  (2026-11-07). Closes when the maintainer has picked one and the readout and its test follow it.

- **(P3) [maintainer] Shift+F10 / the ContextMenu key may open the menu twice in Chrome on Windows/Linux.**
  The `menu.context` key binding opens it at the selection, and those platforms also send a
  native `contextmenu` event to the focused canvas, which would reopen it at that event's point.
  Headless Playwright sends no such event, so this is unverified. Check on a real Windows or
  Linux Chrome; if it reproduces, the likely fix is for the keydown to suppress the native event.
  Closes when Shift+F10 on a real Windows or Linux Chrome opens the menu once.


- **(P3) [waiting] Nothing in an app animates a selector's weights yet.** `prefWeightAxes` gives an
  animator target the axes, and nothing yet asks for a transition.
  Closes when an app animates a selector's weights through `prefWeightAxes`, or on 2026-12-31 with none,
  delete it.

- **(P3) [agent] Disabled has no signal of its own, now that emphasis is an alpha.** Disabled is `opacity:
  0.4`–`0.5` on the whole control, and subtle text is 0.54–0.64 alpha, so a disabled control and a
  subtle label can read alike. Ruled 2026-10-11: disabled gets a second cue besides fading. Which
  cue is not chosen yet; that leaves choosing it and giving it to every control that fades when
  disabled.
  Ruled (2026-11-07): the second cue is desaturation onto the neutral ramp. Closes when every control that
  fades when disabled also desaturates.

- **(P3) [agent] labkit's `Split` lays its content out past a narrow strip until its floors are measured.**
  `useZoneWidth` starts its `ResizeObserver` a tick after mount, so a trial narrower than a stored sidebar width
  plus the content's 160px floor first lays the content out overflowing the trial (seen 2026-11-11 in klieg's
  tube lab: a 259px strip with a 140px sidebar put a 160px content pane at x=141), then slides it 41px left
  once the floors arrive. Since `watchElementMove` reports that slide, surfaces follow it; what is left is the
  visible jump at load. Closes when a browser test mounts a 260px `TrialBody` with `width={140}` and finds the
  content inside the strip on its first painted frame.

- **(P3) [maintainer] labkit and the apps hand-build what weasel-ui already draws.** Each waits on something
  the ui component lacks, or on a look at the result in a browser:
  `.lk-titlebar-button` is 18px square and `Button`'s smallest size is `--wzl-control-h-sm`;
  `LabHeader`'s bare "Add trial" button, which sets its own baseline so its label lines up with the
  title and would lose that as a `Button` with a leading icon; and the theme editor's number inputs
  against `NumberField`.
  Closes when those three are drawn by `Button` and `NumberField`, or the maintainer has ruled that each
  stays hand-built.

- **(P3) [maintainer] Some site demos still draw a dark look in light mode.** Every demo now sits under a
  theme in the reader's mode, and a scene reads a theme color with `useColorHex`
  (`ViewportDemo`'s background). Left after the 2026-10-21 pass through every demo in light mode:
  `Kernel3dDemo`'s room, `ScoreDemo`'s roll and `EffectChartDemo`'s ground stay dark in both
  modes, which may be the look they want; undecided. Separately, the `.ckd-canvas` stage is
  `#6a6a6a` in both modes, and the scene labels drawn on it (`#a89878` in `AudioDemo`,
  `RigDemo` and `EasingsDemo`, `#1a130d` in `StrokeMarkersDemo`) are hard to read in either;
  whether the stage follows the mode is undecided, and the labels follow from that. The code
  panel's header still darkens with `rgba(0, 0, 0, 0.18)`: it sits on a sunken panel, and the
  theme's step toward `fg` would lighten it in dark mode.
  Closes when the maintainer has ruled on the three dark scenes and on whether the stage follows the
  mode, and the stage's labels and the code panel's header read in both modes.

- **(P3) [maintainer] Confirm Safari's trackpad pinch in real Safari.** `useGestureDispatcher`
  dispatches WebKit `gesturechange` as a `pinch` gesture, which `viewport.zoom`
  binds, and swallows ctrl+wheel while a claimed gesture is live. All of it is
  tested in jsdom against a stand-in event. Unverified: that Safari fires
  `gesturestart` before the first ctrl+wheel copy (if it does not, that first
  sample zooms once through the wheel binding), and that preventing
  `gesturestart` / `gesturechange` stops the page zoom in the Safari versions
  that send both channels.
  Closes when the maintainer has pinched a canvas in real Safari and seen it zoom once per sample with no
  page zoom.

- **(P3) [maintainer] `<ToggleBar>` polish.** Visual still needs polish — literally, polish this, by eye in a
  browser. Measured in Chromium 2026-10-13, three text segments, each variant at `md` and `sm`:
  every segment sits inside its track at one height, none clips its label, and a focused segment
  draws a 2px outline, so nothing measured is known to be off. Since then `minimal` takes its font
  size from `size`, where both sizes drew at the `sm` font; nobody has looked at its `md`.
  Closes when the maintainer has looked at every variant at `md` and `sm` in a browser and called it
  done.

- **(P3) [maintainer] Nobody has looked at the desktop themes' bevels.** Under `win9xTheme` and
  `platinumTheme` (`@weasel-js/theme/themes/*`), every control in `@weasel-js/ui` that draws a
  raised face, a well, or a button that stays down reads the `--wzl-bevel-*` hooks;
  `packages/theme/src/hooks.ts` says which takes which. Each was chosen from computed values
  and one headless screenshot per theme, not by eye. Drawn with no bevel: `StatusBar`, a
  `minimal` segmented control, a mixed segment, and a notched slider thumb, whose clip path a
  box shadow ignores. The checkbox, radio, switch, overlays, flat segment cells, and toolbar
  strips keep their own 1px border inside the bevel, where the field frame drops its border
  through `--wzl-field-border`. The systems' own faces are named in the font stacks and not
  bundled; a bundled lookalike needs a face whose license allows it.
  Closes when the maintainer has looked at every beveled control under both themes and kept or retuned
  its hooks.

### WeaselDraw app follow-ups (defer)

- **(P3) [maintainer] draw's SVG Save drops the measurements.** A saved file keeps paper size, title, groups,
  names, locks and line height under the `wd:` namespace (`apps/draw/src/svgInterop.ts`), but no layer list and
  no layer id on a shape, and `svgExport.ts` leaves out everything on an annotation layer as it leaves out a
  hidden one. Draw keeps its measurements on the `annotations` layer (`drawDocument.ts`), so a drawing saved and
  opened again has none, though a reload keeps them. Closes when the maintainer rules whether a saved file
  carries its measurements (and so the layer each shape is on), and Save and Open do what was ruled.

- **(P2) [maintainer] Tune draw's surface assets hands-on, with the maintainer driving.** Which groups form which
  asset, each one's default surface, and where switching lives were picked without anyone using
  them (`apps/draw/src/surfaces/assets.tsx`). Today Arrange (reorder, align, distribute, flip),
  Pathfinder, and Path (path, anchors) default to toolbars in the dock row under the command row; a panel's header
  switches it from a menu button showing its surface, and a toolbar or menu button switches from its
  context menu and, for a menu, from the menu's last rows. Preferences lists every asset with its
  surface and flags.
  Closes when the maintainer has driven a tuning session through draw's surface assets and their groups,
  defaults, and switching are what he settled on.

---

### Domain bundles

- **(P3) [agent] A presentation bundle and a whiteboard bundle.** Each a `Contribution` bundle, the way
  `@weasel-js/diagram` is (`createDiagramContribution`). Ruled (2026-11-07): build both.
  - Presentation: a slide-navigation contribution that sherpa (the presentation runtime) can mount — keys and
    view animation stepping between pages, over `layoutPages`, `fitViewToPage` and `adjacentPage`
    (`packages/core/src/core/pages/`). Not an in-canvas slide format (ruled 2026-10-17).
  - Whiteboard: bundles core's `usePencilTool`, `useTextTool`, and `useStickyTool` (built-in id `sticky`, a text
    node with a `background`; its look is `toolOptions.sticky`). apps/draw leaves `sticky` out today: its
    `TextObj` and SVG round trip carry no text `background` or `padding`, and SVG import reads a written note
    back as a rect and a text node, so that round trip is part of the work.
  Closes when both contributions ship and draw round-trips a sticky.
### d3 integration plugin

- **(P3) [maintainer] `d3-zoom` / `d3-drag` adapters — parked.** Both duplicate kit systems
  (the `viewport.zoom` / `viewport.dragPan` / `viewport.wheelPan` actions, `useHandTool`,
  `useViewAnimation`; `useDragGesture`).
  Worth building only for d3 semantics the kit genuinely lacks, not for parity —
  none identified yet.
  Closes when a d3 zoom or drag behavior the kit lacks is named and adapted, or on 2026-12-31 with none,
  delete it.

---

## forge

`@weasel-js/forge` is the component workshop built on labkit: each story renders
in the workshop page as a lab trial with controls. A story that sets `isolate`
renders in an iframe ("frame") instead; that path is frozen, kept for as long
as any story needs it, and `check:forge-isolate` holds the count. It is the
only story runner in the repo.

- **(P3) [agent] The workshop's marks come back, to draw on a reported issue's screenshot**
  (2026-10-25). The Issues panel lists a component's `forge:<component>` issues through the dev server's `gh` and
  opens GitHub's new-issue page for a report, where the reporter pastes a screenshot (2026-10-28). The workshop
  turns labkit's marks off (`marks={false}` in `packages/forge/src/shell/Workshop.tsx`), so nothing in it can mark
  up the trial before that screenshot is taken. Not decided: whether marks come back for that; deferred (2026-10-28).
  Ruled (2026-11-07): yes. Closes when the workshop draws marks on the trial while Report is open.

- **(P3) [waiting] What holds `fseventsd` when macOS file events stop arriving is not known.** Measured
  2026-10-13 with `fseventsd` at 98% CPU and 2.6 GB: a write in a temp directory reached neither
  `fs.watch` on that directory nor the `fsevents` module in 12 seconds, while a watch on the file
  itself fired at once, and a dev server served none of three edits. Every dev server in the repo
  now warns when it starts in this state (`watchProbe`, `packages/forge/src/vite/watchProbe.ts`),
  and the one test that needs a real watcher skips. Since 2026-10-30 the symptom is covered: dev
  servers find unreported edits by modification time (`watchRecovery`, beside `watchProbe`), so a
  page gets the edit within seconds rather than never. The cause needs the machine in that state.
  Closes when a capture of `fseventsd` in that state (a `sample` or `spindump`) names what holds it, or
  on 2026-12-31 with no sighting, delete it.

---

- **(P3) [maintainer] Icons for the package pages.** Said to be specced (gray and blue React icons, an orange
  window, and three others), but no spec has been found in the repo or in either account's weasel transcripts.
  It lives in the "Packages page icons prototype" Remote Control session (said 2026-11-07).
  Closes when the icons are on the package pages.

## Demos & visual regression

- **(P3) [waiting] `SegmentsArcView`'s arc test missed by 3.5 px in one full fleet run.** "segments sit on the
  arc, edge to edge, and the well runs one rim past the first and last"
  (`packages/ui/src/components/ToggleBar/lab/SegmentsArcView.browser.test.tsx`) read 54.49 against 51
  ± 0.5 in a full run on teitou on 2026-10-24 (at the features-to-domains rename, which touches no ToggleBar code),
  then passed 3 of 3 alone on the same node and tree (job e82589ab). Seen once; a measurement taken
  before a face or a layout settles is the first thing to look for.
  Closes when it fails again, which makes it a fix, or on 2026-11-30 with no second sighting, delete it.

- **(P3) [waiting] chart's audio browser test timed out clicking a menu row in one full fleet run.** "plays an
  oscillator into the output, draws it as a scope or a spectrum, and closes its engine when the mode is left while
  it plays" (`apps/chart/src/pipeline/audio.browser.test.tsx`) hit `locator.click: Timeout 2435ms exceeded` on the
  `Chart` menuitemcheckbox, resolved, visible and stable, in a full run at e8ab0d680 (2026-11-03, a batch touching
  the renderer's retained tiles but no chart code), then passed 3 of 3 alone on teitou at the same tree. Seen once.
  Closes when it fails again, which makes it a fix, or on 2026-12-03 with no second sighting, delete it.

- **(P3) [waiting] `segmentsAlong`'s first "a lit end segment fills the well round its cap" case failed
  intermittently** (full fleet run of `main` at `437648aa4`, 2026-10-26). Since ac92a714c the test waits
  for `document.fonts.ready` after a first frame; that the face was the cause is inferred, not
  reproduced. Delete the entry if the next full runs pass it.
  Closes when 10 full fleet runs after 2026-10-26 pass it, or at its next failure, which makes it a fix.
- **(P3) [waiting] `LabFit.browser.test.tsx`'s "sidebar fits a medium viewport" failed once in a full fleet
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
  Closes when the next failure's stdout names the problem it saw, which makes it a fix, or on 2026-11-30
  with no second sighting, delete it.

- **(P3) [waiting] `MenuTextValue.browser.test.tsx`'s "commits it on Enter without closing" closed the menu once under load.**
  In the full fleet run of 7168695bf (2026-11-03) `close` was called once, with no arguments, by the time Enter
  had committed `Nested`; the file passed alone on the fleet minutes later, and in about 45 other full runs. The failure
  screenshot (still on studio, under `.vitest/attachments/failure-screenshots/`) shows the menu whole, Name highlighted,
  `Nested` in the field and the field's focus border mid-fade, so focus had just left it. `close` was a mock, so it
  could have been called any time after render. Read from the code (2026-11-03), no path reaches it from the test's
  own input: the controller closes only on Escape, Tab or choosing an item, and the field's keys never reach it; the
  dismiss closes on a window `blur`, a `resize`, or a press or wheel outside the panel. Ruled out by reading vitest
  5.1 and Playwright, not by a run: a `blur` from another tab (Playwright emulates focus per page), from another frame
  (each tab holds one test iframe, and the orchestrator focuses nothing), a `resize` from the next file's viewport
  reset (it lands before `execute`), and a command left running by an earlier file (no test timed out in that run, and
  every `userEvent`/`commands` call is awaited). The test now records the event each `close` and `set` call ran
  in, and requires that Enter's keydown wrote the row, so the next failure names its trigger.
  Also ruled out by reading (2026-11-05): the fading focus border is Enter handing focus to the panel, which every
  pass does; the click's own events (its bubbled press opens a text row, its pointerup is disarmed, and vitest's
  `focusIframe` calls `window.focus()` only with focus on `body`); and an earlier file's frame, which vitest
  removes before it creates the next.
  Closes when the cause is found and fixed, or after 20 fleet full runs with the file green.
- **(P2) [maintainer] `theme.browser.test.tsx`'s "grows a shape with its text" saves no typed text in Linux CI.**
  On 179f2409d (2026-10-21, run 39523286313) and again on 33efd3167 (2026-10-22, run 39761178968)
  `savedBody().row.data.text` stayed `''` past the poll after Escape, so the six typed `M`s
  presumably went somewhere other than the open editor overlay (inferred; no screenshot survives).
  Twice in two Linux runs, so likely Linux-specific rather than a flake; not reproduced in 158
  fleet runs of the test on 2026-10-21. The fleet sweep's failures of this
  test were a different thing, pixels read from the frame before the repaint, fixed 2026-10-21.
  Repro lane: `onto do --kind test --node studio -- node scripts/browser-linux.mjs --project=browser <files>`
  (Playwright's Linux image under Docker, arm64 rather than CI's x86), not yet run end to end because
  Docker is not running on studio (2026-10-26).
  Closes when the test saves its typed text in two consecutive Linux CI runs, or the Linux lane
  reproduces the failure and the fix lands.

- **(P3) [waiting] `effect-chart.spec.ts`'s `maxDiffRatio` of 0.004 was copied from `diagram.spec.ts`.** Its
  baselines were first captured on 2026-10-26 (CI run 40266349908); once a few CI runs have compared
  against them, set the ratio from the diffs they report.
  Closes when `maxDiffRatio` in `tests/visual/effect-chart.spec.ts` is set from the largest diff five CI
  runs report against these baselines.

- **(P3) [waiting] A dev server on orochi has missed a file write.** A site dev server there served a file
  as it was before an edit on 2026-10-12, and a `touch` did not wake it. Seen once and not
  reproduced. `forge/src/vite/plugin.test.ts` lost file events for its temp directory the same way,
  7 of 26 tests in one run on 2026-10-13, and polls since. Every dev server now recovers from a
  missed event (2026-10-30): `watchRecovery` (`packages/forge/src/vite/watchRecovery.ts`, in
  `devWatch()` and forge's plugin) compares each served file's modification time with the one vite
  read, on each request and after two quiet seconds, and logs `[watch] <file> changed with no file
  event` when it fixes one. What is left is the cause: the next time that line appears for a file in
  a checkout, note the server, the file, and whether `fseventsd` was busy, here.
  Closes when such a line is recorded here with its server, file, and `fseventsd` state, or on 2026-12-31
  with none, delete it.

- **(P3) [waiting] `npm pack` died with SIGABRT and no output in the consumer smoke step.** A
  `test:fleet:postbuild` run of d9f7bb7ba's predecessor 570d272b7 on 2026-10-24 failed
  `test:smoke:consumer` at `scripts/smoke-consumer-bundle.mjs:271` with `signal: 'SIGABRT'` and empty
  stdout and stderr; a rerun of the same commit passed every step. Seen once. A second sighting
  says it is not load.
  Closes when it is seen a second time, which makes it a fix, or on 2026-11-30 with none, delete it.

---

## Backends (WebGL future)

- **(P3) [waiting] Gradient ramp resolution at print scale** — 1×256 LINEAR ramps verified adequate for 8-bit
  output (interpolation error < 1/255 per channel); revisit only if >8-bit output lands.
  Closes when output deeper than 8 bits lands and the ramp's error is measured under one step of it, or
  on 2027-01-01 with none, delete it.
- **(P3) [agent] Batched pattern fills may lose tile precision far from the origin.** Read from the code, not
  run: `draw/patternBatch.ts` stores tile coordinates per vertex as float32 without taking whole tiles out
  first, where the unbatched `bindPattern` does (audit round eleven, 2026-11-09). It would show around 1e7 world
  units. Needs a GPU to confirm. Closes when a batched pattern at 1e7 draws the same tile as an unbatched one, in
  a browser test.

(WebGL1 fallback explicitly rejected — WebGL2 only.)

---

## Release-gate & build hygiene

- **(P2) [agent] Two of labkit's floating-sidebar tests fail when their file runs alone.** In
  `Trial.floatPanel.test.tsx`, "closes on a press outside it, and the toggle closes what it opened" and "keeps a
  section torn out of the panel in the workspace once the panel closes" failed 3 of 3 fleet runs of
  `vitest run --project=labkit <that file>` at `c7b148f5e` (2026-11-11), and 1 of 3 locally, yet pass inside the
  full suite. Something the suite sets up that the file does not set up itself. Closes when the file passes alone.

- **(P3) [waiting] `workerRender.browser.test.tsx` "dims a node by the alpha the page computes" read a null pixel
  once under the full suite** at `b7ed8c10f` (2026-11-11), then passed 3 of 3 runs alone. Waiting on a second
  sighting under load.

- **(P2) [agent] The site dev server dies on its first edit to a workspace package.** Saving a file
  under `packages/core/src` logs `re-bundling workspace packages: <file>` (`scripts/vite-prebundle.ts`),
  then `transport was disconnected, cannot call "fetchModule"` against `scripts/vite-wake.ts` and
  `server restart failed`. The server keeps answering, but with the code from before the edit, so a
  browser check after a package change passes or fails on stale source. Seen twice in a row on `npx vite`
  at `bb2b7ec72` (2026-11-11). Suspect `68004a234`, which reloads the dev config through vite's module
  runner on this restart.

- **(P3) [waiting] typedoc's own minimatch 10 carries GHSA-g3hv-75wg-m249 (moderate, dev only).** The root
  overrides minimatch to `^11.0.5` under eslint, typescript-eslint and ts-morph; typedoc 0.28 calls `matchOne`,
  which minimatch 11 removed (`build:forge` exited "mini.matchOne is not a function", 2026-11-07), so it keeps
  10.2.x, and `npm audit` reports this one finding. Closes when a typedoc release takes minimatch 11 and the
  override covers it, leaving `npm audit` at 0.

- **(P3) [waiting] `npm ci` aborted once with code 134 inside labkit's `prepare` build.** Seen in the first
  `test:fleet:postbuild` run of `34de8c76d` under Node 24 (2026-10-21); labkit's build passed alone
  on the same node and on the rerun. Not looked at.
  Closes when it is seen a second time, which makes it a fix, or on 2026-11-30 with none, delete it.

- **(P3) [agent] labkit's `JobProgress.browser.test.tsx` misses its width check by 0.5 px at 100.**
  "at 100: expected 182.96875 to be close to 182.453125" in the batch run of `d7714ec60` (2026-11-11), and the
  same two numbers again in the suite run of `ccecc970d` (2026-11-11) on teitou; it passed 3/3 alone on the fleet
  after the first. Identical figures twice read as a real width change at three digits, not rasterizing noise
  (inferred, not measured). Rework the check, or the count's sizing for its total, so 100 holds the width.


- **(P2) [agent] Browser test files fail to load when the node's network changes.** A file
  fails whole with `Failed to import test file … Caused by: TypeError: Failed to fetch dynamically
  imported module`, along with any file loading in the same tenth of a second, and the next run
  passes. The cause is Chromium: on a macOS network change it drops every request in flight, those
  to vite on localhost included, with `net::ERR_NETWORK_CHANGED`. Seen once since `watchRequests`
  (`scripts/vitest-browser-commands.ts`) began logging failed loads (2026-10-26): in the
  palette-carry run on studio, configd logged `IPMonitor] network changed` at 18:13:55.736 on
  2026-10-28, and 66 ms later 376 module requests failed with `ERR_NETWORK_CHANGED` and
  `apps/chart/src/pipeline/pages.browser.test.tsx` loaded no tests (measured, from the job log and
  `log show --process configd` on the node). It was the only weasel test job of 491 run from
  2026-10-25 to 10-29 that overlapped a logged network change, and the only one with a load failure.
  - **How often.** `IPMonitor] network changed` events, 2026-10-28 to 10-29: studio about 35 a day,
    msb-uai 9 in 13 h, keiei 6 in 25 h, teitou 4 in 19 h (measured). Studio alone is on both
    Ethernet (en0) and Wi-Fi (en1), and its event came right after an IPv6 republish on en1; that
    the Wi-Fi link is why studio has the most is inferred. Some events are the whole LAN's: at
    16:12:32 on 10-29 all four nodes logged one within 0.4 s (measured). That explains the
    2026-10-25 bursts 3 s apart on studio and msb-uai (inferred: the nodes' logs no longer reach back).
  - **Where to find a sighting.** A run's log holds `weasel-request <epoch ms> <ISO> net::ERR_NETWORK_CHANGED script …`
    lines at the failed import's `browserv` stamp, and the node's `log show --process configd`
    holds the event, for a day or two before it rotates. onto keeps each job's log in
    `~/.config/onto/archive/<node>/<job>/`.
  - **Not available.** Headless Chromium has no switch to ignore address changes (searched the
    strings of Playwright's `chrome-headless-shell` 1248, 2026-10-29), and vitest retries tests,
    never a file's import.
  - **The decision.** Either take studio's Wi-Fi down while it has Ethernet, which removes its own
    events and leaves the LAN-wide ones, or have `scripts/vitest-overlap.mjs` run again only the
    files that loaded no tests when the run logged `ERR_NETWORK_CHANGED`. The second is a rerun the
    suite does on its own, which nothing in it does today.
    Ruled (2026-11-07): the rerun. Closes when `scripts/vitest-overlap.mjs` reruns the files that loaded no
    tests in a run that logged `ERR_NETWORK_CHANGED`.


---

## weaselchart

`apps/chart`, a Visio-style diagram editor with a pipeline mode, built on `@weasel-js/diagram`.

- **(P3) [maintainer] Check `@weasel-js/rig`'s and `@weasel-js/diagram-formats`' trusted-publisher
  registration.** Both are on the registry at 1.11.1 under `latest` and `pre` (`npm view`,
  2026-10-21); whether each is registered as a trusted publisher (`docs/releasing.md`, "Setting up a
  new package") can only be read on npmjs.com.
  Closes when the maintainer has read both packages' settings on npmjs.com and registered any that was
  missing.
