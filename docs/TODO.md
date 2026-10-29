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

Owner tags, after the priority (2026-10-26):
- **[agent]** — an agent can take it alone, making any engineering call inside it itself
- **[maintainer]** — needs the maintainer: a look, name, feel or saved-output change he reserved,
  hands-on tuning, a ruling he made to revisit, or hardware or an account only he has
- **[recheck]** — unsure which; the next pass settles it, asking if it has to
- **[waiting]** — nothing to do until something outside happens: a second sighting, CI history, a
  consumer's own run, a backend no node has

---

## Tools & gestures

- **(P3) [maintainer] External-content ingestion — the drag ghost seen in a real OS drag.** While a drag
  hovers, the dispatcher calls the drop action's `preview`, and `ingest` draws a placeholder box per claimable
  file (or one for text) through `previewPaths` (`packages/core/src/domains/ingestion/ghost.ts`). No test can
  start a real OS drag, so the ghost has not been seen: check that it follows the pointer, clears on Esc, on
  leave and on drop, and looks right in WeaselDraw. A handler-supplied ghost (a handler naming its own
  preview size or shape per MIME) is not built.

- **(P3) [maintainer] The image and SVG drop handlers could leave core.** `kitImageHandler` /
  `embedFilesAsImageNodes`, `kitSvgHandler` (which reuses the image embed), and `openFilePicker` in
  `packages/core/src/domains/ingestion/` are about 300 lines no kernel path needs; the registry,
  the `ingest` action, the `ingestion` dep, and the weasel-JSON handler stay, since Cmd+V of the
  canvas's own content runs through them. Moving them makes a file drop do nothing on a bare
  `<SceneCanvas>` until the consumer installs the handlers. Left in place for now (ruled
  2026-10-11). If they do move, the package is `images`; `ingest` was turned down.

- **(P3) [recheck] `apps/theme-editor` cannot become a `<Lab>` without being rebuilt.** `<Lab>` is the trial
  runtime: it requires a non-empty `instruments` list, seeds a trial, and renders `children` into
  the header while its body is fixed as the surface buffers plus a `Workspace` of trials.
  PaletteLab's page *is* the shell body, and the `#/theme` workbench beside it is a second bare
  `LabShell` page. Moving them in means making each an instrument and running it in a trial pane,
  with labkit's per-trial store and persistence beside its own, and a trial titlebar beside its own
  `PropertyPanel`. Its own arc, and the first question is whether labkit should support a lab with
  no trials at all.

- **(P3) [maintainer] Long-press: the native `contextmenu` a touch hold sends is unseen on a real device.**
  `useGestureDispatcher` treats a `contextmenu` that arrives while a touch or pen hold is in
  progress as that hold's long-press, so a `contextMenu` binding runs once. Tested only in jsdom
  with a hand-sent event (`useGestureDispatcher.nativeLongPress.test.tsx`). Left: hold a finger on
  a canvas with a `contextMenu` binding in Android Chrome and confirm one menu, and that the event
  really arrives while the pointer is still held rather than after a `pointercancel`.

- **(P3) [maintainer] AltGr matching is unchecked in a real browser.** The keyboard channel
  (`packages/routing/src/interactions/dispatcher/channels/keyboard.ts`) dispatches the chord as
  reported, and when nothing takes it and `getModifierState('AltGraph')` holds, dispatches again
  without Ctrl and Alt. Only jsdom has seen it. Left to check on Windows, with a layout that has
  AltGr: that Chrome and Firefox both report AltGraph for it, and that a plain Ctrl+Alt+letter, for
  which Firefox reports AltGraph too, is still read as a chord.

### Cursor package follow-ups

- **(P3) [maintainer] Cursor rasterization is unmeasured in Safari.** Chrome and headed Firefox are measured
  (`packages/cursor/scripts/probe/README.md`, "Measured browser behavior"); the
  baker's plain SVG `url()` is right for both. `node probe.mjs <dir> --browser safari` in
  `packages/cursor/scripts/probe/` is the instrument, and its readings cannot be trusted yet: its
  first run drew the arrow control and then the crosshair for every case after it, and every later
  run drew the crosshair even for the arrow — with the page frontmost, over HTTP (`--page http`) as
  well as `data:`, stepping by reload as well as by hash. Safari's cursor is not following the page
  under this driver, and why is the open question. A finding lands in `bake.ts`.

---

## Viewport

- **(P3) [agent] Put 2D on kernel3d's ground plane.** Ruled: the ground, at right angles to `up` as `insert` reads it (2026-10-28). kernel3d's frustum outlines into a 2D view as its footprint on z = 0, which in kernel3d's y-up world is a wall
  facing yaw 0, and `aimSpace3d` unprojects onto the same plane, while `insert` already casts onto the plane through
  the origin at right angles to its `up` (default y). Move `aim.ts` onto that ground through one function both share,
  mapping 2D (x, y) to the two axes `up` is not, and say in a changeset that a 2D view's footprint and aim move.

---

## Paths & booleans

- **(P3) [maintainer] Repeat Along does not use `placeAlongRun`.** Its count and spacing semantics differ from the
  primitive's, and moving it would change the output of saved documents.

- **(P3) [maintainer] Bend Along blends its heading across a path's sharp corners.** `measurePath` has `keepCorners`, which
  Text Along Path uses; turning it on for Bend Along changes saved documents' output, so it is Mike's call.

- **(P3) [recheck] Path edit through a text-along effect dims the curved text with everything else.** Lighting it would make
  it pressable in that mode; a design call.

### Path editing tricks

- **(P1) [maintainer] Rename the path tools the maintainer deferred to the end of the adoption pass.**
  Envelope mesh becomes Cloth warp, among others; the Width tool is already Girth. They live in
  `@weasel-js/path-tools` now (`packages/path-tools/README.md`); the move kept every name.
- **(P2) [maintainer] Tune the Simplify brush hands-on, with the maintainer driving.** It went in from its
  audition lab with first-draft behavior and keys: brush size and its key, the tolerance it
  applies, and how it shows what it will remove (`packages/path-tools/src/simplifyBrush/simplifyBrush.ts`).
- **(P2) [maintainer] Tune the curvature comb hands-on, with the maintainer driving.** First-draft default
  scale and density, when it shows, and no key to toggle it (`packages/path-tools/src/comb/comb.ts`).
- **(P2) [maintainer] Tune Balance handles hands-on, with the maintainer driving.** First-draft behavior: a
  grip drag scales both handles by one factor, read off the pointer's projection onto the line the
  grip slides along, and a length lock (`handleLock.length`, or Mod) holds it still
  (`packages/geom/src/paths/balanceHandles.ts`, `packages/path-tools/src/balance/handleBalance.ts`). Its look: a purple
  line between the handle tips and a 4px hollow grip, drawn under the anchor markers and beaten by
  them on a press (`packages/path-tools/src/balance/balanceMarks.ts`). Off by
  default under `path-edit.balance`, with no key to show it, and Equalize handles has only the
  grip's double-click (`apps/site/demos/BalanceHandlesLabDemo.tsx`).
- **(P2) [maintainer] Tune handle locks hands-on, with the maintainer driving.** Which locks deserve keys, and
  whether a lock holds through a modifier drag (`handleLock.*`, `packages/path-tools/src/handleLocks/handleLocks.tsx`).
- **(P2) [maintainer] Tune Bridge hands-on, with the maintainer driving.** First-draft default Tension (0.4,
  `DEFAULT_BRIDGE_TENSION`), how Tension is reached outside the lab, and the Alt+J binding
  it shares with Bridge anchors (`packages/path-tools/src/bridge/bridge.ts`).
- **(P2) [maintainer] Tune Harmonize curvature hands-on, with the maintainer driving.** First-draft behavior:
  it keeps the product of each anchor's two handle lengths, takes every smooth anchor when none is
  selected, and skips anchors the curve inflects through (`packages/geom/src/paths/harmonize.ts`,
  `packages/path-tools/src/harmonize/harmonize.tsx`). It has no key of its own; its lab tunes H onto it,
  which the Hand tool also answers wherever that tool is mounted
  (`apps/site/demos/HarmonizeLabDemo.tsx`).
- **(P2) [maintainer] Tune anchor selection along the path hands-on, with the maintainer driving.**
  First-draft behavior and keys: `]` grows and `[` shrinks by one anchor, Alt+N selects every Nth
  (N defaults to 2, counted from the first selected anchor, with no UI for N outside the lab's
  `tune`), Alt+C corners, Alt+M smooth anchors, and Alt+I the complement; grow and shrink stay
  within a subpath, and none of them is an undo step
  (`packages/path-tools/src/anchorSelect/anchorSelect.ts`, `packages/geom/src/paths/anchorSelection.ts`).
