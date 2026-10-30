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
- **(P3) [recheck] Are the snap readout's drawing helpers public API?** Decision for the maintainer
  (2026-10-18). `tickedSegment`, `pillCommands` and `measuredSegmentCommands` are on
  `@weasel-js/core`'s barrel because guides' layer draws with them. Either they stay as designed
  public surface, or they move to an `internal` entry (as `@weasel-js/routing/internal` does),
  which `audit:jsdoc` treats as a sibling-package surface.
- **(P3) [recheck] WeaselDraw binds no constraint action.** It needs keys or a bar group for
  `constrainAnchors` and `unconstrainAnchors`, and icons for them.

## Rendering & paint

- **(P3) [agent] `retained.tiles.browser.test.ts` saw tiled and whole differ by one level.** "matches
  the surface drawn whole inside the buffer" asserts `max: 0` and got `{ max: 1, off: 24 }` on teitou
  (GPU at 43% when the run started) at de0954bd5, a branch that touches no renderer code
  (2026-10-29). It passed in every other run found. Whether a tile seam can round differently, or
  `max: 0` is stricter than the GPU guarantees, is not known; read the failure screenshot at the
  next sighting.

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

- **(P3) [maintainer] WebKit at DPR 1 sets the overlay's glyphs on a third-pixel grid, rounding down,
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

- **(P3) [agent] At 16px and below at DPR 1, the atlas tier's ink wobbles as a glyph moves across a
  pixel, so the overlay's sits up to ~0.6px off it.** Measured 2026-10-29: as `x` steps from 20 to
  20.875 in eighths, the canvas centroid of a 7.2px `H` (what a 12px super- or subscript draws, and
  the same with no script) runs 23.14, 23.25, 23.12, 22.87, 22.77, 22.89, 23.34, 23.71, moving left
  for half the pixel, while every engine's overlay moves steadily right. So `dx` swings between
  about -0.5 and +0.5 with the phase (max 0.51 Chromium, 0.60 Firefox, 0.57 WebKit); Inter 16px
  swings by about 0.4. The shader reads coverage from the field at each pixel's center, so a stem
  narrower than a pixel is inked by where it sits: at `x` 20 the canvas gives the `H`'s left stem,
  straddling two columns, 2.84 pixels of ink and its right stem, centered on one, 4.35, where the
  overlay gives them 3.92 and 3.54. At DPR 2, where the stems are wider than a pixel, `dx` stays
  within 0.19 in every engine. The fix is area coverage, several field taps per fragment where a
  pixel spans more of the field than a stem is wide, in `GLYPH_COVERAGE_GLSL`, priced with
  `tests/perf/fill-rate.spec.ts`. The `dy` of up to ±0.45 in the same rows is the overlay's
  whole-pixel rounding, the entry "The edit overlay's text lands on whole CSS pixels".

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
  ends (`editEnd`), the arrow-key step sizes (`arrowSteps`, `rangeKey`), a slider's value and key math (`sliderKey`),
  and keyboard focus as one contract, `FocusScope<T>`, with `tabSort`/`tabStep`.
  `@weasel-js/menu` runs each menu level on the list half, ui's `useRowNavigation` and `useRovingTabIndex` step and
  type ahead through it (`useRowNavigation` takes every key but the nudge from `rowKey`), `Hud` is a `FocusScope<Widget>`, and ui's `domFocusScope(root)` is the same contract over DOM
  elements. Held steppers repeat through `createStepRepeat`, in ui's `UnitField` and on the hud menu's number chips.
  Left, in order: a measure/draw contract a DOM component and a hud widget both implement; then porting a
  button and a list onto it. A page that has both DOM controls and a hud canvas still joins the two at `attach.ts`'s
  `wireFocus`, not through `FocusScope`.

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

