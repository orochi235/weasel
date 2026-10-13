# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@weasel-js/core`). The
kit aims to be a generic 2D scene-graph foundation. Items here are evaluated
for cross-app reuse, not consumer-app value.

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

- **(P3) Two tools engaging on the same held key may share one dispatcher slot.** Read from the
  code and never run: a key-held engagement is stored under `key-held-<key>`, so a second tool on
  that key would overwrite the first's owner, and releasing the key would restore only one channel.
  The only record of this was a comment on a skipped test that asserted nothing, deleted in the
  2026-10-12 test audit. Write the test first; it either fails or retires this entry.

- **(P2) `features` names two things.** The `<SceneCanvas features>` prop composes behavior presets
  (`canvas/SceneCanvas/features.ts`); `packages/core/src/features/<name>/` is a source directory
  bundling one domain's primitives, and `docs/taxonomy.md` calls each of those a "feature" too.
  Ruled 2026-10-11: the directory and the taxonomy's term take a new word, and the prop keeps
  `features`; the new word is not chosen yet. That leaves choosing it, then renaming the one path,
  its imports, and the section of the taxonomy.

- **(P3) Nothing reads a mode's `entry.trigger`.** Draw enters path-edit, isolation, and text-edit
  from `SceneCanvas`'s `onDoubleClick` observer through a kind-to-mode table of its own
  (`apps/draw/src/modality/doubleClickEntry.ts`), not from the `'double-click-target'` the
  definitions in `packages/modes/src/presets/default.ts` declare. Binding it means a double-click
  entry beside the kit's own `enterPathEdit` binding, so it is the same work as "draw: two owners
  for "is a text edit open"".

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

- **(P3) One dep still names a plane, not ten.** Read for what a camera-bearing host can
  implement, only `geometryProjection` obstructs (its own entry below). `view` is per-kernel by
  design, and `kernel3d` declares `camera3d`. `editAnchors` and `booleansAdapter` are 2D features a
  3D kernel does not declare. `snap`, `lassoSelect`, `poseDescriptor`, `slice`, and `ingestion` are
  satisfiable as typed, because every coordinate in them is a screen point under the identity
  `clientToWorld` a 3D host passes. `pointer` has not been re-measured since it became the pointer
  store (`PointerContextValue`).

- **(P3) `geometryProjection` cannot hold a 3D transform.** `transform(node, m: Mat3)` names a
  plane in its signature, so a kernel with a camera has nothing to implement it with. Core builds
  the `Mat3` at four call sites (move, nudge, flip, and resize commit) before the dep is consulted,
  so widening the type alone does not free it.

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

- **(P3) `createDispatcher` is still one closure.**
  `packages/routing/src/interactions/dispatcher/dispatcher.ts` (about 900 lines) holds per-kind
  context building, the walk, and UI-driven handles, which share its in-flight maps. The hook
  beside it is down to listener wiring; pointer recognition is `packages/gestures/src/recognizer/`.

- **(P3) What the pointer recognizer's extraction left.**
  - Three `pointermove` hover channels listen on one canvas element and each tracks "is a button
    down" its own way: the dispatcher's hover pump (`channels/hoverCursor.ts`), `useSurfaceInput`
    in core's canvas, and `PointerPublisher` in `PointerProviderIfRoot.tsx`.
  - The hover pump and `Canvas.tsx` each turn a resolved cursor into a `style.cursor` write plus a
    painted-cursor write. One cursor sink beside `PaintedCursorState` would serve both.
  - A long-press timer fires on whichever view was routed last, not the view the press went down
    in (`channels/pointer.ts`).
  - `InvocationCtx.multiTouch.rotation` is hard-coded to 0 and read nowhere; making it real needs
    an angle on `MultiTouchEvent`.
  - `useGestureDispatcher.listeners.test.tsx`: "does NOT cancel on initial mount" cannot fail,
    since nothing is ever in flight in it.

- **(P3) What the text layout split left.**
  - `packages/text/src/layout/paintRuns.ts`: a zero-advance atlas glyph gets no quad, against the
    `LaidOutCell.drawsInk` doc ("a combining mark inks without advancing").
  - `paintRuns.ts`, `glyphOutlineD`: a code point no tier could serve still gets outline geometry
    above the outline threshold when the outline face has it, drawn on top of its neighbor.
  - No renderer-level test drives `fill: {}` through an SDF-tier draw; the no-ink rule is pinned
    at the text layer only.
  - `tests/perf/bench/text-layout.bench.ts` times layout alone now, so `BASELINE.md`'s numbers,
    which included grouping, need re-recording.