- **(P2) [maintainer] Tune Resample hands-on, with the maintainer driving.** First-draft behavior: no key,
  driven only as an ongoing action; a count of 0 keeps the path's anchor count, corners are held
  by default, the refit tolerance is 0.5 and a piece that misses it is halved up to six times, so
  the result can hold more anchors than asked for (`packages/path-tools/src/resample/resample.ts`,
  `packages/geom/src/paths/resamplePath.ts`).
- **(P2) [maintainer] Tune Add extremes hands-on, with the maintainer driving.** First-draft behavior and key:
  Alt+X adds to segments whose two ends are both selected, or to the whole path while no anchor
  is, so a selection reaching no whole segment does nothing; the new anchors join the selection
  (`packages/path-tools/src/extremes/addExtremes.ts`, `packages/geom/src/paths/extremaAnchors.ts`).
- **(P2) [maintainer] Tune corner shape hands-on, with the maintainer driving.** First-draft behavior and keys:
  a widget sits 14 screen px inside each corner anchor, past the middle of its cut, and is hit
  within 6px; anchors within 0.05 rad of straight get none. A widget drag sets the radius from the
  pointer's travel along the bisector, every selected corner's when its anchor is selected, and a
  corner with no spec takes `round`. Giving a sharp corner a shape cuts a quarter of its room
  (`DEFAULT_CORNER_TRIM_SHARE`). `cycleCornerShape` has no key of its own (its lab tunes K onto it, the
  Slice tool's key elsewhere), `setCorners` is reached only through the panel, the
  panel's curvature slider spans -4 to 4, and the widgets show by default under
  `path-edit.corners` with no key to hide them (`packages/path-tools/src/cornerShape/`,
  `packages/geom/src/paths/cornerShape.ts`, `apps/site/demos/CornerShapeLabDemo.tsx`).
- **(P2) [maintainer] Tune Blend, Bend along a path, and Repeat along a path hands-on, with the maintainer
  driving.** First-draft step counts, spacing, and turn defaults, their keys, and how an effect is
  re-edited and expanded (`packages/path-tools/src/pathEffects/`, and core's `domains/pathEffects/`).
- **(P2) [maintainer] Tune Trim segment hands-on, with the maintainer driving.** First-draft click reach (6
  screen px, `DEFAULT_STROKE_REACH_PX` in `packages/path-tools/src/shared/scenePaths.ts`), the preview's look (the
  `cut` overlay role's red dash at width 3, `packages/path-tools/src/trim/piecePreview.ts`), and its tool key,
  Y (`packages/path-tools/src/trim/useTrimTool.ts`). The `trimPath` action itself has no key.
- **(P2) [maintainer] Tune Extend to next path hands-on, with the maintainer driving.** First-draft click reach
  (the same 6 screen px as Trim segment, `packages/path-tools/src/shared/scenePaths.ts`), that a curved end grows a
  straight run rather than following its curvature (`lengthenOpenEnd`, which is Lengthen's
  `lengthenPathEnd` in tangent mode, `packages/geom/src/paths/lengthenPathEnd.ts`), no preview of where an end will land, its tool key, U
  (`packages/path-tools/src/extend/useExtendTool.ts`), and no default key for the `extendToMeet` action; the
  lab binds E through `tune`.
- **(P2) [maintainer] Tune Lengthen hands-on, with the maintainer driving.** First-draft behavior and keys: the
  tool toggle has no key; a plain drag grows along the end tangent and Shift along the end
  curvature (the `mode` param flips which); a curvature arc stops at a full turn, and a trim always
  leaves a thousandth of the subpath (`packages/geom/src/paths/lengthenPathEnd.ts`); an end is
  pressed within 8 screen px, the cursor is `penPlus`, nothing previews where a drag will land
  before it starts, and the end anchor is left selected after a drag
  (`packages/path-tools/src/lengthen/lengthenPath.ts`). Its toolbar glyph, `path-tools:lengthen`, has
  not been proofed large.
- **(P2) [maintainer] Tune the Smudge brush hands-on, with the maintainer driving.** First-draft brush radius
  (40 screen px) and strength (0.6) (`DEFAULT_SMUDGE_RADIUS_PX`, `DEFAULT_SMUDGE_STRENGTH` in
  `packages/path-tools/src/smudge/smudgeBrush.ts`), the falloff `(1 − (d/r)²)²` and the subdivision threshold of a
  third of the radius (`packages/geom/src/paths/smudgePath.ts`), how radius and strength are
  reached outside the lab, and its tool key, S (`packages/path-tools/src/smudge/useSmudgeBrushTool.ts`).
- **(P2) [maintainer] Tune path constraints hands-on, with the maintainer driving.** First-draft behavior and
  keys: `constrainAnchors` and `unconstrainAnchors` have no default keys (the lab binds C and
  Shift+C through `tune`), and which kind C adds is a param with no UI outside the lab
  (`packages/path-tools/src/constraints/anchorConstraints.ts`); the marks' look, their 12 px offset and 8 px click
  reach, and their teal and red (`packages/path-tools/src/constraints/constraintGlyphs.ts`,
  `packages/path-tools/src/constraints/constraintsExtension.ts`); a drag frame the constraints cannot hold in is dropped, so
  the path sticks rather than giving way (`edit-anchors/action.ts`); how far a dragged anchor
  yields to the rest (`HELD_MOBILITY` in `packages/geom/src/constraints/solve.ts`); and that the
  whole-path commands drop the list rather than keep what still applies
  (`pathCommands/pathNodes.ts`).
- **(P2) [maintainer] Tune Perspective and free distort hands-on, with the maintainer driving.** First-draft
  corner handles (8 screen px squares, 8 px hit reach, `packages/path-tools/src/warp/warpHandles.ts`), that a
  new distort starts Free rather than Perspective, the refit tolerance (0.5,
  `DEFAULT_WARP_TOLERANCE` in `packages/path-tools/src/warp/warpTargets.ts`), and its tool key, F
  (`KEYS` in `packages/path-tools/src/warp/useWarpTool.ts`). Its label lives in `WARP_LABELS` beside it; the
  name may change.
- **(P2) [maintainer] Tune Envelope mesh hands-on, with the maintainer driving.** First-draft 3 by 3 Bicubic
  mesh (`DEFAULT_ENVELOPE_SIZE`, `packages/path-tools/src/warp/warpTargets.ts`), the grid lines drawn
  between mesh points (`packages/path-tools/src/warp/warpHandles.ts`), that Rows and Columns change only
  through `configureWarp`, and its tool key, Shift+F beside Distort's F, since draw's crop mode holds C
  (`packages/path-tools/src/warp/useWarpTool.ts`).
- **(P2) [maintainer] Tune Puppet warp hands-on, with the maintainer driving.** First-draft mesh density (about
  400 vertices, `puppetMesh` in `packages/geom/src/warp/puppetMesh.ts`), the solve's round caps
  (`ARAP_ROUNDS` and `ARAP_INJECTIVE_ROUNDS` in `packages/geom/src/warp/arap.ts`), that a click on the
  selection adds a pin and Alt-click on a pin takes it out, the pin dots (5 screen px radius,
  `packages/path-tools/src/warp/warpHandles.ts`), and its tool key, B
  (`packages/path-tools/src/warp/useWarpTool.ts`).
- **(P2) [maintainer] Tune draw's Symmetry toggle hands-on, with the maintainer driving.** Its key, the default
  kind and copy count, and where a new group's center lands (`toggleSymmetry`,
  `apps/draw/src/useSymmetry.ts`).
- **(P2) [maintainer] Tune the Measure tool hands-on, with the maintainer driving.** First-draft behavior and
  keys: its tool key, M, which moved Envelope mesh off it when the two met in draw; the Shift angle
  step; that Move by and Rotate by fall back to the newest measurement when none is picked; and the
  readout's look (`packages/core/src/tools/builtin/measure/`, `<MeasureReadout>` in `@weasel-js/ui`).
- **(P2) [maintainer] Tune path start and direction hands-on, with the maintainer driving.** First-draft
  behavior and keys: `setPathStart` and `reversePath` have no default keys, an open subpath's
  interior anchor cannot become its start, and the direction marks' look (a 9 px orange arrow per
  segment and an 8 px start ring, `DIRECTION_DEFAULTS`), off by default under
  `path-edit.direction` with draw's View toggle as the only switch
  (`packages/path-tools/src/pathStructure/`, `apps/draw/src/usePathDirection.ts`).
- **(P2) [maintainer] Tune segment type hands-on, with the maintainer driving.** First-draft behavior and keys:
  a curved segment's handles start at its thirds, Shift+C with no `to` flips the lot by whether
  any is straight, and Shift+double-click flips one segment
  (`packages/path-tools/src/segmentType/convertSegments.ts`). Shift+C is also what the path
  constraints lab tunes onto `unconstrainAnchors`.