- **(P3) [maintainer] Whether forge's vite plugin should wait for writes to settle, as the repo's own dev servers do.**
  On Linux, chokidar drops a `change` within 50 ms of the last one it reported, so a second quick save can leave a
  server serving the first text until the next save. Every dev server here (and vitest's watcher) now waits for the
  write to settle through `devWatch` in `scripts/vite-watch.ts`, which ends it (2026-10-30). A consumer's server
  that adds only `forge()` does not, and `replacedFile.test.ts`, which runs such a server, still rewrites until
  served. Measured with `node scripts/watch-settle.mjs` (`--linux` on studio for Docker), 2026-10-30: Linux
  stale 16/16 without, 0/16 with, and save-to-served median 16 → 62 ms; macOS stale 0/48 either way, since
  fsevents reports a path's next change about 100 ms after its last, and median 113 → 115 ms (p90 118 → 148).

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

- **(P3) [maintainer] Whether the workshop's marks come back, to draw on a reported issue's screenshot**
  (2026-10-25). The Issues panel lists a component's `forge:<component>` issues through the dev server's `gh` and
  opens GitHub's new-issue page for a report, where the reporter pastes a screenshot (2026-10-28). The workshop
  turns labkit's marks off (`marks={false}` in `packages/forge/src/shell/Workshop.tsx`), so nothing in it can mark
  up the trial before that screenshot is taken. Not decided: whether marks come back for that; deferred (2026-10-28).

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
  2.2.0). `Split` works around it by showing its sidebar node and hiding it
  again (`createSplitStore`, `packages/labkit/src/primitives/Split.tsx`).
  Fixed on windease's `mounted-not-laid-out` branch (2026-10-29), unmerged and
  unreleased: layout now places only `visible` children. Once a release carries
  it, raise labkit's `windease` range to it, leave the sidebar unshown when
  `hasSidebar` is false, and retire this entry.

- **(P3) [waiting] What holds `fseventsd` when macOS file events stop arriving is not known.** Measured
  2026-10-13 with `fseventsd` at 98% CPU and 2.6 GB: a write in a temp directory reached neither
  `fs.watch` on that directory nor the `fsevents` module in 12 seconds, while a watch on the file
  itself fired at once, and a dev server served none of three edits. Every dev server in the repo
  now warns when it starts in this state (`watchProbe`, `packages/forge/src/vite/watchProbe.ts`),
  and the one test that needs a real watcher skips. The cause needs the machine in that state.

---

- **(P3) [maintainer] Icons for the package pages.** Said to be specced (gray and blue React icons, an orange
  window, and three others), but no spec has been found in the repo or in either account's weasel transcripts.
  Ask where it lives before drawing anything (2026-10-21).

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

- **(P2) [waiting] `labelDrag.browser.test.tsx` fails now and then on the fleet** (2026-10-28). "drags a connector
  label, keeps it on a reroute, and resets it" times out on its first `expect.poll(() => savedLabel()?.dodge)`:
  the first drag saves no placement. The onto archive has it failing in 5 of about 45 fleet runs from 2026-10-28
  20:42 to 2026-10-29 17:00, on keiei, studio, teitou and msb-uai, on branches that touch nothing in chart and on
  `main` (15e83dc60); none of the roughly 470 archived runs from 2026-10-21 to 2026-10-28 morning failed it. (The
  `chart-toolbar` branch failed it on 2026-10-28 too, from a page fit that 99ceb63dc fixed.) Both failure
  screenshots still on the nodes show the chart exactly as mounted with the canvas focused, so the press arrived and
  the drag left nothing. The two failing logs still on disk started on nodes with 2.2 and 2.4 cores free.
  Ruled out on 2026-10-29, each measured on the fleet: the host resizing after mount (it never did, and a drag with
  no wait after the canvas appears passes), slow frames (CPU throttled 16x, or five GPU-loading tabs stretching the
  drag to 5 s), the drag starting anywhere from 0 to 1.5 s after mount, a window blur from tabs taking focus, the
  real mouse parked over the canvas or held down elsewhere, local storage shared between files running at once (it
  is not), and two browser projects on one node at once. 17 instrumented runs (5 full, 6 of the browser project,
  6 paired on one node) and about 250 probe drags all passed. The test now names, when it fails, the cursor its
  press point hovered with ("move" means the label was hit), whether the canvas view matched the fit `at()`
  assumes, and any blur, pointer cancel or real-mouse event during the drag. Waiting on the next sighting to read
  that line (2026-10-29). Sighted on teitou on 2026-10-30 in the `hud-alloc` branch's run at `9b0c6ee91`, which
  touches only text layout: `press at 553.1,365.0 hovered with cursor "default"; connector where at() expects:
  false; during the drag: nothing else`. The press missed the label, and the view was not the fit `at()` assumes.