- **(P3) Two browser tests share the machine's clipboard and fail when they overlap.**
  `packages/text-dom/src/overlayTyping.browser.test.tsx` ("reads a page's markup as runs") and
  `packages/core/src/interactions/actions/clipboard/clipboardOps.browser.test.tsx` ("leaves the
  previous clipboard whole when every flavor rejects") each write the real OS clipboard and read
  it back. In a fleet run on 2026-10-12 each read the other's text (`'before'` and `'PQ'`); both
  pass alone. Two fleet runs on one node would collide the same way. They need to run serially,
  or one of them needs a clipboard of its own.

- **(P3) What removing the old tool design left.** `ToolCtx`, the cursor function's argument,
  `Tool.previewPose` / `previewBounds` / `previewIds`, and tool-side preview sources are gone.
  Still to go:
  - `ToolBounds` (`routing/src/tools/types.ts`) existed only for `previewBounds`.
  - A `<CanvasView>` converts client points with the bare rect helper (`clientToWorldHere` in
    `CanvasView.tsx`), and so does `worldPointAt` for a point that resolves to a declared view. A
    canvas's `clientToWorld` override reaches neither: it maps into the canvas's own world, and
    these need a client-to-canvas-local conversion it does not provide.
  - `Canvas`'s `adapter` prop is typed as the Move, Resize, and Rotate adapters together, though
    Canvas reads only poses, nodes, layers, and children.

- **(P3) What moving the Badge lab out of its stories file left.** The lab is
  `packages/ui/src/components/Badge/lab/` now.
  - It hand-rolls around kit components: `InlineRange` fits its range inputs, and
    `useReorderDragList` with `DragGrip` fits the effect-card reorder, which uses HTML5 drag and a
    text grip. Each swap changes how the lab looks or drags.
  - Its colors are literals (`rgba(255,255,255,…)`, `#7fb069`) in the stylesheets, not `--wzl-*`
    tokens.
  - At weight 0 the spline editor's curve and the drawn badge disagree: the editor's
    `readAnchors` allows weight 0 where the base's `extractAnchorPairs` floors it at 0.01.
  - In the workshop at a 1500px window, the Compose lab's "Type & padding" column and effects
    panel run past the right edge of the stage. Not compared against the lab before its text
    moved onto the type scale.
  - The simple stories (`StatusVariantMatrix`, `Sizes`, `EdgeCases`) still use inline styles.

- **(P3) `DrawCanvas.tsx` and `SceneViewCanvas.tsx` each carry the same first-paint block**
  (`paintedRef` plus a layout effect). It belongs in `useCanvasSurface`.

- **(P3) Rotate has no angle snap.** Nothing under
  `packages/core/src/interactions/actions/rotate/` quantizes the angle, with Shift or otherwise, and
  core ships no rotate behavior that does.

### Cursor package follow-ups

- **(P3) Cursor rasterization is unmeasured in Safari.** Chrome and headed Firefox are measured
  (`docs/superpowers/specs/2026-09-03-cursor-system-design.md`, "Measured browser behavior"); the
  baker's plain SVG `url()` is right for both. `node probe.mjs <dir> --browser safari` in
  `packages/cursor/scripts/probe/` is the instrument, and its readings cannot be trusted yet: its
  first run drew the arrow control and then the crosshair for every case after it, and every later
  run drew the crosshair even for the arrow — with the page frontmost, over HTTP (`--page http`) as
  well as `data:`, stepping by reload as well as by hash. Safari's cursor is not following the page
  under this driver, and why is the open question. A finding lands in `bake.ts`.

---

## Viewport

- **(P3) A controlled consumer's own `setState` cannot interrupt a glide.** Every view write that
  goes through the canvas cancels the camera runner. A consumer who owns `view` in state and writes
  it directly does not go through the canvas: the prop change arrives asynchronously, after the
  runner has lowered the flag that distinguishes its own frames, so it is indistinguishable from
  one. Comparing the incoming prop against the last value written would work only for consumers who
  store the view by reference — one who normalizes or clamps it would have every frame of their own
  glide canceled. Wants a real design.

- **(P3) Views do not nest.** A view paints and routes the surface's own stack, never another view,
  and a loupe magnifies the canvas's camera — aimed over a `<CanvasView>` panel it shows and edits
  the canvas's world, not the panel's. Composing would mean a view's camera derived from the view
  under its aim, and a resolver that descends rather than picking one rect.

- **(P3) Canvas hosts: the renderer writes inline `width` and `height` style on a `<canvas>` it
  owns.** `WeaselRenderer`'s constructor and `resize` set `canvas.style.width`/`height`, so a
  `<SceneViewCanvas className>` or `<DrawCanvas className>` that sizes the element (`width: 100%`)
  loses to the inline style after the first paint. Ruled 2026-10-11: the renderer sets only the
  canvas's backing-store size, and every host sizes its element by class. That leaves dropping both
  style writes, checking every host for a layout that depends on them, and taking the caveat back
  out of the `SceneViewCanvas` and `DrawCanvas` docstrings.

---

## Paths & booleans

- **(P3) a pose's `transform` is drawn, picked, and edited as a path, and the selection chrome and
  the resize and rotate handles do not read it.** A box pose may carry a `transform` (`PoseLinear`,
  `packages/geom/src/poseFrame.ts`): the skew or per-axis scale its box and rotation cannot hold.
  Ruled 2026-10-11: text and image nodes carry a full transform, and such text stays editable
  text. These readers see only the box and its rotation, so for such a node each acts on the
  unstretched, unskewed box:
  - The selection outline and handles (`features/selection/overlay.ts`,
    `affordances/hitAffordanceRegions.ts`, `wiredBoundsOfPose` in
    `canvas/SceneCanvas/useSceneSelectTool.ts`) sit on the unstretched box, and the resize and
    rotate actions (`interactions/actions/resize/frame.ts`, `rotate/geometry.ts`,
    `rotate/handle.ts`) take their drags in that box's frame. A resize changes the box and keeps
    the transform, so the result is drawn stretched; these have to change together.
  - `remapRotatedLeaf` (`core/geometry/poseDescriptor.ts`) drops the shear a non-uniform group
    resize gives a turned leaf rather than writing it to the leaf's `transform`.
  - `useNodeOverlayFrame` (`core/viewport/`), which places DOM chrome over a node, the text
    edit overlay and its carets included, applies the rotation alone. Needs a browser to verify.
  - `composeRectPose` / `composeRigidPose` (`core/scene/composePose.ts`) keep a child's own
    transform and do not compose a container's into its children.
  - The debug overlay (`debug/createDebugOverlayLayer.ts`) outlines the rotated box.
  - `defaultNodeProperties` has no row for it, so `SelectionPanel` can neither show nor clear it.

- **(P3) Under `openFill: 'none'`, SVG import and export and the booleans still close an open
  subpath.** A path says whether a fill closes its open subpaths (`PolygonPath.openFill`, or
  `setDefaultOpenFill` for a path that names none). SVG always closes one, so these disagree with a
  path that says `'none'`: `packages/svg/src/lowerLeaf.ts` imports a filled `<polyline>` without
  stamping `openFill: 'close'`, so it stops painting under a `'none'` default, and the SVG writer
  emits an unfilled open subpath with its node's fill, which a browser then paints. The export half
  has to split a path that mixes closed and open subpaths. The booleans close every open contour
  whatever the path says (`packages/geom/src/booleans/contours.ts`, `implicitClose`). Also: a mesh
  the renderer cached keeps the rule it was built under when the default changes
  (`packages/renderer/src/cache/cache.ts` keys on the path), so the default has to be set before
  the first paint.

- **(P3) A closed outline with no fill is selected from inside it.** A marquee or lasso in
  `intersect` mode drawn wholly inside an unfilled closed shape takes it, though a click there
  does not: `shapeCoversPoint` reads the painter's ink (`NodeInk.filled`) and `regionTakes`
  (`packages/core/src/core/geometry/regionHit.ts`) is handed a path and tests its filled region.
  `canvas/deps/hitTestArea.ts` passes the ink for open subpaths only (`asInked`), because a path
  can say its open subpaths enclose nothing and cannot say that of a closed one. The same is true of
  `containsInFrame` (`packages/core/src/canvas/SceneCanvas/poseGeometry.ts`), which calls
  `pointInPath` on a path-shaped pose with no node in hand: wherever picking is not by shape, an
  unfilled path is picked across what it encloses, open subpaths included. Both want the region and
  frame tests to take "is this filled" beside the path.

- **(P3) WeaselDraw: no browser has drawn an imported clipped group.** A `<g clip-path>` reaches
  the scene as a container whose `data` is the clip, and the unit tests stop at that data. What is
  left is a `*.browser.test` that opens one and reads a pixel inside the group's box and outside
  the clip's outline.

- **(P3) svg import: `<tspan>` glyph positioning is not read.** `dx`, `rotate`, and list-valued
  per-glyph `x` / `y` are not applied; each warns, on `<text>` and `<tspan>` alike
  (`packages/svg/src/tspanLines.ts`). Kerned text exported as one `<tspan>` per glyph run imports
  with the glyphs run together: turning a positioned run into a letter spacing or a space needs the
  advance of the glyphs before it, which a parse with no face loaded cannot measure.
  `serializeSvg` writes no line height either, so a pitch read on import is dropped on export
  unless a caller carries it, as WeaselDraw does in `wd:line-height`.

- **(P3) svg import: a dropped file's hidden content is still left out.** `parseSvg(svg, {
  keepHidden: true })` keeps `display="none"` and `visibility="hidden"` content, each node marked
  `hidden`, and `svgNodesToKitDrafts` carries the flag onto its drafts. `unpackSvgFiles` does not
  ask for it, because a scene node has no hidden state of its own to map it to: only a layer has
  `visible`. With a per-node one, `unpackSvgFiles` passes `keepHidden` and writes the flag.

### Pathfinder follow-ups (post-v1)

- **(P3) Create Outlines refuses synthetic-bold text.** `textToPath` answers `reason: 'synthetic-bold'`: emboldening it is a union with the glyphs' own outline stroke, but the width has to match what the renderer's distance-field shift (`SYNTH_BOLD_AMOUNT`) draws, and that mapping to em units is not worked out.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** The booleans flatten beziers before clipping (`packages/geom/src/booleans/adapter.ts`), so the result is straight-line. Skia/PathKit-style curve-preserving booleans are substantially harder.
- **(P3) Live preview of a Boolean operation.** Seeing the result before committing: on hovering a Pathfinder button, or holding an op key over a path. `previewBooleanOp` answers the pieces an operation would make, each with its source and paint, and mints and commits nothing. What is left is everything that shows them: no Pathfinder action has a gesture or a key to hold, an action has no way to say what it would do while its button is hovered, and nothing draws paths that are not nodes over the scene.
- **(P3) A group's `data.label` is not drawn on the canvas.** Outline Stroke on draw's starter rect makes a group that takes the rect's data (`drawOutlinesAdapter`, `apps/draw/src/outlinesAdapter.ts`), so the layer list still reads "Welcome", but the word the rect wore on the canvas is gone: `defaultDrawOne` draws a leaf's label and nothing draws a container's.

---

## Rendering & paint

- **(P2) `SelectionPanel` cannot clear a fill.** Since `fill` became a record (2026-10-12), the
  default node properties describe `data.fill` as an object leaf with a `paint` child, and
  `leafField.ts` gives a paint nested in an object `allowNone: false`. Its comment says no kit paint
  field is optional, which is no longer so: `Fill.paint` and `Stroke.paint` are both optional, and
  either record with no paint paints nothing. "None" on a nested paint should remove the `paint`
  field from its parent, which gives a stroke the same control. Draw is unaffected: it clears a
  fill through `setFill`.

- **(P3) Pattern fills: no image-upload patterns.** WeaselDraw's picker covers the four built-in
  tiles only, each a paint kind of its own (`{ kind: 'hatch', color }`). A user-supplied bitmap
  needs a paint kind that persists the image itself (data URI, or a document-scoped asset table),
  which is a storage question rather than a paint one.

- **(P3) No marker icons.** `defaultNodeProperties`'s `markerStart` / `markerMid` / `markerEnd`
  leaves use a labeled `select`, where the sibling stroke enums (`cap`, `join`, `align`, `dash`)
  are icon toggles. The marker glyphs have to be authored to this repo's icon standard.

- **(P3) Renderer: geometry and paint space far from the origin are still single precision.** The
  transform stack is in doubles and a large model translation is rebased before upload
  (`setProjAndModel`, `u_origin`); that is proven by float32 arithmetic in
  `draw.precision.test.ts`, not in a browser. Not measured, and still float32: a path's own
  coordinates (`PolygonPath.coords`, `Mesh.vertices`), which at world x = 262,144 sit on a 1/32
  world unit grid, 2 px at 64x, so a tessellated shape is quantized where a batched rect (doubles)
  is not; `u_worldInv`, which places a `units: 'world'` gradient or pattern per fragment from a
  world-sized translation; and the model a consumer's own vertex stage receives (`u_view` on a
  shader command, `u_model` in a registered paint kind), which has no `u_origin` to rebase against.
  The first needs a per-path origin in `@weasel-js/geom`'s tessellation, the second the same
  rebase applied to the paint matrix.

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

- **(P3) Text direction: the Align bar lights `start` / `end` as if an omitted `direction` were
  `ltr`.** An omitted `TextStyle.direction` is `'auto'`, each paragraph's first strong character, so
  right-to-left text aligned `start` paints from the right while the bar lights Left. The bar's
  encoding (`alignEncoding` in `packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts`) is
  handed the leaf's siblings, which are the style's fields and not the node's text, and
  `paragraphDirection(text, direction)` needs the text. Undecided: whether `PrefEnumEncoding.read`
  and `write` should be handed the whole node, or the bar should show `start` / `end` as their own
  state instead of resolving them to an edge.

- **(P2) Text: emoji paint as flat silhouettes, and multi-code-point emoji paint as their parts.**
  The canvas tier keeps only the alpha channel (`packages/font/src/dynamic/glyphRasterizer.ts`), and
  `layoutRuns` looks glyphs up one code point at a time, so `👍🏽` is a thumb plus a swatch, `🇨🇦` is
  two letters, and `👨‍👩‍👧` is three people, all in the run's fill color. Needs glyph lookup by
  grapheme cluster and a color (RGBA) atlas page drawn untinted for clusters with emoji
  presentation. `LaidOutCell.clusterEnd` already marks where each cluster closes.

---

## Scene, adapters & layout

- **(P3) geom's `Mat3` and `mat3` are different matrices.** `Mat3` and the free functions beside
  it (`identity`, `multiply`, `invert`) are the six-number affine; `mat3` and `GlMat3` are the
  nine-element column-major matrix a GL uniform takes. Both are exported from `@weasel-js/geom`'s
  root, a capital letter apart.

- **(P2) `arrayAdapter` as the default Canvas adapter — full unification.** `arrayAdapter`,
  `useArrayAdapter`, and `sceneToAdapter` are three separate wirings, and `Canvas.tsx` takes
  whichever a caller built as its `adapter` prop, with a no-op one when none is passed. What is
  left is one adapter contract and one default wiring, with every scene a tree rooted at one
  container, as `useScene`'s already is.

- **(P3) `packages/core/src/core/scene/scene.ts` is still over the size cap: 611 lines, 519 of them
  `buildScene`.** What is left in that function is the node mutators (`add`, `removeMany`, `setPose`,
  `setLayer`, `setLayout`, `move`, `reorder`, and the smaller ones, about 210 lines) and the wiring
  of the modules that now own the rest: `notifier.ts`, `editMode.ts`, `sceneSelection.ts`,
  `opTable.ts`, `recorder.ts`, `outerOps.ts`, `layerStack.ts`, and `historyFacade.ts`. Each mutator
  checks its arguments against the lock guard, the layer stack, and the node store, then records, so
  moving them out as they stand hands one module all of those at once. The wiring shrinks when the
  entry below lands and `outerOps.ts` goes.

- **(P3) `loadState` can leave a locked node selected.** It keeps the selected ids the loaded
  snapshot still holds and does not ask whether a lock now covers them, so a selected node the
  snapshot puts on a locked layer stays selected: `getSelection()` answers with it and `isLocked`
  answers true. Every other selection write goes through `set` or `narrow` in `sceneSelection.ts`,
  which drop locked ids; `loadState` uses `replace`, which does not.

- **(P3) A direct scene call made while a journal is open lands on the scene's own stack.**
  `scene.applyBatch` goes to the open journal; `scene.setPose` and its siblings, `scene.batch`, and
  `scene.history.apply` do not, so a mode that mixes the two splits its edits across two stacks.
  Ruled 2026-10-12 to leave it for now. Routing them means `recorder.record` and the history facade
  consulting the journal accessor. `scene.recordedForm.test.ts` pins today's split.

- **(P3) Duplicate and Alt-drag clone: a copy that derives from nodes outside the copy still follows
  the originals.** `copySelection` (`interactions/actions/defaults/copySubtree.ts`) re-points a
  copied node's `dependsOn` id list at the copies only when every node in it was copied too. With
  one or more left out, the copy keeps the original list, so duplicating an edge alone gives a
  second edge drawn exactly over the first. A paste drops such a node instead (ruled 2026-10-11);
  the call for a copy made inside the same scene, where the originals are still there to follow, is
  whether it does the same, keeps the list, or re-points the ids it can.

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

- **(P3) Scene layout: what the first cut left.** A layout a container declares on its node
  (`ContainerNode.layout`) is measured by `UseSceneOptions.layoutFrame` unless a canvas installs
  its handler, so a scene whose canvas uses a custom pose descriptor states how a pose is measured
  twice. And undecided: whether the `layouts` prop, now a second way to name a container's layout,
  should be retired in favor of the node declaration.
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

- **(P3) Timeline: a frame that skips whole laps fires them under `loop: n` and not under
  `loop: true`.** `tick` in `packages/animator/src/timeline/createTimeline.ts` fires every
  skipped lap's events under `loop: n` but none under `loop: true`, where `booking.ts` says
  crossings fire "nothing of the laps in between". Which of the two is meant is undecided.

### Timelines and rigging

- **(P3) A paused looping timeline seeked to its `duration` shows its start** — the next frame
  wraps a playhead at `duration` to 0 and counts a lap, paused or not (`tick` in
  `packages/animator/src/timeline/createTimeline.ts`). In the timeline demo, dragging **scrub**
  to its right end shows t = 0: the readout says `3000 / 3000 ms`, then `0 / 3000 ms` a frame
  later.
- **(P3) A pose typed by an interface is not a `ClipValue`** — `ClipValue`'s object arm is an
  index signature, which an interface such as `RectPose` does not satisfy, so
  `{ t: 0, value: pose }` is a type error for a `pose: RectPose` and fine for the same object
  written inline.
- **(P3) Editing a skinned path's points leaves its weights misaligned** — inserting or deleting
  a point does not renumber `data.skin`, whose arrays are indexed by point. The anchor edit
  actions (`interactions/actions/defaults/anchorEditing.ts`) would splice each joint's array, or
  the skin would be weighed again with `autoSkin`.
- **(P3) A stroke of the weight tool bends the path when it ends, not while it is painted** —
  the rig in view is bound from the document, and a stroke is written at its end. Showing it
  live needs the bound rig to read the tool's in-flight weights.
- **(P3) A skinned path is seen at rest by a view with its own `toPose` and by a node that
  derives from it** — an override's `path` is in the scene's frame, so `sceneDerivedPathOf`
  leaves it out for a `toPose` reader, and `DerivedDep.path` answers a derived path only.
- **(P3) `useRigNode` drops a running animation when it binds again** — a change to the rig
  node or anything under it makes a new rig with a new `target`.
- **(P3) The bone and weight tools have no icon and are not `defaultTools` ids** — they are
  mounted as `tools={{ bone, weight }}`, as slice is.

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
- **(P3) A spring or a coast on a target is ticked every frame, to ask whether it has come to
  rest** — a tween on a target with no `onTick`, and a hold, are ticked only once they have
  something to do (`due` on an animation's row, `packages/animator/src/engine/schedule.ts`);
  a frame of 10,000 such tweens costs 0.28 ms (`node tests/perf/target-reads/run.mjs table
  10000 idle`). A spring has no time it is known to rest by, so it still costs a call a frame
  as an object, as anything with an `onTick` must. A bound on when a spring can first be at
  rest, from its damping, would give it a `due`; retargeting and pushing it would move the
  bound. The rest of a frame is blits' pull.
- **(P2) Stopping and starting an animation costs more as more are running, and what is left
  of that is in blits** — `node tests/perf/target-reads/run.mjs churn 1000 10000` times the
  parts (orochi, plain Node 26, blits 0.10.0). With 100 restarted a frame: a cancel costs 5 µs
  with 1,000 running and 21 with 10,000, a start 1 and 2, and the frame after them 1.1 ms and
  4.1 against 0.08 and 0.93 steady. The cancel is blits' `forget` walking every subject the
  mix holds, and the slow frame is blits' first read of the new voices.
  `~/src/blits/NOTES-FROM-WEASEL.md` ("Stopping a subject's voice") has the lines and a fix.
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

- **(P2) agnew and rosee on `<Lab>`: built, not merged.** Each repo has an unpushed
  `lab-onto-labkit-lab` branch that mounts `<Lab>` and serves its `?bare` embed through
  presentation, with its smoke test passing. agnew's runs on labkit 1.9.2 as it is. rosee's
  plays every tile on the lab's clock and needs `<Lab clock>`, `opening`, and the
  empty-sidebar fix, which `packages/labkit/CHANGELOG.md` lists under 1.9.3: its
  `@weasel-js/labkit` range must be raised to that before it can merge. agnew still plays
  from its own transport, because its three.js view advances the pen itself and holds a
  finished curve before redrawing it; moving it onto a lab clock is an agnew library change,
  and the owner's call.

### labkit's deprecated snapshot undo

- **(P3) Delete `packages/labkit/src/undo/undoStack.ts` and its exports**
  (`emptyStack`, `pushSnapshot`, `undo`, `redo`, `clearUndo`, `UndoStack`) once
  sherpa's studio (`apps/studio/src/Studio.tsx`), the last user, moves its
  document undo onto `createHistory`.

## Audio

Design: `docs/superpowers/specs/2026-08-22-audio-engine-design.md`.

- **(P3) The side-scroller's music bed as engine voices.** The bed is hand-written PCM
  (`platformer/sfx.ts`, `bed`). Its struck metal is expressible as `{ partials }`
  and its chugs and bass as harmonic partials with a `decay`. The arrangement
  is expressible too: a hit that lands late is a fractional `step`, the loop's
  drift sharp and back is the player's `detune` as a function of the step, and
  `patternVoicePeaks` says whether its busiest moment fits the music bus's
  voice limit. What is left is the port itself, and one thing with no engine
  equivalent: the four bars are peak-normalized together, which as voices
  becomes a bus gain chosen by ear, or a compressor insert.

- **(P3) Trope-aware generative scoring: unheard, and with no demo.** `createScore`
  plays a mood on three axes (valence, tension, urgency) as bars written by
  `scoreBar` from `scoreParams`, and names the cue in force through `state()`
  and `onBar`. Every number in the mapping was chosen from the description of
  the four cues and checked only as structure, on a fake audio context: the
  thresholds between modes and harmonies, the tempo range, the envelopes, the
  layer levels, and where each cue sits on the axes. Whether dread reads as
  dread is a listening pass nobody has done. It also wants a demo that shows
  the cue and its parameters beside the sliders, so a consumer can see which
  device is being applied.

- **(P3) AudioWorklet voices** — immune to main-thread jank. Moving only the
  scheduler's timer into a worklet would change nothing: it already runs off
  the main thread, in a Worker, and what a stall delays is the callback that
  makes a voice's nodes, which has to run on the main thread. Immunity means
  synthesizing the voices inside a worklet processor from events posted ahead
  of time: a second implementation of the oscillator, partial, noise, filter,
  and envelope voices, plus a worklet module, cross-thread messaging, and a
  bundling story. The engine's `onLate` option reports every event a stall made
  late, and by how many ms. Revisit when it fires in a real app whose
  `lookahead` has already been raised.

---

## Selection, actions & UI panels

- **(P2) A `Badge` with both `onClick` and `onRemove` renders a `<button>` inside a `<button>`.**
  `Badge.tsx` wraps its content in a `<button>` when it is clickable and draws the remove control as
  a second `<button>` inside it. React logs "<button> cannot contain a nested <button>" when
  `Badge.test.tsx` "fires onRemove without firing wrapper onClick" runs, and no test marks it. The
  fix moves the click target off the outer element (a `role="button"` wrapper beside the remove
  control), which changes the badge's box and needs a browser to check.

- **(P3) A palette whose every swatch is an anchor is reported feasible without a check.** Read
  from the code and not tested: `searchHues` in `packages/theme/src/engine/color/generate.ts`
  returns `[]` when no swatch is free, so `generate` reports `feasible: true` with no gate measured
  against the anchors. Whether all-pinned colors should be checked at all is the open question.

- **(P3) An action's code has two homes.** `actions/defaults/<name>.ts` holds the action, and a
  sibling `actions/<name>/` (align, distribute, clone, clipboard, booleans, outlines, edit-anchors,
  lasso-select) holds its options, geometry, and gesture adapter. One directory per
  action would hold both, the way `actions/move/` and `actions/flip/` do with their `action.ts`.

- **(P3) Disabled has no signal of its own, now that emphasis is an alpha.** Disabled is `opacity:
  0.4`–`0.5` on the whole control, and subtle text is 0.54–0.64 alpha, so a disabled control and a
  subtle label can read alike. Ruled 2026-10-11: disabled gets a second cue besides fading. Which
  cue is not chosen yet; that leaves choosing it and giving it to every control that fades when
  disabled.

- **(P3) apps/site never loads the kit's faces.** It imports no `@weasel-js/theme/faces.css` or
  `fonts.css`, so `--wzl-font-ui`'s Oswald and `--wzl-font-numeric`'s Oswald Tabular fall back to
  system faces in every demo. Left as is for now by decision; draw loads `fonts.css`.

- **(P3) `ToggleBar`'s `minimal` is not `ButtonBar`'s.** The three bars share one skin,
  `components/segmentedControl.module.css`, and fork only at `minimal`: `ButtonBar` and
  `OptionsBar` draw bare rounded segments with a gap, and `ToggleBar` adds `.minimalBoxed` over
  that, a bordered box with square corners and a rule between neighbors. Which look wins, or
  whether both are variants every bar takes, is a visual call.

- **(P3) Nothing in `@weasel-js/ui` shows a quantity's composites or styles its parts.**
  `presentRange` and `presentVector` exist, but no component calls them: `BandEditor` does not
  report a band as a range. `Slider`'s thumbs still take bare numbers where `BandEditor`'s bands
  take tagged ones; and no ui stylesheet styles the `data-part` or `data-composite` spans the HTML
  form emits, so `PropertyField` still draws its suffix from its own `unit` prop.

- **(P2) Redesign the stop color/opacity swatches under `GradientEditor`.** Each stop gets
  a `ColorField` with an alpha slider in a row beneath the track (`GradientEditor.tsx`). The
  owner wants that row redesigned; the shape it should take is still open.

- **(P3) labkit's `LabSwitcher.less` menu is a fork of the weasel-ui popover skin.** It copies
  `MenuButton`'s menu and items, but with an opaque surface and a different shadow from
  `components/listbox.module.css`, which `MenuButton`, `Select`, `ComboBox`, `PaintField`, and
  `Bar`'s popover share. Decide whether those differences are intended; if not, it wants the
  shared skin — and its items are links, which `MenuButton` has no way to render yet.

- **(P3) labkit and the apps hand-build what weasel-ui already draws.** Each differs a little
  from the ui component, so swapping changes pixels and needs a call on which look wins:
  labkit's `.lk-viewport-controls__button`, `.lk-toolbar-button`, and `.lk-titlebar-button`
  against `Button`'s ghost icon button; `SidebarRegion`'s section head and undock button against
  `SidebarPanel`; `LabHeader`'s bare "Add trial" button beside the `MenuButton` it becomes
  with more than one instrument; the theme editor's swatch tabs against `ToggleBar`'s flat
  variant and its hex and number inputs against `Input` and `NumberField`.

- **(P3) Nothing on the site sets the mode.** The chrome follows `data-wzl-mode` and whatever
  theme is applied, but no reader can pick one: the demo shell draws the default theme in dark.
  `useColorModePreference` and a `ColorModeControl` in the sidebar would do it. Look at the pages
  in light mode first: demo scenes still draw in colors chosen for a dark page (`#d4c4a8` labels
  in `ViewportDemo`, `AudioDemo`, and other demos), a few rules darken with `rgba(0, 0, 0, 0.2)`
  in either mode, and the front page pins its own theme to dark.