- **(P2) [maintainer] Tune anchor fields hands-on, with the maintainer driving.** First-draft behavior: the
  panel shows X and Y for any selection and handles only for a lone anchor, a typed handle mirrors
  on a smooth anchor, `+=`/`-=` offsets each anchor by its own amount, and draw shows it at the
  top of Properties in points (`packages/ui/src/components/AnchorFields/`,
  `packages/geom/src/paths/anchorFields.ts`, `apps/draw/src/RightSidebar.tsx`).
- **(P2) [maintainer] Tune the Girth tool hands-on, with the maintainer driving.** First-draft behavior and
  keys: Shift+W in draw; how near an edge a press must land to grab it; Alt moving one edge alone
  and Alt-click clearing a width point; and whether a press between anchors should insert one
  (`packages/path-tools/src/girth/`).
- **(P2) [maintainer] Tune snapping hands-on, with the maintainer driving.** First-draft behavior: one
  `targets.snapPx` reach of 8; every canvas snapping point gestures to other nodes' anchors through
  a default `'path-snap'` source; every path kind on, `nearest` included, once a consumer registers
  `pathSnapSource()`; the readout's glyphs, its fixed orange, and where a label sits; Ctrl to
  suspend; and that draw turns on the grid, measurement ends and anchors but not the other path kinds
  ([`docs/snapping.md`](./snapping.md), `packages/core/src/domains/snap/`,
  `packages/core/src/domains/paths/pathSnap/`).
- **(P3) [maintainer] Equal spacing on a turned resize, and where its alignment marks sit.** Decision for the
  maintainer (2026-10-18). A resize whose frame turns or skews the box moves no side of its
  axis-aligned extent alone, so `resizeEdges` (`packages/core/src/domains/snap/resizeBox.ts`)
  answers no edges and `spacingSnapSource` offers nothing; alignment still runs, but its marks span
  the box at the press rather than where it lands. Open question: should spacing on a turned box
  measure its extent, its own frame, or stay off?
- **(P3) [recheck] Are the snap readout's drawing helpers public API?** Decision for the maintainer
  (2026-10-18). `tickedSegment`, `pillCommands` and `measuredSegmentCommands` are on
  `@weasel-js/core`'s barrel because guides' layer draws with them. Either they stay as designed
  public surface, or they move to an `internal` entry (as `@weasel-js/routing/internal` does),
  which `audit:jsdoc` treats as a sibling-package surface.
- **(P3) [maintainer] Roughen, zigzag and pucker/bloat exist only on the `pel-effects-push` branch.** That
  branch stored effects as a `data.effects` list on the path itself, a design main did not take
  (`f082c838e` adopted its push brush as Smudge and left the rest). Its math is in
  `packages/geom/src/effects/` there; carrying the three over means rebuilding each as a derived
  effect node beside blend, bend and repeat. Undecided whether to; the branch is kept until then.
- **(P3) [recheck] WeaselDraw binds no constraint action.** It needs keys or a bar group for
  `constrainAnchors` and `unconstrainAnchors`, and icons for them.

## Rendering & paint

- **(P3) [agent] Renderer: geometry far from the origin is still single precision.** The transform stack
  is in doubles, a large model translation is rebased before upload (`setProjAndModel`,
  `u_origin`), and a gradient's or a pattern's paint space is rebased the same way (`bindGradient`
  measures from the gradient's own start, `bindPattern` drops whole tiles). Both are proven by
  float32 arithmetic (`draw.precision.test.ts`, `draw.paintPrecision.test.ts`), not in a browser
  far from the origin. Near it, `gradientStart.browser.test.ts` shows the shader honors the rebase
  (2026-10-21). A path's coords are measured from `PolygonPath.origin` past `ORIGIN_THRESHOLD`
  (2^14) wherever geometry is made or mapped — `transformPath` by default, `joinPaths`, rect
  tessellation (2026-10-27). Still float32 for a consumer's own stage, which has no origin to rebase
  against: the model (`u_view` on a shader command, `u_model` in a registered paint kind) and the
  paint matrix a registered kind asks for (`PaintBindContext.spaceInverse`).

---

## Text

- **(P3) [maintainer] The edit overlay's text lands on whole CSS pixels; the canvas's does not.** The overlay
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

- **(P3) [agent] WebKit at DPR 1 fails one overlay-alignment case, because it paints text on whole
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

- **(P3) [agent] At 12px with a script, the atlas tier's ink still sits ~0.55px off the overlay's at DPR
  1, and the sign follows the sub-pixel phase.** `dx` is −0.5 at `x` 20 and +0.5 at 20.5 in every
  engine; DPR 2 agrees within 0.06. The stems of a 7.2px `H` are ~0.65px wide, and the shader
  reads coverage from the distance at each pixel's center, so a stem centered on a pixel carries
  about twice the ink of one straddling two. Center-sampled coverage cannot do better; area
  coverage would need several field taps per fragment on small glyphs. The same rows show `dy` of
  ±0.45, which is unexplained. The `super`/`sub` 12px rows of
  `npx vitest run -c scripts/measure-overlay-alignment.config.ts` show both.

- **(P3) [agent] Complex-script shaping, what is left after `@weasel-js/text-shaping`.** Shaping (`registerShaper(await
  loadShaper())`, 2026-10-27) reaches only text whose face is registered with `registerFontOutlines` from TrueType
  or OpenType bytes, and PDF export writes shaped glyphs by index since 966c37fdc. Text drawn from an atlas (baked or
  canvas) is still laid out one code point at a time, because atlases look glyphs up by code point and cannot draw
  a shaped glyph index. Open pieces:
  - Script pieces are cut over a fixed list of scripts. Any other script is one piece, and its direction is
    guessed from the right-to-left Unicode blocks.
  - PDF export does not write a text's `lang` (2026-10-27): no `/Lang` on the catalog or on marked content, so a
    screen reader or text extraction guesses the language.
  - harfbuzzjs awaits at its module's top level, so a consumer bundling for a target below ES2022 fails (esbuild
    0.27 errors; Vite 8 warns), even though `loadShaper` reaches it only through a dynamic `import()`.
    `@weasel-js/text-shaping` cannot avoid it: harfbuzzjs 1.6.4, the latest, exports only that module and not its
    `init`. Fixing it needs an upstream entry without the `await`, or a vendored copy of harfbuzzjs's helpers.
    The `.wasm` itself survives Vite 8 with no config, in both `vite build` and the dev pre-bundle (measured in a
    throwaway consumer, 2026-10-27).
  - PDF export of a mark that is its own cluster (Arabic fatha) reads back in poppler with a space before it,
    because the mark is set off the baseline. pdf.js ignores `/ActualText`, so it reads a cluster's unmapped
    glyphs as control characters (`\u0007`) and drops some raised dots.

---

## Scene, adapters & layout

- **(P3) [agent] A scene add-and-remove round trip costs 2.4 µs, against 1.3 µs on 2026-09-29.** Native imports,
  this machine, flat across tree depth since the lock guard stopped climbing (2026-10-27). About 0.4 µs is
  2026-10-13 599685677, which records every scene edit as the kit ops it caused, and `setPose` pays the same
  feature about 0.2 µs. The rest arrived across later scene commits and is not narrowed: probe with
  `tests/perf/bench/scene-ops.bench.ts`, or a plain loop over `scene.add`/`scene.remove` under
  `tests/perf/bench/node-hooks.mjs`.

- **(P3) [agent] The unindexed area walk got three times slower between 2026-09-29 and 2026-10-22.** The 25%
  marquee over 10,000 rect nodes (`hitTestArea`, `scatterScene`) took 3.04 ms at 9db2cae5f and
  8.97 ms at 394b86d43 (medians, keiei, one session, 2026-10-22); the pick-index branch's own full
  walk is 8.42 ms, so the branch did not cause it. The index hides it for marquees in a still
  scene, but every pick after a change still walks. Bisect with
  `tests/perf/recorded/pick-index-2026-10-22/across-commits/run.sh` (edit its commit list); the
  raw runs are beside it.
  The recorded runs' `conditions.txt` show a load average of 5.9–7.4 on keiei's 8 threads, so part of
  the 3x may be contention: bisect on a quiet node (4,893 commits, about 13 steps).

- **(P3) [maintainer] A direct scene call made while a journal is open lands on the scene's own stack.**
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

---

## Animation

### Earlier deferrals

From `docs/specs/2026-05-04-animation-primitive-design.md`:

- **(P3) [agent] GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts.

---

### labkit presentation mode

- **(P3) [maintainer] agnew plays from its own transport, not a lab clock.** agnew and rosee both mount
  `<Lab>` on their `main`. agnew's three.js view advances the pen itself and holds a finished curve
  before redrawing it, so moving it onto a lab clock is an agnew library change, and the owner's
  call.