- **(P3) [waiting] `npm ci` aborted once with code 134 inside labkit's `prepare` build.** Seen in the first
  `test:fleet:postbuild` run of `34de8c76d` under Node 24 (2026-10-21); labkit's build passed alone
  on the same node and on the rerun. Not looked at.

- **(P3) [waiting] `Bar.along.browser.test.tsx`'s wheel-and-drag test failed once in Linux CI.** "the wheel and a drag
  along the band scroll; a still press on an action fires it" missed by 13° (`expected 13.05 to be less than or equal
  to 1`, line 247) in CI run 40818081756 on 76adffe24 (2026-10-29), and passed when that job was rerun. The fleet,
  which runs no Linux, has never seen it fail. Waiting on a second sighting.

- **(P3) [maintainer] CI tests Linux Chromium; the fleet does not.** `ci.yml` runs the `browser` project on
  `ubuntu-latest`, while every fleet node is a Mac, so a browser test that leans on the OS fails only in CI.
  The 11 that failed every `main` run from 2026-10-15 were fixed on 2026-10-29, passing in the lane below:
  they read Mac shortcut glyphs or the Apple word-delete key, measured text in the OS's fallback font
  instead of the kit's Oswald, or held WebGL rounding to 1 where CI's SwiftShader reaches 2. Open: whether
  the fleet should run that lane routinely, so the next one is caught before CI.
  Repro lane: `onto do --kind test --node studio -- node scripts/browser-linux.mjs --project=browser <files>`
  (Playwright's Linux image under Docker, arm64 rather than CI's x86; it reproduced CI's numbers exactly).
  Studio's Docker Desktop has to be running (`open -g -a Docker` there).

- **(P3) [maintainer] Whether to find what a long-lived vitest vm worker builds up that crashed V8.**
  Fleet runs on teitou died from a worker SIGSEGV (a jump to address 0 under `PromiseConstructor`
  while another worker ran a full GC) until `vmMemoryLimit: '1gb'` (2026-10-22) made vitest replace
  each vm worker about once a run; the default limit never does, because it compares against
  `heapUsed` read without a GC. Nothing leaks: one worker over 319 `weasel-ui` files held a flat
  ~200 MB of live heap. teitou has written no SIGSEGV report since, over 183 suite runs, and with
  `--no-sparkplug` dropped the jsdom projects ran 3 of 3 clean under `--stress-flush-code`, which
  crashed 3 of 3 at the default limit (2026-10-29). So the crash is held off, not explained: what an
  aged worker accumulates, and why only teitou crashed, are unknown. The cost of not knowing is that
  raising or removing the limit would bring it back. Whether that is worth a heap-snapshot hunt is
  the open call.

- **(P2) [maintainer] A trial's status strip grows 2 px when its numeric face arrives**, which refits
  the view a second time. The strip itself takes its room on the first layout (`TrialChrome` reads an
  unplaced view as the default), so this is the only refit left; `presentation.browser.test.tsx`
  loads the face first to test the structural half, and its "entering refits" test still waits for
  the settled box. The readouts' boxes depend on the face because `ScaleIndicator` is inline-flex
  inside a line box; made face-independent the strip would settle near 27 px (estimated) rather than
  30. Which height the strip should have is the decision.

- **(P2) [maintainer] Browser test files fail to load when the node's network changes.** A file
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

- **(P3) [maintainer] Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one
  is desired. The barrel test (`packages/core/src/index.barrel.test.ts`) asserts parity for op
  factories, shape kinds, and the `features` presets; the rest of the public exports are uncovered.

---

## weaselchart

`apps/chart`, a Visio-style diagram editor with a pipeline mode, built on `@weasel-js/diagram`.

- **(P3) [maintainer] Check `@weasel-js/rig`'s and `@weasel-js/diagram-formats`' trusted-publisher
  registration.** Both are on the registry at 1.11.1 under `latest` and `pre` (`npm view`,
  2026-10-21); whether each is registered as a trusted publisher (`docs/releasing.md`, "Setting up a
  new package") can only be read on npmjs.com.