- **(P3) Overlays still set React Aria's deprecated `UNSTABLE_portalContainer`.**
  Its replacement, `UNSAFE_PortalProvider`, is exported by `react-aria` but not
  re-exported by `react-aria-components`, and depending on `react-aria`
  directly risks a second copy whose context the overlays never read — which
  fails silently, as an unthemed overlay. Switch `useOverlayPortal`
  (`packages/ui/src/overlays/portalHost.tsx`) to the provider once RAC exports it.
  The same switch lets a contained `ToastRegion` drop its own region for RAC's,
  which would make it an F6 landmark again. Still absent from RAC's index at the
  installed 1.21.1 and at nightly `3.0.0-nightly-99e610236-261006`, last checked 2026-10-11.

- **(P3) Hover reports motion only, and nothing in the kit binds it yet.** `hover` is a gesture
  (`HoverSpec`; `docs/taxonomy.md`, "Gesture"): an immediate action bound to it runs on every
  unpressed pointer move. It does not say when the pointer leaves the surface or passes from one
  target to another, so the loupe (`packages/labkit/src/loupe/useLoupe.ts`), which puts its lens
  away on `pointerleave`, still hand-attaches both listeners, and `CustomShaderDemo` reads the
  cursor from its own `onPointerMove`. Wants a leave signal (and a decision on whether crossing
  between targets is one), then the loupe's aim and the demo's cursor-following panels moved onto
  bindings. Only jsdom has run a hover binding.