## Audio

- **(P3) [maintainer] Nobody has listened to the side-scroller's music bed.** `MUSIC_GAIN`
  in `usePlatformerAudio.ts` is set by measurement, to the RMS of the render
  the bed replaced, and `platformerBed.browser.test.ts` holds it there. What is
  left is the bus gain chosen by ear, or `createCompressorEffect` on the music
  bus in its place.

- **(P3) [maintainer] Nobody has listened to the generative score.** Every number
  `scoreParams` maps a mood through was chosen from descriptions of the four
  cues and is tested as structure only. Whether dread reads as dread is for
  ears: the `score` demo (`apps/site/demos/ScoreDemo.tsx`) plays each cue with
  its parameters beside the sliders.

---

## Selection, actions & UI panels

- **(P2) [agent] Enter commits mid-composition in two DOM text fields** (2026-10-28). `MenuTextValue`
  (`packages/ui/src/components/ContextMenu/MenuValue.tsx`) and `RenameField` (`PageTabs/RenameField.tsx`) pass every
  Enter to `editEnd`, so a Japanese or Chinese user confirming a candidate with Enter commits the half-typed text.
  text-dom's `useTextEdit` skips keys while `isComposing`, and the hud filters them in `textInputHost.ts`; these two
  need the same check ahead of `editEnd`.

- **(P3) [agent] A tree's Left and Right don't swap in a right-to-left layout** (2026-10-28). `treeKey`
  (`packages/headless/src/tree.ts`) ignores `ListShape.dir`, so in RTL Right still opens a branch. The tree keys
  also differ from the WAI-ARIA treeview pattern in ways kept on purpose so far: no `*` to expand every sibling,
  Space activates like Enter instead of toggling selection, and Shift+Home/End extends where the pattern uses
  Ctrl+Shift+Home/End.

- **(P1) [agent] Rework how a pref leaf says it can be auto.** Three fields on a leaf say it today
  (`packages/prefs/src/schema.ts`): `manual` (never auto), `unpinned` (starts auto), and `autoValue` (what it reads
  while auto, where its owner computes nothing; unset, it reads no value), and a schema can set them against each
  other. Ruled (2026-10-28): one field, `auto`. Left out, the leaf can be auto and starts pinned at `default`;
  `auto: false` is never auto; `auto: { on: true }` starts auto; `auto: { value: x }` reads `x` while auto, and
  without `value` an auto leaf has no value, as now. The three old fields go, with every reader moved
  (`PrefsForm`'s `onAutoChange`, labkit's `rowAuto.ts`, `autoConfig.ts`, `baseNode.ts`, `MatrixCell.tsx`, the schema
  editor's Auto panel and `kindSchemas.ts`), and a changeset saying the schema shape changed.

- **(P2) [maintainer] Bar along an arc: clockwise and counterclockwise lay out identically.** `placeAlongRun` now takes
  `order: 'reading' | 'track'`, so the arc's direction could set which end item 1 sits at, with readability
  governing only each item's rotation, plus an `Along`-level `side`. That changes the default layout of curved
  bars, so it is waiting on a decision (2026-10-22). Deferred (2026-10-22).

- **(P3) [maintainer] The menu bar's default access chord, Alt, is unverified in Chrome on Windows, which may
  open its own menu on Alt+F; check there before relying on it.**

- **(P3) [maintainer] Shift+F10 / the ContextMenu key may open the menu twice in Chrome on Windows/Linux.**
  The `menu.context` key binding opens it at the selection, and those platforms also send a
  native `contextmenu` event to the focused canvas, which would reopen it at that event's point.
  Headless Playwright sends no such event, so this is unverified. Check on a real Windows or
  Linux Chrome; if it reproduces, the likely fix is for the keydown to suppress the native event.

- **(P4) [agent] A headless-component layer shared by DOM and WebGL chrome.** `@weasel-js/headless` (added
  2026-10-27, not yet published) holds a list's roving highlight and typeahead, generic over item type (`rovingKey`,
  `stepStop`, `typeaheadStep`), a tree's Right/Left (`treeKey`) and a row list's whole key dispatch (`rowKey`),
  reordering a list (`moveItems`, `isNoopDrop`, `nudgeGap`, `gapByMidpoint`, `nearestGap`), how a text field's edit
  ends (`editEnd`), and keyboard focus as one contract, `FocusScope<T>`, with `tabSort`/`tabStep`.
  `@weasel-js/menu` runs each menu level on the list half, ui's `useRowNavigation` and `useRovingTabIndex` step and
  type ahead through it (`useRowNavigation` takes every key but the nudge from `rowKey`), `Hud` is a `FocusScope<Widget>`, and ui's `domFocusScope(root)` is the same contract over DOM
  elements. Held steppers repeat through `createStepRepeat`, in ui's `UnitField` and on the hud menu's number chips.
  Left, in order: a measure/draw contract a DOM component and a hud widget both implement; then porting a
  button and a list onto it. A page that has both DOM controls and a hud canvas still joins the two at `attach.ts`'s
  `wireFocus`, not through `FocusScope`.

- **(P3) [maintainer] Should grid and guide snaps line up the stroke?** Decision for the maintainer.
  `gridSnapSource` and `guideSnapSource` (`packages/guides/src/sources/`) snap the subject's
  `origin` probe, its pose origin, so a rect with a centered stroke 10 wide lands with its stroke's
  outer edge 5 short of the line. Snapping the drawn box instead would put the stroke's edge on it,
  which is what the selection chrome, resize, and `alignmentSnapSource` measure, and every stroked
  shape would land half a stroke from where it lands today. Either answer is now a one-line change
  to the two sources' `roles` (`'origin'` to `'box'`). Insert and the pen are a different case and
  stay as they are: they snap the pointer, before the node has a stroke to measure.

- **(P3) [waiting] Nothing in an app animates a selector's weights yet.** `prefWeightAxes` gives an
  animator target the axes, and nothing yet asks for a transition.

- **(P3) [maintainer] Disabled has no signal of its own, now that emphasis is an alpha.** Disabled is `opacity:
  0.4`–`0.5` on the whole control, and subtle text is 0.54–0.64 alpha, so a disabled control and a
  subtle label can read alike. Ruled 2026-10-11: disabled gets a second cue besides fading. Which
  cue is not chosen yet; that leaves choosing it and giving it to every control that fades when
  disabled.

- **(P3) [recheck] labkit and the apps hand-build what weasel-ui already draws.** Each waits on something
  the ui component lacks, or on a look at the result in a browser:
  `.lk-titlebar-button` is 18px square and `Button`'s smallest size is `--wzl-control-h-sm`;
  `SidebarRegion`'s section head and undock button against `SidebarPanel`, which takes no
  `actions`, no undock control, no stance, and no `fill`; `LabHeader`'s bare "Add trial" button,
  which sets its own baseline so its label lines up with the title and would lose that as a
  `Button` with a leading icon; the theme editor's swatch tabs against `ToggleBar`'s flat variant
  and its hex and number inputs against `Input` and `NumberField`.