- **(P3) labkit's palette drag-drop runs its own pointer session.** A trial's
  pan, zoom, tap, and loupe route through weasel's dispatcher (`CameraInput`),
  but dragging a palette item onto a canvas is `useDragDrop`
  (`packages/labkit/src/dragdrop/DragDropRuntime.tsx`): a press in the sidebar
  that ends over the canvas, which no binding on the canvas's dispatcher sees
  begin. Routing it needs a drag that starts on one element and drops on
  another — the same shape `ingest` answers for an OS drag.

- **(P2) Things that look duplicated in this engine and are not.** Pairs a duplication audit
  will flag again, and the reason each one stays two.

  Local- vs world-space bounds, and `nodeAtPoint` vs `pickBest`, are different
  questions. Miter apex vs capsule, and butt cap vs half-disc, are a defensible hit
  model over shared base geometry. `unionBounds` stays rotation-free beside
  `unionAABB` for commit-time actions that write poses back in the unrotated frame.
  SVG's `#000000` initial fill is a spec default, not drift. `resolveNodeFill`'s
  split between `kit:path` and `kit:shape` is documented and correct.
  `useBuiltinShapeTools`' nine hook calls are not a list, and are already
  compiler-linked through the return type. `arrayAdapter` has no `setChildOrder`
  because its root order *is* the item array's order. `sceneToAdapter`'s area walk
  returns containers where the live marquee dep does not — one flag on the shared
  walk, because a bare-adapter consumer has no selection parent-folding to fold
  them back in.

  In labkit, modes, d3, paint, and ui:
  labkit's camera (`worldToScreen`, `zoomAt`, `centerOn`, `clampZoomAbout`) is a
  pan/zoom/`yDir` view model, not affine kernel math. labkit's `fitView` anchors at
  the origin where `TrialOverview`'s `fitRect` centers with padding. `toShape`
  collapses a zero-size axis to 0 where `boxToBox` keeps scale 1, and Plot2D's
  `modelToPlot` fails on a zero range where `boxToBox` would silently not scale.
  `toDeviceRect` is a y-flip plus device-pixel snap. Badge's `polygonSampler`
  parameterizes a polygon by CSS-pixel arc length under the viewBox's anisotropic
  scale, and Powerline carries its own normals. paint's `lerpHueDeg` is CSS Color 4
  hue interpolation, not angle geometry. CurveEditor's Catmull-Rom and monotone
  splines are curves geom does not have, and its bezier easing already goes through
  geom's `cubicBezierEasing` (via core). The scalar `Math.max(lo, Math.min(hi, v))` clamps
  scattered through ui and labkit are not geometry; geom has no scalar clamp. d3
  and modes do no geometry at all.

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

- **(P3) Shading drawn in black or white at an alpha.** Shading that belongs to one control's
  artwork is still a literal: `Badge`'s bevel fills and text shadow, the default colors of its
  `Metal` and `Sunbeams` effects, the `Slider` thumb's shadows, the segmented track's well, and
  the glass ramp's gloss, rim, and drop shadows in `Button` and the selected segment, which
  `--btn-*` tunes and `--wzl-gloss` fades. Whether any of it wants a theme token, and under what
  name, is not decided.

- **(P3) `<ToggleBar>` polish.** Visual still needs polish — literally, polish this.

- **(P3) Loose ends of the condition work.** A rail entry for a group drawn under
  `markHidden` carries no mark, and a hidden `Bar` cell is dimmed with no badge. In a
  `SelectionPanel`'s narrow label column the `hidden` badge runs about a pixel into the field.
  `PrefSchemaEditor` edits an entry's own
  `enableIf` and nothing inside an object entry, whose fields it draws no rows for, so a field's
  `{ from: 'item' }` condition is written in code. A list of plain text entries is one
  `ListEditor`, which disables all of its entries or none, so an item `enableIf` that reads the
  entry does nothing there.

- **(P3) What `over` does not reach yet.** Every surface takes the schema its aliases point
  into, and its own conditions may read, as `over`. Left: (1) A condition that reads a setting
  of `over` takes that leaf's default only where the surface takes its own leaves': a `Bar`
  reads `values` alone and a `SelectionPanel` only an `absentIsDefault` leaf's. Whether `over`'s
  default should stand in there is not decided. (2) `PrefSchemaEditor`'s preview of a properties
  layout seeds its one node from the layout's own leaves and writes only under `pose` and
  `data`, so a row aliased into a dialog's schema draws unset and an edit to it goes nowhere.
  Its drag ghost draws a pointer with no `over`, as an alias of nothing. (3) A lab
  resolves its instrument's config schema with no `over` (`useConfigSchema`), so that schema
  cannot hold a condition on another's setting. labkit's `ControlMatrix` takes `over` for its
  conditions and for the popover an alias's cell opens, but the cell itself summarizes the
  alias's own path, which holds nothing.

- **(P3) What a bar does not do yet.** `ActionBar` is not built on `Bar`: its `icons` prop
  overrides an entry's icon with a `ReactNode`, which a leaf, being data, cannot carry, so it needs
  that prop to become icon names or `Bar` to take icon overrides by path. A bar too long for its
  room scrolls, with no overflow menu. A group a standalone `Bar` opens from a button draws as
  labeled rows whatever its `as`, where a bar in a `PrefsForm` opens it in its own form.

- **(P3) Two `usePrefsStore` callers with different schemas leave one holding a closed store.**
  Two mounted callers naming one `storage` and `prefix` with different schemas: the later render
  takes the prefix and the other keeps the store it closed. That store now says `closed` and
  warns on its first write, but nothing reopens it or tells the component holding it.

- **(P3) A rail of sections and pages: two things not decided.** A `PrefsForm` rail lists a page
  at any depth, and a section only when it sits directly on a page, the root's own included. (1) A
  foldable rail unfolds an entry only while the open page is it or under it, so a section holding
  pages of its own keeps their entries shut while the reader scrolls through it. Whether the
  section in view should unfold is open; it would move the rail under a reader who is scrolling.
  (2) A section's rail entry and a nested page's look the same until one is chosen.

- **(P3) What `SelectionPanel`'s `selected` still does not reach.** A top-level section drawn
  `as: 'bar'` or `as: 'fragment'`, or with no name, draws no heading, tab, or panel, and its key
  marks and reports nothing, which is ruled to stay so (2026-10-11). Cmd or Ctrl on a press of a
  tab does not toggle, in the panel or in `PrefsForm`: a react-aria tab keeps its pointer events,
  so the press arrives as the focus it causes, which carries no modifier.

- **(P3) Loose ends beside a number's unit as data.** `PrefSchemaEditor` edits a number's
  default, and its auto value, in the stored unit and not the one the leaf shows. The text tool's
  percent unit (`useTextTool.ts`) is still code, for the rounding it does on the way back to the
  stored value, so the run properties do not export as a literal. Nothing reads a unit's `format`
  yet. A unit whose accepted suffix is all digits moves to the front of the list, as an object's
  integer keys do.

- **(P3) A fragment has no box for a preview drag to land on.** Its element is
  `display: contents`, so a drag in `PrefSchemaEditor`'s preview cannot land beside or into an
  `as: 'fragment'` group itself, only beside the rows inside it; the structure tree takes both.

- **(P3) `PrefSchemaEditor` sees only a `ResolvedConfig`'s `group`.** A schema built with
  `f.section` keeps its sections, `showIf` rules, `.render` overrides, and `.dialog` rows beside
  the `PrefGroup` tree, not in it, so the editor shows a sectioned schema as one flat list and its
  export drops all four. A schema is sectioned rather than nested where `f.group` would move its
  config paths.

- **(P3) `sectionTree` doesn't lift heading controls.** `ControlPanel` draws a `.heading()` leaf,
  or a first row repeating its heading ("Pump" under "Pumping"), in the heading's title row and
  warns about the repeat. The prefs rail `sectionTree` feeds to `PrefsForm` still draws that leaf
  as a row under a heading of the same name, and doesn't warn, because `PrefsForm` has no slot for
  a control in a rail item or subsection heading.

- **(P3) The desktop themes bevel four things and have never been looked at.** Of `win9xTheme`
  and `platinumTheme` (`@weasel-js/theme/themes/*`), only `Button`, the field frame,
  `PropertyPanel`, and a `titlebar` frame read the `--wzl-bevel-*` hooks. Checkbox, radio, switch,
  tabs, sliders, `ToggleBar` and the segmented control, menus and popovers, `Dialog`, toolbars,
  and the tooltip take each theme's colors and corners and draw no bevel, so a screen of them
  reads as flat gray. Each wants the matching hook read as a `var()` fallback, as
  `field.module.css` does. The systems' own faces are named in the font stacks and not bundled; a
  bundled lookalike needs a face whose license allows it. And nobody has seen either theme:
  browser tests pin computed values only.

- **(P3) Two gaps beside a `ColorSource` written to CSS.** A palette entry or a function source
  is written as the literal it resolves to in the provider's selection (`colorSourceCss`,
  `packages/theme/src/colorSource.ts`), so with no `<ThemeProvider>` it does not follow a mode
  change the way a theme ref does. And a custom `CurveLayer` has no resolver on its
  `LayerRenderCtx`, so one that wants a color has to render a component that calls `useColorCss`,
  as `CurveFill` does.

- **(P3) labkit stored lab: a trial that fails to hydrate is left out with only a console warning.**
  `hydrateTrials` and `hydrateSnapshots` (`packages/labkit/src/state/hydrate.ts`) skip a trial or
  a snapshot whose `deserialize` or `migrateConfig` throws, and its record stays in storage,
  unwritten and undeleted. Nothing in the lab says a trial is missing, and nothing can discard its
  record. The call to make is whether the lab draws a failed tile with a way to discard it.

- **(P3) labkit trial: "Add trial" leaves the first trial's part outside its own stage.** In the
  `annotate-lab` example, adding a trial narrows the first trial's stage, and its camera keeps the
  pan it had, so the part and its marks sit past the stage's edge, out of sight until the trial is
  panned back. Whether a stage that narrows should re-fit or keep its pan is not decided.

- **(P3) Which control a leaf gets is decided again in each params surface.** `prefFieldProps` is
  the shared half; each caller then overrides it: `Prefs/PrefsRow.tsx`,
  `SelectionPanel/renderLeaf.tsx` (`renderBuiltin`), labkit's `controls/fields.tsx` (`labField`) and
  `controls/MatrixCell.tsx`, and `packages/labkit/examples/schema-lab/prefsToFields.ts`. The
  answers differ: a boolean with no `control` is a checkbox in the form and labkit and a switch in
  the panel; `control: 'toggle'` on a boolean is a checkbox in labkit; a `slider` number with no
  bounds is a 0..100 slider in ui and a typed input in labkit (`isSliderLeaf` wants both bounds); an
  enum's `radio` is segments in labkit and `menu` is a select; a stored value that is absent is
  the default in the form, unset in the panel, and `?? default` in labkit, where `null` also reads
  as absent. Home: a `surface` argument on `prefFieldProps` (`'form' | 'panel' | 'lab'`) carrying
  these defaults in one table. labkit's "radio means segments" and "a slider needs bounds" are
  the two to decide on purpose.

- **(P3) Two things the params commit table does not settle.** `PARAMS_SETTLES` in
  `Prefs/commitPolicy.ts` says which controls write only a settled value in a form, a panel, and
  a lab, and `withCommitPolicy` applies it for all three. (1) labkit's `ControlPanel` debounces
  text by 150 ms in its own row (`useDebouncedText`), which the table has no word for: it reads
  as "writes as it changes". (2) The panel's reason for settling text and color is that every
  write is an undo step, yet a slider there writes per move; whether `scene.batch` coalesces
  those into one undo step is unverified.

- **(P3) Collecting a run of `tab` groups, and what each other `as` draws, is written four times.**
  `Prefs/PrefsPane.tsx`, `Prefs/objectRows.tsx` (both `ObjectLeaf`s),
  `SelectionPanel/panelSections.tsx` (`placed`), and labkit's `controls/panelRows.tsx`.
  `GroupTabs` is shared; the run logic is not, and it differs: `panel` is a bordered box in ui and a
  plain `PropertyGroup` in labkit; `section` is a `Subpanel` in labkit and a heading elsewhere; a
  group's `description` shows under a tab in `PrefsPane` and is dropped for tabs and sections in
  labkit; `SelectionPanel`'s top level flattens nested sections (`flatten` in `model.ts`), so a
  nested `tab` or `panel` loses its `as` while the object leaf beside it honors nesting; an empty
  tab section neither joins nor ends the run in `objectRows`, a hidden one does not end it in
  labkit, and `PrefsPane` has no emptiness check. Home: a pure "children as runs" helper in
  `@weasel-js/prefs` (leaf, tab run, or group with its resolved `as`) that all four walk.

- **(P3) The schema lab's `prefsToFields` re-derives what `@weasel-js/prefs` owns.**
  `packages/labkit/examples/schema-lab/prefsToFields.ts` turns each leaf of a property schema into
  a `ConfigField` by hand, and a `field` leaf becomes free text there. `ControlPanel`'s `fields`
  prop is marked deprecated in favor of `schema`: pass the schema, which goes through
  `prefFieldProps`, and delete the file. Not a drop-in today: an instrument's `config` takes
  labkit's own `ConfigSchema` (`packages/labkit/src/config/types.ts`), and nothing turns a
  `PrefSection` with dotted keys into one or into a `ResolvedConfig`, so the example first needs a
  way for an instrument to declare its config as a pref schema.

- **(P3) `PrefSchemaEditor`'s attributes pane lists a mixed object or union attribute read-only.**
  `aggregateAttributes` drops an object, list, map, or union attribute from the form when the
  selected nodes disagree on it. `PrefsForm` draws a mixed field and writes it at its own path,
  so the pane could show such an attribute field by field; its `onChange` would then have to take
  a field path, where `attrOf` reads `default.width` as an attribute name.

### WeaselDraw app follow-ups (defer)

- **(P3) Multi-page documents.**

---

### weasel-den deferrals

From `docs/specs/2026-05-03-weasel-den-design.md`. **Read `packages/den/README.md` first**: the
spec's pack shape was superseded by core's `Contribution` + `mergeContributions`, and its
convenience layer shipped inside core. The items below are what survives that.

- **(P3) Additional domain bundles.** `useWhiteboardPack` (sticky notes, freeform pen, text),
  `usePresentationPack` (frame tools, slide nav). Each is its own arc, and each is a
  `Contribution` bundle rather than a den pack. The diagram bundle shipped as
  `@weasel-js/diagram`; don't propose another.
- **(P3) Move `useSelectTool` / `useTextTool` / `usePenTool` /
  `usePencilTool` out of core's builtin tools.** The den's one motivation nothing
  has absorbed: separating finished, stable tools' test surface from core's. It
  needs no new package — `packages/den` is a README, not a package — and core's
  own workspace layout can hold them. Defer until each is stable.

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

- **(P3) `PAGE_RULES` names 8 axe rules and turning them off removes 7.** Measured in the
  2026-10-12 test audit: with `page: false` axe runs 7 fewer rules than with `page: true`, so one
  id in `packages/forge/src/frame/a11y.ts` is not a rule axe runs by default. Which one is not
  known.

- **(P3) A story whose `render` takes no args has no controls.** forge reads a
  control for each prop of the meta's `component` (`packages/forge/src/vite/propTypes.ts`),
  and leaves them off a story whose `render` declares no parameter, since nothing
  would read them. A grep of `render: () =>` finds about 210 such stories. A story
  drawing one instance in a plain configuration is the kind to rewrite around
  `args`, the way `Tooltip`'s `Basic` is; a matrix or a hand-built composition
  stays as it is. Where a component's props are a union or generic, as
  `ToggleBar`'s and `PropertyField`'s are, its stories pass a few named args and
  the other controls do nothing. Where a story holds a value in state, as
  `Timeline`'s playhead and `Jog`'s index are, the control only sets where it
  starts.

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
  the branch covers. A save also refuses a param that differs by `mode` while
  the trial's mode is Auto, since the panel does not know which scheme the
  frame resolved.