- **(P3) [recheck] Some site demos still draw a dark look in light mode.** Every demo now sits under a
  theme in the reader's mode, and a scene reads a theme color with `useColorHex`
  (`ViewportDemo`'s background). Left after the 2026-10-21 pass through every demo in light mode:
  `Kernel3dDemo`'s room, `ScoreDemo`'s roll and `EffectChartDemo`'s ground stay dark in both
  modes, which may be the look they want; undecided. Separately, the `.ckd-canvas` stage is
  `#6a6a6a` in both modes, and the scene labels drawn on it (`#a89878` in `AudioDemo`,
  `RigDemo` and `EasingsDemo`, `#1a130d` in `StrokeMarkersDemo`) are hard to read in either;
  whether the stage follows the mode is undecided, and the labels follow from that. The code
  panel's header still darkens with `rgba(0, 0, 0, 0.18)`: it sits on a sunken panel, and the
  theme's step toward `fg` would lighten it in dark mode.

- **(P3) [recheck] Holding the peek key and then moving onto a loupe no longer raises it.** Since #40's fix
  (2026-10-19) the peek binding takes `opts: { over: true }`, so Alt goes to the loupe under the
  pointer when it goes down and to none if the pointer is over no loupe; nothing re-sends a held key
  when the pointer arrives. Keeping both behaviors with two loupes on a page needs routing to re-send
  a held key when the pointer enters a host that binds it. Undecided whether the sweep-on gesture is
  worth that.

- **(P3) [maintainer] Confirm Safari's trackpad pinch in real Safari.** `useGestureDispatcher`
  dispatches WebKit `gesturechange` as a `pinch` gesture, which `viewport.zoom`
  binds, and swallows ctrl+wheel while a claimed gesture is live. All of it is
  tested in jsdom against a stand-in event. Unverified: that Safari fires
  `gesturestart` before the first ctrl+wheel copy (if it does not, that first
  sample zooms once through the wheel binding), and that preventing
  `gesturestart` / `gesturechange` stops the page zoom in the Safari versions
  that send both channels.

- **(P3) [recheck] Reconcile `BandEditor` with `Slider`.** `BandEditor` (bands: a contiguous tiling of an
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

- **(P3) [maintainer] `<ToggleBar>` polish.** Visual still needs polish — literally, polish this, by eye in a
  browser. Measured in Chromium 2026-10-13, three text segments, each variant at `md` and `sm`:
  every segment sits inside its track at one height, none clips its label, and a focused segment
  draws a 2px outline, so nothing measured is known to be off. Since then `minimal` takes its font
  size from `size`, where both sizes drew at the `sm` font; nobody has looked at its `md`.

- **(P3) [recheck] A lab's config schema takes no `over`.** A lab resolves its instrument's config schema
  with none (`useConfigSchema`), so that schema cannot alias into another schema or hold a
  condition on its setting. Every surface reads `over`'s values from the config it is handed, and
  a trial's config holds its instrument's alone: where a lab keeps another schema's values (each
  trial's config, the lab's store, or the app's) is not decided, and the instrument's `render`
  would need them too.

- **(P3) [recheck] An empty fragment takes no drop in the live preview.** It draws nothing
  (`display: contents` with no rows), so `Prefs/dropTarget.ts` has no rect to measure it by, and
  only the structure tree drops into it. Needs a call on the look: drawing it a slot while a drag
  is on would give the preview somewhere to land, and would also move the rows around it.

- **(P3) [recheck] `PrefSchemaEditor` sees only a `ResolvedConfig`'s `group`.** A schema built with
  `f.section` keeps its sections, `showIf` rules, `.render` overrides, and `.dialog` rows beside
  the `PrefGroup` tree, not in it, so the editor shows a sectioned schema as one flat list and its
  export drops all four. A schema is sectioned rather than nested where `f.group` would move its
  config paths. `ResolvedConfig` is labkit's and `@weasel-js/ui` cannot import labkit, so this
  needs decisions before it is built: how a labkit section shows in the structure tree (a
  `PrefSection` cannot sit in a `PrefGroup` root outside an `object` leaf, so either a new node
  kind or a group marked to keep its config paths); what the export writes for a schema whose
  source is `f.section(…)` calls rather than a literal; and whether labkit wraps `AssetEditor`
  and converts both ways, or `@weasel-js/ui` gains the vocabulary itself.

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

- **(P3) [recheck] Two control choices are labkit's alone, and two controls draw an enum their own way.**
  Which control a leaf draws is one table (`PARAMS_CONTROLS`, `Prefs/surfaceControls.ts`), but two
  of its rows were carried over from labkit undecided: `enumAsAsked: false` (`radio` draws as
  segments, `menu` as a select) and `openSlider: false` (a slider needs both bounds). Outside the
  table, `Bar/BarField.tsx` draws an enum's `radio` as segments on every surface, and labkit's
  `MatrixEditor` always lists an enum as radios.

- **(P3) [recheck] What each group `as` draws differs across the params surfaces.** The run of neighboring
  `tab` groups is collected once (`prefTabRuns`, `@weasel-js/prefs`); what is drawn is not: `panel`
  is a bordered box in ui and a plain `PropertyGroup` in labkit; `section` is a `Subpanel` in
  labkit and a heading elsewhere; a group's `description` shows under a tab in `PrefsPane` and is
  dropped for tabs and sections in labkit; `SelectionPanel`'s top level flattens nested sections
  (`flatten` in `model.ts`), so a nested `tab` or `panel` loses its `as` while the object leaf
  beside it honors nesting; an empty tab section is left out of the run in `objectRows`, a hidden
  one in labkit, and `PrefsPane` has no emptiness check.

### WeaselDraw app follow-ups (defer)

- **(P3) [recheck] draw's SVG files do not carry layers.** A saved file keeps paper size, title, groups, and
  line height under the `wd:` namespace (`apps/draw/src/svgInterop.ts`) but no layer list and no
  layer id on a shape; export only leaves hidden layers out (`svgExport.ts`). Nothing is lost yet:
  draw has the one layer, `'default'` (`WeaselDrawLayer`, `drawDocument.ts`), and no way to add
  another, and `openSvg.ts` puts every node on it. Whether a page has its own layers is undecided,
  and the file format waits on that.

- **(P2) [maintainer] Tune draw's surface assets hands-on, with the maintainer driving.** Which groups form which
  asset, each one's default surface, and where switching lives were picked without anyone using
  them (`apps/draw/src/surfaces/assets.tsx`). Today Arrange (reorder, align, distribute, flip),
  Pathfinder, and Path (path, anchors) default to toolbars in the dock row under the command row; a panel's header
  switches it from a menu button showing its surface, and a toolbar or menu button switches from its
  context menu and, for a menu, from the menu's last rows. Preferences lists every asset with its
  surface and flags.

---

### Domain bundles

- **(P3) [maintainer] A presentation bundle and a whiteboard bundle.** Each would be a `Contribution` bundle,
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

- **(P3) [maintainer] `d3-zoom` / `d3-drag` adapters — parked.** Both duplicate kit systems
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

- **(P3) [recheck] On Linux, a second save within 50 ms of the first can leave the dev server serving the
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

- **(P3) [recheck] A story whose `render` takes no args has no controls.** forge reads a
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

- **(P3) [agent] The Issues panel has no tracker behind it** (2026-10-25). `shell/issues/IssuesPanel.tsx` takes
  `issues` and `onReport` as props, and the workshop passes neither, so it says "Not connected" and Report stays
  disabled. Settled so far: GitHub Issues is the tracker, a component's issues are those labeled
  `forge:<component>`, and a report attaches its story, a link reopening it with the same args and globals, and
  the branch and commit. A screenshot with the trial's marks on it goes into the issue by pasting it there;
  never by committing it to the repo. Ruled (2026-10-28): forge's dev server lists a component's issues through
  `gh issue list --label forge:<component>` (the local `gh` login, no token in the browser), and Report opens
  GitHub's new-issue page with its title, body and label filled in, where the screenshot is pasted. Still open:
  whether marks come back (next entry) to draw that screenshot.

- **(P3) [recheck] The CSS Vars panel does not save a token the theme derives.** A token
  edited by hand saves when the definition writes its value out: a pin, a
  component, or a literal semantic, in the branch the trial's globals read
  (`applyTokenEdits`, `packages/forge/src/shell/cssVars/saveTokens.ts`). One
  that follows another token, a ramp, a contrast rule, or an alpha stays a
  per-trial override, and so does a scale step changed after its scale, because
  a value written over it would drop the derivation for every mode and density
  the branch covers. Not decided: whether such an edit should save at all, and
  if so as a pin over the one step or as a change to what it follows.

- **(P3) [agent] windease lays out a node that was registered and never shown.** A
  strip gives a `mounted` node its room and a seam, while `Container` renders
  only `visible` ones, so the pane is an empty gap with a live separator
  (`layout-node-adapter.js` skips `hidden` and `destroyed` only; windease
  2.0.0). `Split` works around it by showing its sidebar node and hiding it
  again (`createSplitStore`, `packages/labkit/src/primitives/Split.tsx`). The
  fix belongs in windease; the workaround goes when it lands.

- **(P3) [agent] A forge dev server's RSS climbs about 200 MB a restart, outside the JS heap.** With the
  heap leak fixed (`restartLeavingNothing`, `scripts/vite-prebundle.ts`), heap after GC goes 89 to 113 MB
  over 6 restarts where it went to 269, but `scripts/probe-dev-restarts.ts` on teitou (2026-10-26) still
  shows RSS growing, so it is native memory, rolldown's presumably (not traced).

- **(P3) [waiting] What holds `fseventsd` when macOS file events stop arriving is not known.** Measured
  2026-10-13 with `fseventsd` at 98% CPU and 2.6 GB: a write in a temp directory reached neither
  `fs.watch` on that directory nor the `fsevents` module in 12 seconds, while a watch on the file
  itself fired at once, and a dev server served none of three edits. Every dev server in the repo
  now warns when it starts in this state (`watchProbe`, `packages/forge/src/vite/watchProbe.ts`),
  and the one test that needs a real watcher skips. The cause needs the machine in that state.

- **(P3) [agent] wake (`~/src/wake`, not this repo): a server's exit-time release can drop another app's
  registry entry.** `releaseSync` and `releaseExtraSync` in `~/src/wake/src/claim.ts` read the
  registry and write it back without the lock `updateRegistry` (`~/src/wake/src/state.ts`) takes.
  Scenario: server A exits while server B, another app, is inside `updateRegistry`; A reads, B
  writes its entry, A writes back its earlier read with only its own holder cleared, and B's entry
  is gone, so B's next start picks a port as though it had never run. Nothing synchronous can take
  the port lock; either re-read and compare just before the write, or have the next `claim` treat a
  dead holder as released and make the exit-time release a no-op.
  Fixed on wake's `locked-release` branch (2026-10-26), unmerged; retire it once that merges.

- **(P3) [agent] wake (`~/src/wake`, not this repo): the pill calls a busy server unreachable.** It shows "dev
  server unreachable" whenever `/__wake` takes over 5 s to answer, so a server stalled in a slow
  module load reads the same as a dead one. That is what a fresh site server showed until
  a598e6b2d (2026-10-20) took the demo timestamps' per-file `git log` out of its first load.
  Fixed on wake's `busy-badge` branch (2026-10-26), unmerged; retire it once that merges.

---

## Demos & visual regression

- **(P3) [waiting] `SegmentsArcView`'s arc test missed by 3.5 px in one full fleet run.** "segments sit on the
  arc, edge to edge, and the well runs one rim past the first and last"
  (`packages/ui/src/components/ToggleBar/lab/SegmentsArcView.browser.test.tsx`) read 54.49 against 51
  ± 0.5 in a full run on teitou on 2026-10-24 (at the features-to-domains rename, which touches no ToggleBar code),
  then passed 3 of 3 alone on the same node and tree (job e82589ab). Seen once; a measurement taken
  before a face or a layout settles is the first thing to look for.

- **(P3) [waiting] `segmentsAlong`'s first "a lit end segment fills the well round its cap" case failed
  intermittently** (full fleet run of `main` at `437648aa4`, 2026-10-26). Since ac92a714c the test waits
  for `document.fonts.ready` after a first frame; that the face was the cause is inferred, not
  reproduced. Delete the entry if the next full runs pass it.
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

- **(P3) [waiting] `AnnotationOverlay.clip.browser.test.tsx`'s "a mark is cut where its target is" failed once
  in a full fleet run.** At 98d525569 on 2026-10-28 (teitou) the browser project read 534.3125 against
  533.078125 (tolerance 0.5); the same file passed 3 of 3 alone on the fleet at that commit and 3 of 3 at
  its parent. A 1.23 px miss suggests layout read before a reflow settled under load (inferred). Delete the
  entry if the next full runs pass it.

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

- **(P3) [waiting] `effect-chart.spec.ts`'s `maxDiffRatio` of 0.004 was copied from `diagram.spec.ts`.** Its
  baselines were first captured on 2026-10-26 (CI run 40266349908); once a few CI runs have compared
  against them, set the ratio from the diffs they report.

- **(P3) [waiting] A dev server on orochi has missed a file write.** A site dev server there served a file
  as it was before an edit on 2026-10-12, and a `touch` did not wake it. Seen once and not
  reproduced. `forge/src/vite/plugin.test.ts` lost file events for its temp directory the same way,
  7 of 26 tests in one run on 2026-10-13, and polls since; whether a checkout loses them too is not
  measured. The test's later timeouts were a different thing and are fixed (2026-10-24): a polling
  watcher takes its baseline of a directory after it reports ready, so a file added in between was
  never reported. That needs a write within moments of startup, under polling, so it does not
  explain an edit to an existing file in a long-running server.

- **(P3) [waiting] `npm pack` died with SIGABRT and no output in the consumer smoke step.** A
  `test:fleet:postbuild` run of d9f7bb7ba's predecessor 570d272b7 on 2026-10-24 failed
  `test:smoke:consumer` at `scripts/smoke-consumer-bundle.mjs:271` with `signal: 'SIGABRT'` and empty
  stdout and stderr; a rerun of the same commit passed every step. Seen once. A second sighting
  says it is not load.

---

## Backends (WebGL future)

- **(P3) [agent] WebGPU backend.** Separate future spec.
- **(P3) [agent] Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win,
  significant API complexity. Defer until measured pain on the single-thread pipeline. The
  main-thread `OffscreenCanvas` that rasterizes pattern tiles in
  `packages/renderer/src/patterns/` is not worker offload.
- **(P3) [agent] Headless server-side rendering in Node.** `renderSceneToPixels`
  (`packages/core/src/canvas/renderSceneToPixels.ts`) accepts a caller-supplied `gl`, which has to
  be WebGL2. `headless-gl` cannot supply one: `gl@8.1.6` (read 2026-10-17) implements WebGL 1.0.3
  only, vertex arrays through `OES_vertex_array_object`, and Node has no `OffscreenCanvas`. Left:
  find a Node binding that provides WebGL2, or host the render in headless Chromium.
- **(P3) [recheck] Screen adoption of mipmap image minification** — `imageMinification: 'auto'` on
  `WeaselRenderer` builds an image's mipmaps the first time a frame draws it at half size or
  smaller, so only an image that is drawn small pays for them. `<Canvas imageMinification>`
  (and `<SceneCanvas>` through it) opts a canvas in; the default is still `'linear'`. Making
  `'auto'` the screen default changes the pixels of every
  minified image, so it needs the visual baselines regenerated and a look at a sprite sheet drawn
  small: trilinear filtering blends neighboring cells at the higher mip levels, which `'linear'`
  does not. The cost of `generateMipmap` on a large sheet is not measured. Never mipmap
  `GLTextureCache`; it holds MSDF atlases.
- **(P3) [waiting] Gradient ramp resolution at print scale** — 1×256 LINEAR ramps verified adequate for 8-bit
  output (interpolation error < 1/255 per channel); revisit only if >8-bit output lands.

(WebGL1 fallback explicitly rejected — WebGL2 only.)

---

## Devtools

- **(P3) [maintainer] The devtools extension's 16 px icon is the whole site logo shrunk.**
  `apps/devtools-extension/scripts/gen-icons.ts` renders the full mark at every size, and at 16 px
  1x it reads as an orange and dark blob. A crop to the head for the 16 and 32 px sizes would read
  better; that is a call on the mark, not made (2026-10-19).

## Release-gate & build hygiene

- **(P2) [agent] `npm ci` in a fresh worktree fails in forge's postinstall build** (2026-10-28, seen once, in a
  worktree cut from `main`): `TS7016: Could not find a declaration file for module '@weasel-js/labkit/config'`,
  apparently labkit's declarations not built before forge needs them. `node_modules` installed anyway and the
  branch's fleet runs passed, so it fails the install's exit code, not the tree. Not yet checked on a clean clone.

- **(P1) [mike] Publish `@weasel-js/text-shaping` by hand, then retire `@weasel-js/shape` (2026-10-28).** The
  package was renamed after 1.13.0 went out as `@weasel-js/shape`. The release job's `check:first-publish`
  fails until the new name exists on npm with a trusted publisher: publish it once by hand
  (`docs/releasing.md`, "Publishing by hand"), run `node scripts/setup-trusted-publishing.mjs`, and add it to
  `scripts/trust-pending.json`. Then `npm deprecate @weasel-js/shape "renamed to @weasel-js/text-shaping"`.

- **(P3) [agent] The browser project may be capped by sharing one Chromium.** It runs 6 tabs in one headless
  Chromium (`vitest.config.ts`, `maxWorkers: 6`), and more tabs measured no faster on 14- and 18-core
  nodes, plausibly because every tab's WebGL goes through one GPU process (inferred, not measured).
  Splitting the project across 2 or 3 Chromium processes (vitest `--shard` per process) is untested:
  run the browser project alone at 1, 2 and 3 processes, once each first, on msb-uai and teitou, keeping
  every run's raw numbers like `scripts/bench-overlap-reserve.mjs` does (2026-10-21).
- **(P3) [waiting] `npm ci` aborted once with code 134 inside labkit's `prepare` build.** Seen in the first
  `test:fleet:postbuild` run of `34de8c76d` under Node 24 (2026-10-21); labkit's build passed alone
  on the same node and on the rerun. Not looked at.

- **(P2) [maintainer] CI tests Linux Chromium; the fleet does not.** `ci.yml` runs the `browser` project on
  `ubuntu-latest`, while every fleet node is a Mac. CI run 39349499006 (2026-10-20, at
  `f01d3e010`) failed 10 browser tests the fleet passes — `menus.browser.test.tsx` reads
  `CutCtrl+X` where it expects `Cut`, `Badge.browser.test.tsx`, `Bar.overflow.browser.test.tsx`
  and `PropertyList.pairs.browser.test.tsx` measure boxes a fraction of a pixel wider, and
  `retained.browser.test.ts` counts 2 draws where it allows 1. All of these failed again in run
  39761178968 (2026-10-22, at `33efd3167`), beside the theme test above. The same run also failed
  `laidLines.browser.test.ts`, whose glyphs landed 0.50–0.92 px from the layout. The reading is that
  Linux headless Chromium snaps glyph advances to whole pixels (inferred from the numbers, not
  observed), so that file now skips where a probe sees snapped advances. The fix is a Linux node
  (or container) for the `browser` project. (CI's Node 22 leg has a fleet twin since 2026-10-21: `npm run test:fleet:matrix`.)
  Repro lane: `onto do --kind test --node studio -- node scripts/browser-linux.mjs --project=browser <files>`
  (Playwright's Linux image under Docker, arm64 rather than CI's x86), not yet run end to end because
  Docker is not running on studio (2026-10-26).

- **(P3) [maintainer] Decide whether a swapping node should take full fleet runs.** On 2026-10-20 keiei
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

- **(P3) [maintainer] forge serves ui and labkit file by file unless `WEASEL_DEV_BUNDLE_STORIES=1`.** Their
  stories import through package specifiers, so the flag bundles both (`scripts/vite-prebundle.ts`).
  Measured 2026-10-21: a forge load falls from 1,624 requests to 1,270, and at 20 ms of emulated
  latency from 7.1 s to 4.5 s to network idle; a ui component edit goes from a 0.28 s hot update to
  a ~3.6 s re-bundle and reload. Whether to make it the default is the open decision. Under the flag,
  159 of the 1,270 requests are Badge's `shapes/`, `bases/` and `effects/`, which the Badge story and
  its `lab/` import by path because ui does not export them; removing those needs a published
  subpath.

- **(P3) [agent] Find what a long-lived vitest vm worker builds up that crashes V8, and drop
  `--no-sparkplug` if it does nothing.** Fleet runs on teitou died partway from a worker SIGSEGV: a
  jump to address 0 under `PromiseConstructor` while another worker ran a full GC. Under
  `--stress-flush-code` on teitou it crashed 3 of 3 runs at vitest's default memory limit and 0 of 6
  with `vmMemoryLimit: '1gb'` (2026-10-22). It is not a leak: one worker running 319 `weasel-ui`
  files held a flat ~200 MB of live heap and ~1.9 GB RSS. vitest compares the limit with `heapUsed`
  read without a GC (median ~300 MB), so the default (RAM / workers, 3–5 GB) never recycles a
  worker, and 1 GB replaces each about once a run. The crash therefore tracks worker age rather than
  heap size; what accumulates, and why only teitou crashed, is unknown. `--no-sparkplug` went in
  (2026-10-19) for nodejs/node#62393, whose `0xe` signature none of these reports has; two from
  10-15 and 10-17 (fault `0x89` in `MarkingWorklists::~Local`) are the only ones it might have
  answered. Before removing it, run the jsdom projects on teitou without it a few times and check
  `~/Library/Logs/DiagnosticReports/node-*.ips` there for new reports.

- **(P3) [agent] The overlap's jsdom worker count subtracts busy cores the reserve sweep never did.**
  `roomToOverlap` (`scripts/lib/node-load.mjs`) gives jsdom `floor(cores - busy) - reserve` workers, but
  the 2026-10-21 sweep that chose the reserve ran `cores - reserve` regardless of load
  (`scripts/bench-overlap-reserve.mjs`). On studio, busy read 1.5–6.3 cores in that sweep, where the
  shipped rule would have given 2–5 workers or no overlap at all. At 58f8810f9 (2026-10-26, studio, 2.1
  busy) it gave 4: the browser projects finished in 338 s and the jsdom ones in 479 s, while the sweep's
  R 3–4 runs at 6–7 workers took 347–357 s for the whole suite (other commits; inferred, not compared
  head to head). Head to head on studio at 58f8810f9 (2026-10-26, one pass each, both in
  `scripts/bench-overlap-reserve.runs.jsonl`): the shipped rule's 4 workers took 495 s launcher to
  finish with 10 timed-out tests retried; `cores - 3`'s 7 workers took 562 s with none, its browser side
  slowed from 338 s to 482 s. So the cut is not costing time there; whether 5–6 workers would keep the
  retries away without slowing the browser side is the next pass.

- **(P3) [agent] The `browser` project spends about a second per file outside its tests.** Alone on teitou
  (2026-10-20) it took 89 s on six workers, 534 worker-seconds, of which its 227 files' tests were
  310 s; the rest is each file's page and module load, and from 35 s on the run is a stream of small
  files paying it. Splitting the longest files would not help: the tail is the small ones.
  `--no-isolate`, which would reuse one page, failed every file at about 5 s with its tests skipped.
  Serving the workspace packages pre-bundled, as `scripts/vite-prebundle.ts` does for the dev
  servers, is the likely fix (inferred, not tried). The prebundle already keeps out of a bundle
  whatever source imports by relative path, so no module would load twice, but tests import their
  own package that way, so most of each package would stay unbundled. forge got its gain by moving
  its stories onto package specifiers first (2026-10-21); the tests would need the same.

- **(P3) [agent] labkit's Lab-mounting tests stall for 20 s on the fleet now and then.** `Lab.messages.test.tsx`'s
  "reports its state as it starts, on a change, and when asked" timed out on studio (0.4 of 10 cores busy) in the
  batch-5 gate at 9d51e9d04, where it takes 62 ms locally, and `TrialTransport.test.tsx`'s "shares the chosen speed
  between two transports over one clock" timed out once on main at 9666c02d4 and passed on retry (both 2026-10-27).
  What they wait on is unknown. Both files, and `still.browser.test.tsx`, now take their awaited steps through
  labkit's `live` fixture (`packages/labkit/src/testing/liveTest.ts`), so a timed-out attempt stops at its next step
  instead of acting on the next test, and the run's timeout warning prints the stack of each step it was still
  awaiting (2026-10-27). Read that stack at the next sighting.

- **(P2) [agent] What is left of the `browser` project's fleet failures.** The project runs after the
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

- **(P2) [agent] Browser test files fail to load in bursts: "Failed to fetch dynamically imported module".**
  On 2026-10-25, four fleet runs of branches that touched none of them failed whole files this way,
  and the next run passed. Each failure is the file's own import, `Failed to import test file …
  Caused by: TypeError: Failed to fetch dynamically imported module: http://localhost:<port>/…?import&browserv=<ms>`,
  where `browserv` is the `Date.now()` the tester stamped on the import, so each run's failures can
  be dated to the millisecond:

  | Log (scratchpad, `fleet-fix-*`) | Node, mode | Files | Project | Window | Into the run |
  |---|---|---:|---|---|---:|
  | `n858-squeezed-dock-row` | msb-uai, browser beside | 10 | forge-stories | 01:54:24–01:54:26 | 99 s |
  | `p932-clean` | studio, browser after | 5 | forge-stories | 01:54:21–01:54:24 | 189 s |
  | `ui-shared-register` | msb-uai, browser beside | 5 | forge-stories | 02:26:00–02:26:09 | 94 s |
  | `s825-bar-menubar-defaults-2` | studio, browser after | 1 | browser (`hud/src/glyph.browser.test.ts`) | 02:33:54 | 403 s |

  Ruled out, from the logs and the nodes (verified):
  - **The optimizer.** Both browser projects log at `info`, and none of these logs has a
    "Re-optimizing", "new dependencies optimized" or "reloading" line. On msb-uai the
    `forge-stories` and `browser` dep caches (`node_modules/.vite/vitest/<sha1 of the project
    name>/deps`) were born at 01:02:48–49 and not rewritten since, which spans both msb-uai failures
    (stat on the node, 02:58). So neither the run nor the gate's `vitest list` (check:test-projects,
    which starts a vite server for every project on the same cache dirs) re-bundled under them.
  - **A fleet-tree sync.** Every log ends `fleet-tree: the tree held … for the whole run`.
  - **A broken import elsewhere.** None of these logs has an `Internal server error`, a
    `Failed to resolve import` or a pre-transform error; `x637-curved-label-red`'s single such
    failure was its own missing `./CurvedLabel`, a real red.
  - **Another job on the node.** `onto jobs --internal` shows no other job on msb-uai or studio
    at any of the four moments (studio's long-lived `brick-spot-render` service aside).

  Every failed or 400-and-up module load in either browser project now prints a `weasel-request <epoch
  ms> <ISO> <status|error> <type> <url>` line to stdout, on the same epoch ms as `browserv`
  (`watchRequests`, `scripts/vitest-browser-commands.ts`, 2026-10-26), so the next burst's log says
  what the server answered. The burst shape, many files in under 10 s and then clean, points at a
  transient server- or browser-side event rather than any one file (inferred).
  The first two bursts came 3 s apart on two different nodes (01:54:21 on studio, 01:54:24 on
  msb-uai), each serving its own localhost, so what they shared at that moment is the first thing
  to look for: a sync from this machine into another tree, a network event, or the onto daemons. The
  logs lived in a session scratchpad and are not kept.

- **(P2) [agent] HUD vs DOM text: the HUD's every-frame text keeps a garbage collector busy.** With the readout
  changing every frame the HUD allocates 978 KB a frame at 5,000 glyphs on a fixed camera against the DOM's 102
  (msb-uai, 2026-10-27, down from 1,942; `tests/perf/hud-vs-dom.spec.ts`, README "What the HUD allocates"). A
  recycled layout now hands its line boxes, paintings and groups to the next one, and the 180 KB once charged to
  `dropRuns` was `Array.prototype.fill` in `LayoutColumns.recycle`. What is left, self KB a frame: `cachedCommands`
  in the HUD (135); `layoutRuns` (111) and `breakLines` (77), whose avoidable allocation is now fixed (2026-10-27):
  their lists, and `graphemeEnds`', were emptied with `length = 0`, which drops the backing store, and regrown by
  `push` every call, and `measureRuns` walked runs with a `forEach` closure. In Node a 48-character readout's
  `measureRuns` and `breakLines` now allocate nothing of their own, from about 2.4 KB and 1.3 KB a call; the browser re-measure
  (`tests/perf/hud-vs-dom.spec.ts`) has not been run. `lineBreakOpportunities` still builds its result array and
  three closures a wrapped call (about 0.6 KB at 48 characters); `resolveRuns` (69) and `resolveTextStyle` (56)
  building the command; `paintRunsInto` (49) and `groupFor` (37); `resolveFontVariantInternal`'s result object
  (36; caching it per font entry would change result identity); `graphemeEnds` (39), which still allocates per
  cluster on its `Intl.Segmenter` path, taken by text with anything from U+0300 up. A run with Chromium's inlining
  off (`--js-flags=--no-turbo-inlining --no-maglev-inlining`) shows where a function's allocation really sits.
  Main-thread time fell, with ranges apart in two of four cells, from one run each. A still HUD drawn through
  `drawLayers` costs the main thread what the DOM does (README, "A still HUD through `drawLayers`").

- **(P3) [maintainer] Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one
  is desired. The barrel test (`packages/core/src/index.barrel.test.ts`) asserts parity for op
  factories, shape kinds, and the `features` presets; the rest of the public exports are uncovered.

- **(P2) [agent] What still breaks the batch, now that a rect clip does not.** `batchClip.ts` cuts staged
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
  - **A convex clip stays in the run only on a single-sampled target** (`batchHull.ts`, 2026-10-27): a
    turned rect or a convex polygon of up to 8 edges is tested per fragment against half-planes snapped to
    1/16 px, and the stencil, when needed, is drawn from the same corners. `hullClip.browser.test.ts`
    (SwiftShader) and `clip-cost.spec.ts` (teitou, ANGLE Metal, 0 differing pixels) pin the agreement. 512
    slanted clips on a single-sampled canvas: 32 draws and 0.46 ms a frame, against 1536 draws and 14.93 ms on
    the stencil (`tests/perf/recorded/hull-clip-2026-10-27/`). A rect clip there is snapped to the same grid
    and carries itself as a hull, so a slanted item across it stays in the run too: 512 such clips, 32 draws
    and 0.78 ms against 1536 draws and 6.01 ms on the stencil, 0 differing pixels
    (`tests/perf/recorded/rect-clip-hull-2026-10-27/`). What still flushes: every such clip on a
    multisampled target, which is the browser default (WebGL2 has no `gl_SampleMask`, and scaling alpha by
    sample coverage leaves the color beneath showing at the clip edge where layers stack, inferred from the
    blend math); a non-convex or curved clip; nesting past 8 planes, rect clips included (three nested
    rect clips are 12); and a clip inside a retained or effect target.
  - **Caching `u_synthBold` (a uniform then), `u_samplers`, and `u_fieldScale` was tried and
    reverted**, measured through `finish`: it saved about 0.1 us a flush on color-matrix breaks and
    made a frame of 20,000 stroked rects 30% slower, with both renderers interleaved in one page.
    The cause was not found. The run's color matrices are cached the same way now
    (`uploadBatchMatrices`), where `setColorMatrixUniforms` cached the one before.
  - **Changing kind costs 1.35–4.9 us a boundary** (`transition-matrix.spec.ts`): text and gradient
    the least, shader (4.9) and vcolor (4.4) the most. Pairs whose kinds share a batch cost nothing
    extra; the rest add 8–16 us, with a run-to-run spread up to 9.7 us, so the spec ranks pairs but
    does not price one.

- **(P3) [waiting] `SOLID_RING_SIZE` is measured only on Metal.** The ring (64 slots) exists so a flush never
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

- **(P3) [waiting] The mesh batching caps are measured on one GPU.** A mesh joins a run up to
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

- **(P3) [waiting] A consumer's `sampling: 'nearest'` costing up to 8x does not reproduce here.** They drew a
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

- **(P3) [waiting] Whether the batched path costs a co-tenant on the same page.** Reported, not measured
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

- **(P3) [agent] Retained layer surfaces: what is left.** An unchanged layer of 250 commands or more is drawn once into
  its own texture and composited (`GroupDrawCommand.retain`, `packages/renderer/src/retain/`; the policy is
  `packages/core/src/core/layers/retain.ts`; `<Canvas retain>` sets the threshold and budget). A world layer is
  retained through a pan by compositing its surface moved whole device pixels, drawn again with a margin of an
  eighth of the buffer each side (`PAN_MARGIN`); since 7b048f4bf that includes layers holding effects that set
  `reach`, isolated groups and composite groups. Left:

  - **A redraw past one tile is slower, by a cause not found.** A retained surface is drawn in
    1024-device-pixel tiles (`RETAIN_TILE`), so the multisampled scratch buffer is at most 38 MB at 4x.
    Redrawing 4 layers with pan margins at 2560x1600 takes about 9.7 or about 15.5 ms depending on the job,
    against 9 ms untiled, and in the slow jobs the renderer's CPU time rises to match. Culling and the resolve
    copy are ruled out (`tests/perf/recorded/retain-tiles-2026-10-27/conditions.txt`). The default budget is
    384 MiB (2026-10-27). Above about 15 canvas-sized layers with margins it still fills, and a margin goes to
    whichever layer asks first rather than evicting a surface that cannot follow the pan.
  - **Screen-unit paints opt a layer out of pan retaining, correctly** (2026-10-27): such a paint stays put on
    the canvas while the geometry pans through it, so a moved surface would carry stale colors. The only exact
    exception is a pan along which the paint is constant (a linear gradient panned along its stripes, a pattern
    by whole tiles). Authored paints in the repo are mostly `bounds`/`local`/`world`, which do follow a pan.
  - **Still opted out of pan retaining:** custom shaders, texture paints on text (the paint scratch is clamped
    to the drawing buffer), and effects with no `reach`.
  - **An effects layer uses the same 250-command threshold** as any other, though its passes cost far more than
    its commands. Measure before changing it.
  - **The threshold** was left at 250 after measurement (`tests/perf/layer-dispatch.spec.ts`; result files in
    `tests/perf/recorded/layer-dispatch-scratch-unbudgeted-msb-uai-m3max-2026-10-18/`).
- **(P3) [agent] Snap the view's translation to whole device pixels while it moves.** A pan by fractions of a
  device pixel (kit inertia, most trackpad momentum) never reuses a retained surface: the layer is drawn straight
  through and its surface redrawn once the view holds. Resampling was ruled out (2026-10-27: a 1-device-px
  hairline at a half-pixel offset becomes two half-strength pixels and pops sharp at rest). Ruled (2026-10-28):
  while the view is moving, core draws with its translation rounded to whole device pixels, and draws the exact
  translation once it holds; hit-testing reads the exact view throughout, so drawn and hit positions differ by up
  to half a device pixel only in motion. Not snapping stays available as an option a consumer sets, for one that
  needs drawn and hit positions to agree exactly while moving (2026-10-28).

- **(P3) [agent] The pull request benchmark job's new run time is unmeasured.** Since 2026-10-26 it runs
  `hud-vs-dom` with the HUD alone (`HVD_APPROACHES=hud`), estimated at about 80 minutes against a
  120-minute limit. Also unmeasured: whether the base, measured first, reads differently from the head
  for that reason alone.

## weaselchart

`apps/chart`, a Visio-style diagram editor with a pipeline mode, built on `@weasel-js/diagram`.

- **(P3) [maintainer] Check `@weasel-js/rig`'s and `@weasel-js/diagram-formats`' trusted-publisher
  registration.** Both are on the registry at 1.11.1 under `latest` and `pre` (`npm view`,
  2026-10-21); whether each is registered as a trusted publisher (`docs/releasing.md`, "Setting up a
  new package") can only be read on npmjs.com.