- **(P3, isolated stories only) A forge story whose `viewport` the index cannot
  read reloads its frame once when first opened.** The index reads a native
  story's `viewport` when both sides are number literals (`viewportOf`,
  `packages/forge/src/vite/indexFile.ts`), and the first instrument takes its
  stage from that. Otherwise — a computed size, or a CSF story, whose viewport
  comes from `parameters.viewport` and `globals.viewport` — the stage arrives
  with the frame's `ready`, and labkit's `Trial`
  (`packages/labkit/src/trial/Trial.tsx`) renders stage content inside `<Stage>`
  and other content bare, so `FrameView` remounts and the iframe reloads. A
  general fix keeps the frame through that remount (it is already placed by hand,
  and `moveBefore` moves an iframe without reloading it), or has `Trial` keep
  the body at one tree position whether or not there is a stage.

- **(P3) windease lays out a node that was registered and never shown.** A
  strip gives a `mounted` node its room and a seam, while `Container` renders
  only `visible` ones, so the pane is an empty gap with a live separator
  (`layout-node-adapter.js` skips `hidden` and `destroyed` only; windease
  2.0.0). `Split` works around it by showing its sidebar node and hiding it
  again (`createSplitStore`, `packages/labkit/src/primitives/Split.tsx`). The
  fix belongs in windease; the workaround goes when it lands.

- **(P2) A forge dev server started with `WAKE_EXTRA` served the modules it started with, whatever
  was edited after.** Seen on `WAKE_EXTRA=33461 npm run dev:forge`, four times in one session: after
  an edit to `packages/labkit/src/chrome/regions/SidebarRegion.less`,
  `/packages/labkit/src/styles.less` (which imports it) kept answering with the old rules while
  `/@fs/…/SidebarRegion.less` asked for directly had the new ones, and a `touch` changed nothing;
  after an edit to `packages/forge/src/shell/cssVars/CssVarsPanel.tsx` the page ran the old
  component across reloads. No `hmr update` line reached the log, so the watcher looks dead rather
  than one import edge untracked. A restart served the new code every time. A real vite server on
  a temp root does not reproduce it: a file replaced whole (written beside and renamed over) is
  served new each time, for a module and for a stylesheet another one imports
  (`packages/forge/src/vite/replacedFile.test.ts`), and it still is with 13,000 more directories
  under the root, about what 26 worktrees in `.claude/worktrees` add to the main checkout's watch.
  Read, not run: nothing in wake's `WAKE_EXTRA` path or forge's plugin touches the watcher. Not
  checked: the real server on the repo root, where it has to be watched failing, and whether the
  server wake owns does the same.

- **(P2) wake (`~/src/wake`, not this repo): every hot update is followed by a full reload about
  three seconds later.** `hotUpdate` in `~/src/wake/src/index.ts` sets `stamp = Date.now()` for any
  non-CSS file even when `fullReload` is off. The page's own stamp in `~/src/wake/src/client.ts` is
  a `const` read once from `<meta name="wake-build">`, so after a successful hot update the next
  poll sees a newer server stamp, and after `GRACE_MS` the page reloads itself. Scenario: edit a
  story in forge with wake loaded; forge reloads the story in place, then the tab reloads and
  unpersisted trial state is lost. This hides forge's own hot-update path on this machine, which is
  why `WAKE_PATH=/nonexistent` is needed to see it. The same client is injected into `/frame.html`,
  so every isolated frame and both warm pool frames poll `/__wake`, draw their own `.wake-badge`,
  and reload on their own. Fix in wake: adopt the server's stamp on `vite:afterUpdate` when
  `fullReload` is off, and skip the client when `window.parent !== window`.

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

- **(P2) Six visual specs and one perf spec were edited in the 2026-10-12 test audit and have not
  been run.** No browser was available to the audit. `tests/visual/params-labels.spec.ts` and
  `panel-stances.spec.ts` mounted `Properties.module.css` raw, which has held only `@import` lines
  since that sheet was split, and now read it through `readModuleCss`. `loupe.spec.ts` passed on an
  empty lens and now also requires the scanline to cross the magnified rules. `insert.spec.ts`,
  `gestures.spec.ts`, and `shape-tools.spec.ts` were retitled, and `tests/perf/draw-loop.spec.ts`
  had comments corrected. Run the visual project and fix what the new assertions find.

- **(P3) Three visual baselines are of an empty canvas.** `tests/visual/insert.spec.ts`,
  `gestures.spec.ts`, and `shape-tools.spec.ts` each screenshot the canvas at mount, before any
  gesture, so none can catch a change to what its name says it covers. They are titled "mounts an
  empty canvas" now. Drive one insert or shape drag in each and capture a baseline after it.

- **(P3) `draw-loop`'s `alternating` variant no longer times a program switch.** Gradients join
  the batched run now, so the variant in `tests/perf/draw-loop.spec.ts` that alternated a solid
  with a gradient measures one program. A pattern fill still breaks the run; replace the variant
  with one, and count draws to pin the premise.

- **(P2) `useHostAnchor.browser.test.tsx` fails on the fleet about every other run.** Two full
  runs on 2026-10-12 each failed one test in it, a different one each time: "keeps following
  through a second move" read 0 where it expected 140 (studio), and "follows a host that a
  collapsing sibling moves" left the panel 80px from its host (teitou). Neither commit changes
  anything under `packages/core`, and the file passed in a full run of `main` the same evening.
  Both are assertion failures after `settled()`, not timeouts, so the panel had not followed the
  host by the time the test read it. The second also failed once in a fleet run of `main` at
  `d5a9d4943` and passed on that commit in the run before. Not reproduced, and not run alone. The
  assertion reads the anchor before the observer that moves it has fired; it wants to wait on the
  position rather than read it once.

- **(P3) Browser tests time out on the fleet, a different handful each run.** Each of these has
  failed once or twice in a full run on studio, teitou, or msb-uai with a 15 s test timeout or a
  `locator.screenshot` timeout, and passed in the runs around it:
  `Prefs/PrefsForm.drop.browser.test.tsx`, `labkit/src/lightbox/Lightbox.browser.test.tsx`,
  `labkit/src/controls/compoundRows.browser.test.tsx`,
  `PatternPicker/PatternPicker.browser.test.tsx`,
  `core/src/features/text/overlayAlignment.browser.test.tsx`,
  `labkit/src/lab/LabLightbox.browser.test.tsx` ("an expanded trial keeps its marks over it and
  takes new ones"), `SelectionPanel/SelectionPanel.selection.browser.test.tsx`, and
  `PrefSchemaEditor/PrefSchemaEditor.types.browser.test.tsx`. Those run alone on this machine at a
  failing commit passed: `PatternPicker`, `overlayAlignment`, and `LabLightbox` (3 of 3, 1.3 s).
  Measured 2026-10-12, nine full runs at one commit, three on each of studio, teitou, and msb-uai:
  with `browser` run after the other projects (`sequence.groupOrder` in `vitest.config.ts`) none of
  six runs had a timeout, and one of three baseline runs did (`overlayAlignment`, on studio). That
  is suggestive and no more: at a one in three rate six clean runs come up about 9% of the time. It
  cost 12 to 52 s a run on teitou and msb-uai and nothing on studio, which takes about 175 s either
  way against 100 to 115 s on the others and hosts a long-running render service; both failing runs
  were there. A 15 s `browser` timeout in a run made since would mean running beside the other
  projects was not the cause, and the `groupOrder` line should come out. Not measured: fewer
  workers for `browser`, and whether studio's own load is the cause.

- **(P3) `forge/src/vite/plugin.test.ts` fails when the dev server does not follow a rewritten
  file.** Every failure is a test that writes a file and waits 15 to 20 s for the server to follow
  it, among them "serves the component graph from source, and pushes it again when a component file
  changes" and "titles a native story by its meta when forge's meta reaches it through a helper
  module, and re-decides when the helper changes". It has failed in fleet runs on studio and
  teitou, and alone on orochi, where it is not load from the suite: 2 of 3 runs failed at
  `af9f3db6b`, up to five tests each, and 1 of 2 at `29dfa85eb`. A site dev server on orochi that
  evening also served a file as it was before an edit, and a `touch` did not wake it, so there the
  watcher missed the write.

- **(P2) A docs minisite per package: overview, guides, and demos.** `npm run build:api` documents
  every published package in one TypeDoc site at `/api/`. Still to design: an overview and
  hand-written guides per package (only labkit has any, in its own VitePress site), and the
  demos that exercise a package shown from its pages. Rendering TypeDoc's JSON output inside the
  site's own shell is the route that puts all four in one place.

- **(P2) The API reference build still reports 12 warnings.** `docs/conventions.md` says
  `npx typedoc` reports none. Each is a documented export naming a type its barrel does not export:
  - `Bivariant` (`packages/core/src/core/scene/types.ts`), `OpsApplier` (`canvas/deps/slice.ts`),
    `XY` (geom's `pathHitTest.ts`), and `OnTokenChange` (ui's `TokenPanel/tokenTypes.ts`): a
    one-line export each.
  - `LabBaseProps` (labkit's `Lab.tsx`) and `CreateOptions` (storage's `records.ts`): an exported
    type needs a doc line, and both files sit at their `check:size` cap, so each wants its split
    first.
  - `BadgePropsByShape` in ui: exporting it surfaces `BadgeBaseProps`, `BadgeShapeParams`, and
    about thirty per-shape, per-base, and per-effect parameter types behind them.
  - `Key` (`string | number`), declared three times in ui: `useAsyncOptions.ts`, `ComboBox.tsx`,
    and `Select.tsx`. It wants one exported definition.
  - `DepSchema` and `OverlaySchema` in routing, which its root does export. core merges into both
    with `declare module`, and TypeDoc appears to file the merged interface under another symbol
    than the one `DepName` and `KernelOverlay` reference (read from the warning, not traced).

- **(P3) SVG export writes wrapped text as one line.** `data-weasel-wrap` round-trips
  `TextStyle.wrap` for weasel's own reader, but SVG `<text>` never wraps, so any other reader draws
  a wrapped node as its unbroken lines. Exporting the laid-out lines needs fonts at serialize time,
  which `@weasel-js/svg` does not have. A justified node is written at its start edge with
  `data-weasel-align="justify"` for the same reason: once lines are exported, its wrapped lines
  need per-word `x` placement too, since `text-anchor` has no justify.

- **(P3) `SerializeOptions.pretty` does nothing.** `packages/svg/src/types.ts` declares it and
  nothing in `packages/svg/src` reads it, so the serializer's output is the same either way.
  Implement it or remove the option.

- **(P3) AnimationDemo: the demo builds and mutates its own adapter because the animation wrappers
  have no canvas seat.** `apps/site/demos/AnimationDemo.tsx` spreads `sceneToAdapter(scene, {
  selection })`, overrides `insertNode` / `removeNode` / `snapshotSelection` by hand, wraps the
  result in `animateOnSetPose` and `animateLifecycle` through two `as never` casts, hands that to
  `useSelectTool` / `useTools`, and then calls `adapter.setPose` / `adapter.insertNode` from button
  handlers, so those writes skip the op pipeline and undo. `<SceneCanvas>` should take the
  wrappers itself (an `animate={{ setPose, lifecycle }}` option, or a `SurfaceContribution` that
  wraps the adapter the canvas already builds), so the demo keeps `features={['pick', 'move']}` and
  its buttons call `scene.setPose` / `scene.add`. A button's `scene.setPose` never reaches the
  canvas's adapter, so the seat has to say where a scene-level write gets animated.

- **(P3) draw warns of two route conflicts every time it loads.** In the console of the dev build,
  each "two bindings declare the same (phase, gesture, arg, target, modifiers) tuple in the same
  scope, so declaration order alone decides which one fires":
  `[*:*] drag ?shift ?alt — declared by slice, slice`, which is `useSliceTool`'s
  `slice.dragPoint` binding (shift and alt optional) against its own plain `slice` drag
  (`packages/core/src/tools/builtin/slice/useSliceTool.ts`), and
  `[initial] keyDown(Enter) — declared by mode.path-edit.entry, mode.free-transform.commit,
  mode.crop.commit`. Not looked into further: whether each is a real ambiguity, or bindings the
  check cannot tell apart because a predicate or a mode keeps them from being live together.

- **(P3) draw: two owners for "is a text edit open".** The kit's `useSceneTextEdit` holds
  `editingId`; the app's mode machine (`apps/draw/src/modality/machine.ts`) holds a `text-edit` mode
  that says the same thing. Two effects with `prev` refs in `apps/draw/src/App.tsx` reconcile them in
  each direction, and their comments record two shipped bugs from the split. Text cannot take the
  shape path editing has (`<SceneCanvas pathEdit>` reading the open path from the machine,
  `modality/pathEditHost.ts`) as it stands, because the session is real state inside the hook (the
  overlay, the caret, the pending commit): the hook needs an `onEnd` for the ends it decides itself
  (click-away, the node going away), and its `onDoubleClick` has to hand the hit and the caret seed
  to the machine instead of starting the edit. A double-click on a path is still acted on by both
  the kit's `enterPathEdit` binding and the app's `onDoubleClick` observer; they reach the same
  machine call and the second is a no-op. No browser has driven path editing through the machine:
  the tests are jsdom, which cannot hit-test a canvas.

- **(P3) draw: `EditorWithSharedScene` in `apps/draw/src/App.tsx` is one 450-line component.** The
  file is split by job; this component is what is left to split.

---

## Backends (WebGL future)

- **(P3) WebGPU backend.** Separate future spec.
- **(P3) Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win,
  significant API complexity. Defer until measured pain on the single-thread pipeline. The
  main-thread `OffscreenCanvas` that rasterizes pattern tiles in
  `packages/core/src/features/patterns/` is not worker offload.
- **(P3) Headless server-side rendering in Node.** `renderSceneToPixels`
  (`packages/core/src/canvas/renderSceneToPixels.ts`) accepts a caller-supplied `gl`. Left: verify
  it against a `gl` from `headless-gl` (untested there), or wire up a worker + `OffscreenCanvas`
  path for a Node-hosted consumer.
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

## Lint

- **(P3) eslint-plugin-react-hooks v7 compiler rules still off.**
  Every compiler rule with no reports is on, as is `set-state-in-effect`. Three are off, with the
  rationale in `eslint.config.js`, counted on 2026-10-12:
  - `refs` — 408 reports in 83 files; reading a ref during render is how a
    canvas library reaches frame state, and there is no writes-only mode
    (`weasel/no-render-ref-write` covers writes).
  - `immutability` — 51 reports in 37 files, 26 of them in tests that assign to
    a prop or an outer variable from inside a probe component. The rest are
    `useVisibleRaf` loops re-requesting themselves, and writes to forwarded
    refs, DOM nodes, and mutable engine objects.
  - `preserve-manual-memoization` — 16 reports in 9 files, of a `useMemo` or
    `useCallback` whose listed dependencies differ from the ones the compiler
    infers. Nothing here is compiled, but a mismatch is also where a stale
    closure would hide, so each wants reading: `SceneCanvas.tsx` (4),
    forge's `useStoryRegistry.ts` (3), `StoryTrial.tsx` (2), and `FrameView.tsx`,
    labkit's `Trial.tsx` (2) and `useTiledSurface.ts`, core's
    `GestureDispatcherMounter.tsx`, ui's `useOutsideDrop.ts`, and the
    `ForceGraphDemo`.

---

## Release-gate & build hygiene

- **(P2) Browser tests time out under fleet load, each inside a Playwright action.** Every one
  passes alone, and nobody has confirmed load is the cause:
  - `PrefSchemaEditor.types.browser.test.tsx` ("a list's entry is edited inside the attributes
    pane…"): 14.5 s in `userEvent.click` after the tree row was found and scrolled to; 0.3 s alone.
  - `core/src/features/text/overlayAlignment.browser.test.tsx` ("sans-serif 16px lands on the
    canvas glyphs"): 7.8 s in `page.screenshot` waiting for the element to be stable.
  - `AssetEditor.steps.test.tsx`: timed out at 5 s.
  - `forge/src/vite/plugin.test.ts` ("serves the component graph from source…", 15 s) and
    `forge/src/timeline/timeline.browser.test.tsx` ("plays on real frames"), in separate runs
    while about twenty other runs shared the fleet.

- **(P2) HUD vs DOM text: what the idle rerun left open.** `tests/perf/hud-vs-dom.spec.ts` prices
  the HUD against plain DOM, a React overlay, and a DOM layer moved as one element
  (`tests/perf/README.md`, "HUD text against a DOM overlay").
  - **The HUD's 5,000-glyph readout gets the fewest frames** — about 70 ms apart under every
    camera, against 43–61 for the DOM — while its traced busy time is the lowest, about 9 ms per
    frame. Either the headless frame scheduler or a thread the trace analysis does not count
    (renderer worker threads, for one) accounts for the rest; nothing has checked which. Until it
    is, none of the frame intervals can be read as a display's frame rate.
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
  today's timing, so the size of the gain is not settled. What is left:

  - **A run-breaker costs about 21 us a flush** (`flush-anatomy.spec.ts`), 16 of it bind and draw;
    no other call in `flushBatch` moves it by more than its noise, about 1.2 us. So what remains is
    the draw count: synthetic bold and an eighth texture still break the run, and so does a color
    matrix around an image or a gradient. A solid or a glyph under a color matrix has its color
    mapped on the CPU (`draw/foldColor.ts`), which paints the same pixel as the shader in headless
    Chromium (`colorMatrixFold.browser.test.ts`) and has not been timed. The specs that break a run
    with a matrix on solid rects (`flush-anatomy`, `clip-cost`, `flush-noise`) turn the mapping off
    through `colorFolding`, and have not been run since that edit. An image under a diagonal matrix
    with no bias could be mapped the same way and is not.
  - **A clip only the stencil can express still flushes on entry and exit**: a polygon, a rect
    turned off the axes, and a rect clip with a slanted item crossing it (`DrawBatch.clipQuad` says
    why a slanted edge cannot be cut). The stencil itself costs about 4.9 us a push and pop, 7.9 at
    8 leaves (`clip-cost.spec.ts`).
  - **Caching `u_synthBold`, `u_samplers`, and `u_fieldScale` was tried and reverted**, measured
    through `finish`: it saved about 0.1 us a flush on color-matrix breaks and made a frame of
    20,000 stroked rects 30% slower, with both renderers interleaved in one page. The cause was not
    found.
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

- **(P3) What inside Chromium or ANGLE slows frames drawn back to back in one task** — 4–10x after
  about eight (`tests/perf/README.md`, "Timing a frame") — is unknown.

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

  **Run the control first.** Every number in it is canvas2d on a page that also holds a WebGL2
  context. Nobody has measured that rung with no GL context at all, so "the batch costs its
  co-tenant" and "this rung is expensive whenever GL is resident, and the batch only changes the
  timing" are not yet separated. That is one run and it could retire the entry.

- **(P3) Per-layer GPU dispatch skipping.** `RenderLayer.deps`
  (`packages/core/src/core/layers/render.ts`) skips rebuilding a layer's command tree, not
  submitting it: every layer still goes through `WeaselRenderer.render` every frame. Skipping that
  means drawing each cached layer into its own texture once and compositing one quad per layer,
  which the renderer has no concept of today.

  Measured: **compositing a cached layer is cheaper than resubmitting it once the layer holds more
  than about 130–250 commands**, at every layer count from 4 to 64. Below that, resubmitting wins,
  by up to 7 ms at 64 layers of 10 commands. At 64 layers of 1,000 commands, submission costs 58 ms
  a frame and the composite 5.4. With a single layer the composite costs nothing measurable.

  `tests/perf/layer-dispatch.spec.ts` times `N` unchanged layers of `M` commands (half solid rects,
  a quarter text labels, 15% images, 10% linear gradients) through `drawLayers` with a warm command
  cache, against a frame holding only one live rect. The composite stands in for cached layers with
  one canvas-sized image per layer, which batches 7 to a draw. Canvas 1280x800 at dpr 2. ms a frame
  over that control, two passes (`pass 1 / pass 2`), each the median of 3 runs:

  | Layers | Cmds a layer | Submit | Composite | Draws, submit / composite |
  |---:|---:|---:|---:|---:|
  |  1 |    10 |  0.07 /  0.03 |  0.02 /  0.03 |     1 /  1 |
  |  1 |    30 |  0.18 /  0.11 |  0.08 /  0.02 |     1 /  1 |
  |  1 |   100 |  0.28 /  0.23 |  0.12 /  0.10 |     3 /  1 |
  |  1 |   300 |  0.60 /  0.30 |  0.05 /  0.00 |     7 /  1 |
  |  1 | 1,000 |  1.19 /  0.85 | -0.02 /  0.04 |    21 /  1 |
  |  4 |    10 |  0.05 /  0.02 |  0.79 /  0.71 |     1 /  1 |
  |  4 |    30 |  0.09 /  0.09 |  0.94 /  0.80 |     1 /  1 |
  |  4 |   100 |  0.39 /  0.25 |  0.53 /  0.70 |     8 /  1 |
  |  4 |   300 |  1.15 /  0.90 |  0.63 /  0.53 |    24 /  1 |
  |  4 | 1,000 |  4.17 /  3.96 |  0.57 /  0.77 |    80 /  1 |
  | 16 |    10 |  0.14 /  0.19 |  3.63 /  3.58 |     1 /  3 |
  | 16 |    30 |  0.32 /  0.40 |  3.85 /  3.61 |     1 /  3 |
  | 16 |   100 |  1.48 /  1.51 |  3.66 /  3.71 |    31 /  3 |
  | 16 |   300 |  4.44 /  4.56 |  3.62 /  3.00 |    96 /  3 |
  | 16 | 1,000 | 14.42 / 15.00 |  1.74 /  1.69 |   319 /  3 |
  | 64 |    10 |  0.41 /  0.47 |  7.54 /  6.81 |     2 / 10 |
  | 64 |    30 |  1.04 /  1.10 |  7.24 /  7.85 |     3 / 10 |
  | 64 |   100 |  4.70 /  5.69 |  6.77 /  7.63 |   122 / 10 |
  | 64 |   300 | 17.14 / 17.54 |  5.67 /  5.78 |   383 / 10 |
  | 64 | 1,000 | 57.57 / 58.67 |  5.35 /  5.39 | 1,274 / 10 |

  Interpolating linearly between the 100 and 300 rungs, the crossing falls at 143 / 210 commands
  for 4 layers, 245 / 217 for 16, and 131 / 128 for 64. Submission runs about 0.75–1.2 us a command
  from 300 commands a layer up; the renderer's own `render()` time is about a third of that, and
  the rest is the GPU process and the GPU. A composited layer costs 0.08–0.25 ms, almost none of it
  in `render()` (0.04–0.09 ms for the whole composite frame).

  **With one layer changing every frame, the crossing moves to about 300 commands a layer, and past
  1,000 for a single layer.** The changed layer draws into an offscreen buffer as a group with one
  copy effect, then composites with the rest (`compositeDirty`), against submitting every layer
  with that one's `deps` changing (`submitDirty`). The copy is a full-buffer pass a real layer
  texture would not need, so the composite side is an upper bound. ms a frame over the control,
  `pass 1 / pass 2`:

  | Layers | Cmds a layer | Submit, one dirty | Composite, one dirty |
  |---:|---:|---:|---:|
  |  1 |   100 |  0.17 /  0.20 |  0.63 /  0.63 |
  |  1 |   300 |  0.43 /  0.45 |  0.88 /  0.87 |
  |  1 | 1,000 |  1.42 /  1.17 |  1.79 /  1.54 |
  |  4 |   300 |  1.64 /  1.50 |  2.31 /  2.33 |
  |  4 | 1,000 |  5.13 /  6.91 |  3.06 /  3.27 |
  | 16 |   100 |  2.69 /  2.58 |  6.64 /  7.14 |
  | 16 |   300 |  6.32 /  6.12 |  5.74 /  5.85 |
  | 16 | 1,000 | 14.53 / 14.74 |  2.63 /  2.70 |
  | 64 |   100 |  5.86 /  5.17 |  8.64 /  7.89 |
  | 64 |   300 | 16.94 / 17.06 |  6.75 /  6.72 |
  | 64 | 1,000 | 58.96 / 57.77 |  7.09 /  7.02 |

  A dirty layer adds 0.4–3.5 ms to the composite frame, most at 16 layers; submitting barely
  notices it, since rebuilding one layer's command tree is cheap next to submitting it.

  Still left out: the texture memory, 16 MB a layer at this canvas size (1 GB at 64 layers), which
  counts against building it; and quads bounded to a layer's content rather than the whole canvas,
  which would cost less fill and memory than measured here.

  Unexplained: the composite frame is identical down a layer count, yet it falls from 3.6 to 1.7 ms
  at 16 layers and 7.5 to 5.4 at 64 as the submit frames interleaved beside it get heavier. One
  reading, not checked: heavy neighbors hold the GPU at a higher clock. And one composited layer
  measures near zero while four measure 0.5–0.9 ms.

  Measured on teitou (Apple M5 Max, ANGLE Metal, headless Chromium 153), 2026-10-07; one GPU and
  backend only. Result files: `tests/perf/recorded/layer-dispatch-2026-10-07/` and
  `tests/perf/recorded/layer-dispatch-dirty-2026-10-07/`.

- **(P3) The pull request benchmark job has never run.** `.github/workflows/perf-pr.yml` runs
  `perf:bench` and `test:perf` on a pull request's merge base and head and posts the `perf:compare`
  table as a comment, without gating. The comment and directory-compare scripts are tested; the
  workflow steps have only been read. `perf:bench` has never run on the runner at all, since
  `perf.yml` runs `test:perf` alone. Unmeasured: how long two full runs take on the one self-hosted
  machine (the job allows 100 minutes), and whether the base, measured first, reads differently
  from the head for that reason alone.

- **(P3) labkit inlines siblings that own module state.** `packages/labkit/tsup.config.ts` bundles
  every `@weasel-js/*` sibling except core, theme, and animator, and its own comment gives the
  reason those are external: module-global state inlined twice is two copies of it. The same holds
  for `@weasel-js/quantity` (`registerDisplayKind` writes a module-level map, so a kind an app
  registers is unknown to the copy inside labkit's `dist`, and `displayKindOf` falls back to
  decimal without a warning), `@weasel-js/storage` (`memorySubscribers`), and `@weasel-js/ui`
  (`RecentColorsProvider`, the overlay portal host). labkit also lists those siblings as
  `dependencies`, so a consumer installs one copy and runs another. In the repo, aliases resolve
  both to one source, so no test can see it.

- **(P3) tsconfig `paths` is still kept by hand, and wider than `exports`.**
  `scripts/vite-aliases.test.ts` fails when the root `paths` sends an exported entry anywhere but
  where `exports` does. Two things it does not cover. The root `paths` has wildcard keys
  (`@weasel-js/geom/*`, `guides/*`, `renderer/*`, `labkit/*`, `forge/*`), so `tsc` resolves a
  subpath no `exports` map publishes that vite refuses. And `packages/core/tsconfig.json` maps ten
  siblings to source and leaves the others core imports — `animator`, `cursor`, `font`, `paint`,
  `prefs`, `quantity`, `renderer`, `stroke`, `text`, and `text-dom` — to resolve to their built
  `dist`; `tsup` reads that file for core's build, so widening it wants a look at what the
  declaration build then pulls in. Generate both blocks from the module the dev aliases come from
  (`scripts/lib/packageEntries.mjs`).

- **(P3) Most stores still keep their own listener set.** `createEmitter()` in `@weasel-js/registry`
  is the shared subscribe/notify primitive (a pass walks the listeners held when it began; a
  throwing listener is logged and the rest run). Still hand-rolled, each a `Set` and a loop:
  - in packages that already depend on registry: the scene (four loops in `core/scene/scene.ts`),
    and core's `useSliceTool`, `viewRegistry.tsx`, `canvasRenderer.ts`, `rigEditState.ts`,
    `useBoneTool.ts`, and `useWeightTool.ts`; animator's `engine/core.ts` and `engine/offsets.ts`.
  - in packages that do not, where each move adds the dependency: routing's `PointerContext` and
    `longPressState`, history and its journal, `select/store.ts`, storage's records, loupe's
    `canvasSource`, ui's `recentColors`, labkit's `panelHost`, `clockRegistry`, and
    `cameraRegistry`, and several in forge.

- **(P3) `check:spacing` exempts a directory that holds no stylesheet.** `isStylesheet` in
  `scripts/check-spacing.ts` skips `apps/site/CommandPalette/`, which now contains only
  `useCommandPaletteShortcut.ts`. Drop the exemption and the comment above it.

- **(P3) `SceneCanvasInner` is one 717-line function.** It is most of the 870-line
  `canvas/SceneCanvas.tsx`. `docs/audits/2026-10-12-SceneCanvas.md` lists what belongs to another
  owner; its dead-code pass and its sections on the built-in tool registry, the preset table, the
  chrome-caps rule context, path editing, selection, ingestion, the device profile, the camera, and
  the layer slots landed 2026-10-12. `canvas/Canvas.tsx` is 783 lines, 467 of them `CanvasInner`,
  after its scene-layer construction, its dev HUDs, and its camera moved to SceneCanvas. Left open by the preset table and the rule context, and described in the audit:
  `selectTool.rotate === false` is still decided in three places that do not agree, and the
  `modifierHeld` condition can never match on a `<SceneCanvas>`, which always reports no modifier
  held. Left open by the selection pass: the kind label published with the selection and the routing
  kind disagree on every node, and `SelectionPanel` has a third classifier; the command palette's
  summary prints the label, so making them one needs a decision on what it should say.

- **(P3) A pre-built layer in `<SceneCanvas layers>`'s `scene` or `selectionOverlay` slot is not
  painted.** Read, not run. `mergeLayersWithDefaults` spreads a `{ layer }` entry over the slot's
  defaults; `useSceneSlotLayers` then builds nothing for the scene slot, and
  `useSelectionOverlayLayer` builds its own overlay from what is left and never reads `layer`.
  `LayersMap` types `selectionOverlay` as accepting a `CustomLayerEntry`, so the second one
  typechecks. Either honor the entry in both hooks or take it out of the type.

- **(P3) `docs/concepts.md` and `docs/extending.md` teach API that is gone.** The "Putting it
  together" and `<Canvas>` examples in concepts, and "Custom layers" in extending, pass `adapter` and
  `selectionMode` to `<SceneCanvas>` and draw with a 2D `ctx.fillStyle`. The "Adapter" and "Gesture"
  sections of concepts still describe per-action hooks, which `docs/taxonomy.md` contradicts. Each
  needs rewriting against the current API, not trimming.
