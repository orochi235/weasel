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

- **(P2) `features` names two things.** The `<SceneCanvas features>` prop composes behavior presets
  (`canvas/SceneCanvas/features.ts`); `packages/core/src/features/<name>/` is a source directory
  bundling one domain's primitives, and `docs/taxonomy.md` calls each of those a "feature" too.
  Ruled 2026-10-11: the directory and the taxonomy's term take a new word, and the prop keeps
  `features`; the new word is not chosen yet. That leaves choosing it, then renaming the one path,
  its imports, and the section of the taxonomy.

- **(P3) The slice tool has no icon.** `useSliceTool` declares a label and a key but no
  `presentation.icon`, so `ToolPalette` draws its placeholder `?`, as the Slice demo shows. It
  wants a knife glyph in `packages/core/src/icons`, proofed the way "Drawing icons" in
  `CLAUDE.md` says.

- **(P3) Nothing reads a mode's `entry.trigger`.** Draw enters path-edit, isolation, and text-edit
  from `SceneCanvas`'s `onDoubleClick` observer through a kind-to-mode table of its own
  (`apps/draw/src/modality/doubleClickEntry.ts`), not from the `'double-click-target'` the
  definitions in `packages/modes/src/presets/default.ts` declare. Binding it means a double-click
  entry beside the kit's own `enterPathEdit` binding, and a definition does not say which hits it
  takes (draw's table does), so it waits on the same ruling as "draw: two owners for "is a text
  edit open"" under Demos, where the question is written out.

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
  3D kernel does not declare. `snap`, `lassoSelect`, `poseDescriptor`, `slice`, `ingestion`, and
  `pointer` are satisfiable as typed, because every coordinate in them is a screen point under the
  identity `clientToWorld` a 3D host passes. `pointer` was read, not run in a 3D host: its store
  (`PointerContextValue`) holds one `{ worldX, worldY, viewId }` point and no camera.

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

- **(P3) What the pointer recognizer's extraction left.** Three `pointermove` hover channels
  listen on one canvas element and each tracks "is a button down" its own way: the dispatcher's
  hover pump (`channels/hoverCursor.ts`), `useSurfaceInput` in core's canvas, and
  `PointerPublisher` in `PointerProviderIfRoot.tsx`.

- **(P3) What the text layout split left.**
  - `layoutEntries.ts` kerns each code point against the one before it, so a combining mark
    between two letters takes their pair's kerning away: `A`, U+0301, `B` sets the `B` where an
    unkerned one goes. `layoutEntries.letterSpacing.test.ts` ("tracks a base and its combining mark
    once") expects exactly that, so whether a mark should be skipped when kerning is not chosen yet.
  - `tests/perf/bench/text-layout.bench.ts` times layout alone now, so `BASELINE.md`'s numbers,
    which included grouping, need re-recording.

- **(P3) What removing the old tool design left.** A `<CanvasView>` converts client points with
  the bare rect helper (`clientToWorldHere` in `CanvasView.tsx`), and so does `worldPointAt` for a
  point that resolves to a declared view. A canvas's `clientToWorld` override reaches neither: it
  maps into the canvas's own world, and these need a client-to-canvas-local conversion it does not
  provide. The view resolver (`features/viewports/viewResolver.ts`) picks the view under a client
  point from the canvas's rect the same way.

- **(P3) What moving the Badge lab out of its stories file left.** The lab is
  `packages/ui/src/components/Badge/lab/` now.
  - It hand-rolls around kit components: `InlineRange` fits its range inputs, and
    `useReorderDragList` with `DragGrip` fits the effect-card reorder, which uses HTML5 drag and a
    text grip. Each swap changes how the lab looks or drags.
  - Its colors are literals (`rgba(255,255,255,…)`, `#7fb069`) in the stylesheets, not `--wzl-*`
    tokens.
  - In the workshop at a 1500px window, the Compose lab's "Type & padding" column and effects
    panel run past the right edge of the stage. Not compared against the lab before its text
    moved onto the type scale.

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
- **(P3) A group transform is wired for a translate only.** `GroupTransform` and
  `BehaviorResult.transform` exist (`packages/core/src/interactions/gestures/types.ts`), but the
  resize and rotate behaviors still answer a `pose` (`ResizeMoveResult`, `RotateMoveResult`), not a
  `scale` or `rotate` transform, and the `BehaviorResult.pose` shim they were to replace is still
  there.

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

- **(P3) A page that does not load core's stylesheet shows every canvas at its buffer size.** The
  renderer sets only a canvas's drawing buffer, and `<Canvas>`, `<SceneViewCanvas>`, and
  `<DrawCanvas>` size the element with a zero-specificity class from `@weasel-js/core/style.css`
  (`surfaceBox`). Without that stylesheet the element is `dpr` times too large, so it is wrong
  only on a high-density screen, and nothing warns. Core could adopt the one rule itself when a
  canvas mounts, the way `applyTheme` adopts its sheet; that reaches a page with no stylesheet
  and misses a canvas in a shadow root or a second document. Not chosen yet.

---
- **(P3) Wheel and keyboard zoom cannot be held to one axis.** `View.scale` is per axis and
  `fitViewToBounds` has `stretch`, but `ViewportZoomOptions` (`viewportZoom.ts`) has no
  `axis: 'both' | 'x' | 'y'`; only wheel pan and the hand tool take one.

## Paths & booleans

- **(P3) a pose's `transform` is drawn, picked, outlined, and resized in its own frame, and these
  do not read it yet.** A box pose may carry a `transform` (`PoseLinear`,
  `packages/geom/src/poseFrame.ts`): the skew or per-axis scale its box and rotation cannot hold.
  Ruled 2026-10-11: text and image nodes carry a full transform, and such text stays editable
  text. The selection chrome, its hit regions, and a lone node's resize and rotate read the frame
  through `core/geometry/targetFrame.ts`, and the text edit overlay is handed it as
  `TextEditScreenPose.frame`; a resize writes the box and keeps the transform. What still sees
  only the box and its rotation:
  - `remapRotatedLeaf` (`core/geometry/poseDescriptor.ts`) drops the shear a non-uniform group
    resize gives a turned leaf rather than writing it to the leaf's `transform`, and reads only
    the leaf's rotation, so a leaf that already carries a skew is remapped as if it had none. The
    chrome now follows whatever it writes.
  - `useSceneTextEdit` places the overlay, and tests a double-click, against the node's own pose
    (`effectivePose`), not its world pose, so text under a container whose pose is a frame is
    edited where it would sit without that container. It also scales by `view.scale.x` alone, so
    under non-uniform zoom the overlay is stretched wrong whatever the pose carries.
  - `composeRectPose` / `composeRigidPose` (`core/scene/composePose.ts`) keep a child's own
    transform and do not compose a container's into its children.
  - `defaultNodeProperties` has no row for it, so `SelectionPanel` can neither show nor clear it.

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

- **(P3) svg export: a marked stroke with several open subpaths draws one pair of end markers.**
  The renderer puts a start and an end marker on each open subpath (`markerHeads`, `markerSites` in
  `packages/stroke/src`). A path split for `openFill: 'none'` is written one open subpath to a
  `<path>`, so it matches. A path with `fill: none`, or one whose fill closes its open subpaths,
  stays one `<path>`, and SVG draws one pair for the whole of it; `marker-mid` differs too, since
  SVG puts one on every vertex between the path's first and last, subpath joins included. Read in
  the code, not rendered. The filled case means writing the fill and the strokes as separate paths.

### Pathfinder follow-ups (post-v1)

- **(P3) Create Outlines refuses synthetic-bold text.** `textToPath` answers `reason: 'synthetic-bold'`: emboldening it is a union with the glyphs' own outline stroke, but the width has to match what the renderer's distance-field shift (`SYNTH_BOLD_AMOUNT`, `packages/renderer/src/draw/text.ts`) draws. Read from `glyphCoverage` and `glyphFieldScale` (`packages/font/src/textSdf.ts`) and not measured against pixels: the shift moves the edge out by `SYNTH_BOLD_AMOUNT` of the field's span, which is `distanceRange` texels in a baked atlas and `SDF_RADIUS` in a runtime canvas page, and a texel is `1 / info.size` em, so the outline grows by `SYNTH_BOLD_AMOUNT × span / info.size` em on each side and differs by which tier serves the glyph. What is left: `textToPath` (`packages/text`) has no stroke outliner to call, since `strokeToPath` is in `@weasel-js/stroke`, which text does not depend on; the union flattens every curve of the glyph; and the result has to be compared with the field in a browser.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** The booleans flatten beziers before clipping (`packages/geom/src/booleans/adapter.ts`), so the result is straight-line. Skia/PathKit-style curve-preserving booleans are substantially harder.
- **(P3) Live preview of a Boolean operation.** Seeing the result before committing: on hovering a Pathfinder button, or holding an op key over a path. `previewBooleanOp` answers the pieces an operation would make, each with its source and paint, and mints and commits nothing. What is left is everything that shows them: no Pathfinder action has a gesture or a key to hold, an action has no way to say what it would do while its button is hovered, and nothing draws paths that are not nodes over the scene.
- **(P3) A group's `data.label` is not drawn on the canvas.** Outline Stroke on draw's starter rect makes a group that takes the rect's data (`drawOutlinesAdapter`, `apps/draw/src/outlinesAdapter.ts`), so the layer list still reads "Welcome", but the word the rect wore on the canvas is gone. `defaultDrawOne` does emit a container's label, but `buildSceneTree` (`packages/core/src/canvas/buildSceneTree.ts`) pushes a container's own commands before its children's, so the group's paths cover it. Drawing it on top needs the walk to paint a container a second time after its children, which `drawOne` has no way to ask for.

---
- **(P3) draw's SVG files do not carry layers.** A saved file keeps paper size, title, groups, and
  line height under the `wd:` namespace (`apps/draw/src/svgInterop.ts`) but no layer list and no
  layer id on a shape, so layers are lost on reopen; export only leaves hidden layers out
  (`svgExport.ts`). Whether a page has its own layers is undecided.

## Rendering & paint

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

- **(P3) Text: an emoji is a bitmap baked at one size.** A color glyph is rasterized at the canvas
  tier's `BAKE_SIZE` (48px) and mipmapped, so it is sharp at or below that on screen and blurs
  above it: a 96px heading, or body text zoomed past 4x. A distance field has no such limit and
  an emoji has no field, so it needs a second bake at the size it is drawn at, the way a vector
  image re-rasterizes in power-of-two steps (`maybeReraster` in
  `packages/renderer/src/images/imageCache.ts`). Separately, `textToPath` refuses text holding an
  emoji with `no-outlines`, as it did when the emoji was an escalated canvas glyph (read from
  `textToPath.ts`, not run).

---

## Scene, adapters & layout

- **(P3) geom's `Mat3` and `mat3` are different matrices.** `Mat3` and the free functions beside
  it (`identity`, `multiply`, `invert`) are the six-number affine; `mat3` and `GlMat3` are the
  nine-element column-major matrix a GL uniform takes. Both are exported from `@weasel-js/geom`'s
  root, a capital letter apart.

- **(P2) Hand-written adapters may still be flat lists.** `sceneToAdapter` is the only adapter the
  kit builds, and the scene slot paints only a tree. What is left is the tier below it: an adapter
  written by hand against the narrow contracts, which may leave the tree out. Readers still carry
  a second path for one that does — `adapterPickSource` (`canvas/pickWalk.ts`) walks `getNodes()`
  when `getChildren` or `getNode` is missing, `OrderedAdapter`'s two methods are optional and
  reorder ops do nothing without them, and the ops' `OrderedReader` (`core/ops/slot.ts`) treats a
  missing `getChildren` as "no siblings". `useSelectTool.zorder.test.tsx` and
  `useSelectTool.viewGates.test.tsx` pin the flat path. Needs a decision: require the tree of
  every adapter and delete those paths, or keep the flat list as the least a hand-written adapter
  can be. A smaller end: `sceneAsHierarchy`
  (`canvas/sceneViewRender.ts`) rebuilds four of `sceneToAdapter`'s reads because
  `sceneAdapter.ts` imports React for `useSceneAdapter`, which a headless render cannot.

- **(P3) A marquee and a lasso disagree on a node whose descriptor bounds reach past what it
  draws.** Two nodes share the pose `{0, 0, 40, 10}`, and a descriptor's `forNode` gives one a
  40-square box. A marquee over the band above the pose takes that node; an `intersect` lasso
  around the same band takes nothing. The node matches the default painter, whose silhouette is the
  pose rect, so its outline is the pose and not the descriptor's box. `regionTakes`
  (`core/geometry/regionHit.ts`) answers a marquee `true` for any rect outline once the bounds
  overlap, which holds only when the outline is the bounds; the lasso tests the outline. The
  `enclosed` branch's `!inBox` reject assumes the same the other way. Undecided: the module's
  contract says the outline decides, so the marquee shortcut should compare the drawn rect with the
  region, but that flips `sceneAdapter.regionOutline.test.ts`'s "marquee picks the ball and not the
  box", which then needs a painter for the ball to say anything about `forNode`.

- **(P3) A direct scene call made while a journal is open lands on the scene's own stack.**
  `scene.applyBatch` goes to the open journal; `scene.setPose` and its siblings, `scene.batch`, and
  `scene.history.apply` do not, so a mode that mixes the two splits its edits across two stacks.
  Ruled 2026-10-12 to leave it for now. Routing them means `recorder.record` and the history facade
  consulting the journal accessor. `scene.recordedForm.test.ts` pins today's split. Routing `scene.batch` also needs a new method
  on `Journal`: `batch` records ops that have already applied (`engine.recordEntry`), and `Journal`
  has only `applyBatch`, which would apply them again; a direct call that touches a laid-out
  container runs as a batch. draw opens a journal in every mode
  (`apps/draw/src/modality/machine.ts`), so the change moves where every direct call made during
  a mode lands.

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

- **(P3) A pose typed by an interface is not a `ClipValue`** — `ClipValue`'s object arm is an
  index signature, which an interface such as `RectPose` does not satisfy, so
  `{ t: 0, value: pose }` is a type error for a `pose: RectPose` and fine for the same object
  written inline.
- **(P3) A view with its own `toPose` shows no pose override, a skinned path included** — a
  scene slot's `toPose(node)` replaces the pose a node is painted at, so a drag in flight, a
  rig's bound nodes, and a skinned path all show there as the document has them. The path is
  the visible part: an override's `path` is in the scene's frame, and `sceneDerivedPathOf`
  leaves it out for a `toPose` reader, as `sceneDepLookup` does for what derives through one.
  Not built, because it is a choice about what `toPose` means, and fixing the path alone
  would paint a bent path at the rest pose. The options:
  - *`toPose` stays the document's view* (today; `SceneSlotConfig.toPose` says "committed
    pose"). Nothing to build, and the entry closes with a sentence in `docs/concepts.md`.
    A minimap or a second view drawn through `toPose` never shows motion.
  - *`toPose` is handed the node as the scene shows it*, its `pose` the override's, and the
    override's `path` is carried from the override's pose to the pose `toPose` answers: by
    `descriptor.remapBounds` between the two boxes, or the pose frame's affine for a turned
    one. Every override shows in every view, and a `toPose` that offsets or scales needs no
    change. A `toPose` that ignores `node.pose` and places a node from its data alone gets
    the bent path fitted into a box that did not move with it.
  - *An override's `path` is kept relative to its `pose`*, as `data.path` is to a node's
    pose, and every reader carries it through the pose it paints at. One rule for both
    paths, at the cost of `pathInWorld` on every skinned path every frame in the common,
    no-`toPose` case, and every writer and reader of `PoseOverride.path` changes.

  Recommended: the second. A view exists to show the scene, an override is what the scene
  is showing, and the cost lands only on a reader that passes a `toPose`. It needs the
  pose `toPose` is called with settled first (`buildSceneLayer` and `scenePaintedPoseOf`
  both call it with the stored node), which is the larger half of the work.
- **(P3) `useRigNode` drops a running animation when the skeleton's joints change** — adding,
  removing, renaming, or reordering a joint makes a new `target` at the bind pose, since a pose
  target's axes are its joints in order. Carrying an animation across needs the animator to
  move what runs on one target to another with different axes.
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

### labkit's deprecated snapshot undo

- **(P3) Delete `packages/labkit/src/undo/undoStack.ts` and its exports**
  (`emptyStack`, `pushSnapshot`, `undo`, `redo`, `clearUndo`, `UndoStack`) once
  sherpa's studio (`apps/studio/src/Studio.tsx`), the last user, moves its
  document undo onto `createHistory`. Still imported there at sherpa `7ad02eb` (2026-10-08).

## Audio

- **(P3) The side-scroller's music bed is engine voices nobody has heard.** It plays from a
  pattern player on the music bus (`platformer/bed.ts`). The old render was
  peak-normalized as a whole, which voices have no equivalent of: `MUSIC_GAIN`
  in `usePlatformerAudio.ts` is set so one pass has the old render's RMS, and
  `platformerBed.browser.test.ts` holds it there, and each octave within 2 dB
  of the old balance. What is left is a listening pass: the bus gain chosen by
  ear, or a compressor insert in its place.

- **(P3) Trope-aware generative scoring: unheard.** `createScore`
  plays a mood on three axes (valence, tension, urgency) as bars written by
  `scoreBar` from `scoreParams`, and names the cue in force through `state()`
  and `onBar`. Every number in the mapping was chosen from the description of
  the four cues and checked only as structure: the thresholds between modes
  and harmonies, the tempo range, the envelopes, the layer levels, and where
  each cue sits on the axes. Whether dread reads as dread is a listening pass
  nobody has done; the `score` demo (`apps/site/demos/ScoreDemo.tsx`) plays
  each cue with its parameters beside the sliders, which is where to do it.

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

- **(P3) apps/site never loads the kit's faces.** It imports no `@weasel-js/theme/faces.css` or
  `fonts.css`, so `--wzl-font-ui`'s Oswald and `--wzl-font-numeric`'s Oswald Tabular fall back to
  system faces in every demo. Left as is for now by decision; draw loads `fonts.css`.

- **(P3) `ToggleBar`'s `minimal` is not `ButtonBar`'s.** The three bars share one skin,
  `components/segmentedControl.module.css`, and fork only at `minimal`: `ButtonBar` and
  `OptionsBar` draw bare rounded segments with a gap, and `ToggleBar` adds `.minimalBoxed` over
  that, a bordered box with square corners and a rule between neighbors. Which look wins, or
  whether both are variants every bar takes, is a visual call.

- **(P3) No control in `@weasel-js/ui` draws its numbers through `QuantityText`.** `QuantityText`
  draws a quantity, a range, or a vector as the HTML form `@weasel-js/quantity` writes, and dims
  a unit, a percent sign, and a label. No control uses it: `Slider`'s readouts, `BandEditor`'s
  ticks and ends, and `Transport`'s rate draw `qty().text`, and `PropertyField` still draws its
  suffix from its own `unit` prop. It draws no kind's MathML form.

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
  installed 1.21.1 and at nightly `3.0.0-nightly-99e610236-261006`, last checked 2026-10-11. 1.22.1 is out and unchecked.

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

- **(P3) `<ToggleBar>` polish.** Visual still needs polish — literally, polish this. Measured in
  Chromium 2026-10-13, three text segments, each variant at `md` and `sm`: every segment sits
  inside its track at one height, none clips its label, and a focused segment draws a 2px
  outline. One thing a reader of the props would not expect: under `minimal`, `size` does
  nothing. Both sizes are 20px high at the `sm` font size, where `default` is 32px and 22px
  and `flat` 28px and 20px.

- **(P3) A host cannot tell which assets a stored draft changed.** `AssetEditor` reports its
  changed assets through `onChangedAssets` only once it is mounted, so a host that shows one
  editor at a time and lists the others' assets as `elsewhere` marks nothing for a source whose
  draft has not been opened since the page loaded. The draft's text is the editor's own format.
  Left: a public function that reads a stored draft (its storage, key, codec, and the original
  workspace) and returns the ids of the assets it changes.

- **(P3) Loose ends of the condition work.** `PrefSchemaEditor` edits an entry's own
  `enableIf` and nothing inside an object entry, whose fields it draws no rows for, so a field's
  `{ from: 'item' }` condition is written in code. labkit's `ControlRow` draws a list of plain
  text entries as one `ListEditor` and passes it no `entryDisabled`, so an item `enableIf` that
  reads the entry does nothing in a lab; `PrefsForm` and `SelectionPanel` pass it.

- **(P3) What `over` does not reach yet.** Every surface takes the schema its aliases point
  into, and its own conditions may read, as `over`. Left: (1) A condition that reads a setting
  of `over` takes that leaf's default only where the surface takes its own leaves': a `Bar`
  reads `values` alone and a `SelectionPanel` only an `absentIsDefault` leaf's. Whether `over`'s
  default should stand in there is not decided. (2) `PrefSchemaEditor`'s preview of a properties
  layout seeds its one node from the layout's own leaves and writes only under `pose` and
  `data`, so a row aliased into a dialog's schema draws unset and an edit to it goes nowhere.
  (3) A lab resolves its instrument's config schema with no `over` (`useConfigSchema`), so that schema
  cannot alias into another schema or hold a condition on its setting. Every surface reads `over`'s
  values from the config it is handed, and a trial's config holds its instrument's alone: where a
  lab keeps another schema's values (each trial's config, the lab's store, or the app's) is not
  decided, and the instrument's `render` would need them too.

- **(P3) What a bar does not do yet.** `ActionBar` is not built on `Bar`: its `icons` prop
  overrides an entry's icon with a `ReactNode`, which a leaf, being data, cannot carry, so it needs
  that prop to become icon names or `Bar` to take icon overrides by path. `overflow="menu"`
  opens the cells a line has no room for from a button at its end, on `Bar` and `BarLayout` only: a
  bar in a `PrefsForm`, a `SelectionPanel`, an object row, or labkit's `ControlBar` has no way to ask
  for it, and whether it becomes the default is not decided. A cell in the menu is mounted only
  while the menu is open, so `PrefSchemaEditor`'s preview, which asks for no menu and keeps every
  cell on the line, would lose those cells as drop targets if it did. A group a standalone `Bar` opens from a button draws as
  labeled rows whatever its `as`, where a bar in a `PrefsForm` opens it in its own form.

- **(P3) A rail of sections and pages: two things not decided.** A `PrefsForm` rail lists a page
  at any depth, and a section only when it sits directly on a page, the root's own included. (1) A
  foldable rail unfolds an entry only while the open page is it or under it, so a section holding
  pages of its own keeps their entries shut while the reader scrolls through it. Whether the
  section in view should unfold is open; it would move the rail under a reader who is scrolling.
  (2) A section's rail entry and a nested page's look the same until one is chosen.

- **(P3) Loose ends beside a number's unit as data.** The text tool's
  percent unit (`useTextTool.ts`) is still code, for the rounding it does on the way back to the
  stored value, so the run properties do not export as a literal. A unit's `format` has one
  reader, the auto value labkit's `ControlRow` quotes in a row's tooltip. A compound leaf's
  one-line summary (`summarizeValue`) still writes the stored numbers of fields that have a unit.

- **(P3) A fragment has no box for a preview drag to land on.** Its element is
  `display: contents`, so a drag in `PrefSchemaEditor`'s preview cannot land beside or into an
  `as: 'fragment'` group itself, only beside the rows inside it; the structure tree takes both.

- **(P3) `PrefSchemaEditor` sees only a `ResolvedConfig`'s `group`.** A schema built with
  `f.section` keeps its sections, `showIf` rules, `.render` overrides, and `.dialog` rows beside
  the `PrefGroup` tree, not in it, so the editor shows a sectioned schema as one flat list and its
  export drops all four. A schema is sectioned rather than nested where `f.group` would move its
  config paths.

- **(P3) `sectionTree` doesn't lift heading controls.** `ControlPanel` draws a `.heading()` leaf,
  or a first row repeating its heading ("Pump" under "Pumping"), in the heading's title row. The
  prefs rail `sectionTree` feeds to `PrefsForm` still draws that leaf as a row under a heading of
  the same name, because `PrefsForm` has no slot for a control in a rail item or subsection
  heading, and `PrefLeaf` no field saying a leaf is one: `heading` is a labkit extra. `sectionTree`
  warns about the repeat, as the panel does.

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

- **(P3) Two things the params commit table does not settle.** `PARAMS_SETTLES` in
  `Prefs/commitPolicy.ts` says which controls write only a settled value in a form, a panel, and
  a lab, and `withCommitPolicy` applies it for all three. (1) labkit's `ControlPanel` debounces
  text by 150 ms in its own row (`useDebouncedText`), which the table has no word for: it reads
  as "writes as it changes". (2) A slider dragged in a `SelectionPanel` leaves one undo step per
  move. Measured in jsdom 2026-10-13: three `change` events on a `control: 'slider'` leaf took
  three `scene.undo()` calls to unwind, because `commitLeaf` writes through `scene.batch`, whose
  entries never coalesce. The slider is live there so the canvas follows the drag; one step per
  drag needs the drag's writes to share an entry, which the scene has to offer.

- **(P3) What each group `as` draws differs across the params surfaces.** The run of neighboring
  `tab` groups is collected once (`prefTabRuns`, `@weasel-js/prefs`); what is drawn is not: `panel`
  is a bordered box in ui and a plain `PropertyGroup` in labkit; `section` is a `Subpanel` in
  labkit and a heading elsewhere; a group's `description` shows under a tab in `PrefsPane` and is
  dropped for tabs and sections in labkit; `SelectionPanel`'s top level flattens nested sections
  (`flatten` in `model.ts`), so a nested `tab` or `panel` loses its `as` while the object leaf
  beside it honors nesting; an empty tab section is left out of the run in `objectRows`, a hidden
  one in labkit, and `PrefsPane` has no emptiness check.

- **(P3) The schema lab's `prefsToFields` re-derives what `@weasel-js/prefs` owns.**
  `packages/labkit/examples/schema-lab/prefsToFields.ts` turns each leaf of a property schema into
  a `ConfigField` by hand, and a `field` leaf becomes free text there. `ControlPanel`'s `fields`
  prop is marked deprecated in favor of `schema`: pass the schema, which goes through
  `prefFieldProps`, and delete the file. Not a drop-in today: an instrument's `config` takes
  labkit's own `ConfigSchema` (`packages/labkit/src/config/types.ts`), and nothing turns a
  `PrefSection` with dotted keys into one or into a `ResolvedConfig`, so the example first needs a
  way for an instrument to declare its config as a pref schema.

- **(P3) `PrefSchemaEditor`'s attributes pane lists a mixed list, map, or union attribute read-only.**
  `aggregateAttributes` keeps an object attribute the selected nodes disagree on and marks its
  mixed fields, each written into every node's own object. A list, a map, or a union that
  disagrees is still dropped from the form and listed as `mixed`, as is an object with a field of
  one of those kinds that disagrees: none has a control with a mixed state.

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

- **(P3) A story whose `render` takes no args has no controls.** forge reads a
  control for each prop of the meta's `component` (`packages/forge/src/vite/propTypes.ts`),
  and leaves them off a story whose `render` declares no parameter, since nothing
  would read them. A grep of `render: () =>` finds 215 such stories in 76 files, most of them matrices or wrappers holding state. A story
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

- **(P3) A dev server serves no edit while macOS file events are not arriving, and only forge's says so.**
  This is what "a forge dev server started with `WAKE_EXTRA` served the modules it started with" was,
  measured 2026-10-13 with `fseventsd` at 98% CPU and 2.6 GB: a write in a temp directory reached
  neither `fs.watch` on that directory nor the `fsevents` module in 12 seconds, while a watch on the
  file itself fired at once; a forge server on `WAKE_EXTRA` served none of three edits; and
  `packages/forge/src/vite/replacedFile.test.ts` failed both its tests. wake, `WAKE_EXTRA`, and the
  worktree are not part of it. That the earlier sighting had this cause is inferred from the matching
  symptom, not measured. forge now writes a file at startup and warns when no event comes back
  (`packages/forge/src/vite/watchProbe.ts`). Left: the site and draw servers give no such warning;
  the forge tests that wait on a real watcher (`replacedFile.test.ts`, the `FOLLOWS` polls in
  `plugin.test.ts`) fail in this state and read as a regression; and what holds `fseventsd` there is
  not known.

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

- **(P3) A dev server on orochi has missed a file write.** A site dev server there served a file
  as it was before an edit on 2026-10-12, and a `touch` did not wake it. Seen once and not
  reproduced. `forge/src/vite/plugin.test.ts` lost file events for its temp directory the same way,
  7 of 26 tests in one run on 2026-10-13, and polls now; whether a checkout loses them too is not
  measured.

- **(P2) A docs minisite per package: overview, guides, and demos.** `npm run build:api` documents
  every published package in one TypeDoc site at `/api/`. Still to design: an overview and
  hand-written guides per package (only labkit has any, in its own VitePress site), and the
  demos that exercise a package shown from its pages. Rendering TypeDoc's JSON output inside the
  site's own shell is the route that puts all four in one place.

- **(P3) SVG export writes wrapped text as one line.** `data-weasel-wrap` round-trips
  `TextStyle.wrap` for weasel's own reader, but SVG `<text>` never wraps, so any other reader draws
  a wrapped node as its unbroken lines. Exporting the laid-out lines needs fonts at serialize time,
  which `@weasel-js/svg` does not have. A justified node is written at its start edge with
  `data-weasel-align="justify"` for the same reason: once lines are exported, its wrapped lines
  need per-word `x` placement too, since `text-anchor` has no justify. A hard line break is one
  line too, and that half needs no fonts: `textXml` (`serialize.ts`) writes a `\n` as a literal
  newline under `xml:space="preserve"`, which SVG draws as a space (by the spec; not checked in a
  browser), where the importer already reads a `<tspan x dy>` per line (`LineTracker`). Undecided:
  browsers ignore an empty `<tspan dy>`, so a blank line either folds into the next line's `dy`
  and reads back as an uneven pitch, or is lost; and a styled run spanning a break comes back as
  two runs.

- **(P3) The animation wrappers have no canvas seat.** `animateOnSetPose` and `animateLifecycle`
  wrap an adapter the caller holds. `<SceneCanvas>` builds its own and takes neither, so nothing a
  tool writes is animated; `apps/site/demos/AnimationDemo.tsx` wraps `useSceneAdapter(scene)` and
  its buttons write through that. Wrapping the canvas's adapter would animate every op applied
  through it, a drag's release, a resize, and an undo among them (read from `applyOps` in
  `canvas/sceneAdapter.ts`, which hands each op the adapter it was called on; not run), so the
  seat has to say which of those glide. It would still miss a button's `scene.setPose`, which
  reaches no adapter: animating that needs the scene to report the write, as `onReflow` reports
  a settle.

- **(P3) draw: two owners for "is a text edit open".** The kit's `useSceneTextEdit` holds
  `editingId`; the app's mode machine (`apps/draw/src/modality/machine.ts`) holds a `text-edit` mode
  that says the same thing. Two effects with `prev` refs in `apps/draw/src/useTextEditSession.ts` reconcile
  them in each direction, and their comments record two shipped bugs from the split. Text cannot take the
  shape path editing has (`<SceneCanvas pathEdit>` reading the open path from the machine,
  `modality/pathEditHost.ts`) as it stands, because the session is real state inside the hook (the
  overlay, the caret, the pending commit): the hook needs an `onEnd` for the ends it decides itself
  (click-away, the node going away), and its `onDoubleClick` has to hand the hit and the caret seed
  to the machine instead of starting the edit. A double-click on a path is still acted on by both
  the kit's `enterPathEdit` binding and the app's `onDoubleClick` observer; they reach the same
  machine call and the second is a no-op. `apps/draw/src/App.browser.test.tsx` drives both modes
  through the machine in a browser, and fails when either effect is removed.

  The two states can also disagree outright: the text tool's `enterTextEdit` binding and a newly
  inserted text node both start an edit through the `textEdit` dep, which never enters the mode,
  so an edit is open while the machine says `normal` (read from `TextEditDepPublisher.tsx`, not
  driven in a browser).

  Not ruled, and it is one question with "Nothing reads a mode's `entry.trigger`" under Tools:
  which side owns the open edit? Either `useSceneTextEdit` takes a host the way the canvas takes
  `pathEdit` (`editingId()` and `setEditingId(id, { caret })`, so every way in enters the mode and
  every end leaves it, and the kit binds `'double-click-target'` once for paths, groups, and text,
  which needs a mode definition to say which hits it takes), or the hook stays the owner and
  reports `onStart` / `onEnd`, with the mode following it and the trigger staying unread.

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
  Every compiler rule with no reports is on, as are `set-state-in-effect` and
  `preserve-manual-memoization`. Two are off, with the rationale in `eslint.config.js`, counted on
  2026-10-12:
  - `refs` — 408 reports in 83 files; reading a ref during render is how a
    canvas library reaches frame state, and there is no writes-only mode
    (`weasel/no-render-ref-write` covers writes).
  - `immutability` — 51 reports in 37 files, 26 of them in tests that assign to
    a prop or an outer variable from inside a probe component. The rest are
    `useVisibleRaf` loops re-requesting themselves, and writes to forwarded
    refs, DOM nodes, and mutable engine objects.

---

## Release-gate & build hygiene

- **(P3) `foldTwisty.browser.test.tsx` fails on one machine and passes on the fleet.** "sets the
  title of a panel with a hidden twisty where a panel that does not fold has it" measured the
  title 3px higher with the twisty (`top: 12` against `15`) on brainhouse on 2026-10-13, with and
  without that day's changes, and passed in three fleet runs on teitou the same day. Not looked
  into: which of the two machines draws the header the way a reader's browser does.

- **(P3) A release whose notes for one package pass 125,000 characters fails after it has
  published.** `changesets/action` writes a GitHub release per package with that package's
  changelog section as the body, and GitHub refuses a longer one. 1.10.0's core section was 135,412
  characters: every package was already on its way to npm and tagged, the step then failed, and the
  registry check and the registry smoke test after it never ran. Its release was made by hand with
  the notes cut short and a link to the changelog. Either the release step cuts a long body the
  same way, or the two checks run whether or not that step failed.

- **(P2) Confirm on a fleet node that a new dependency in browser-tested code no longer fails the
  first run that meets it.** A node keeps its vite dep cache between runs, and a warm cache skips
  the scan that finds dependencies, so one first imported since then was met mid-run and vite
  reloaded the page under the suites ("Vitest failed to find the runner", 12 suites on 2026-10-13).
  The `browser` project's `optimizeDeps.include` is now computed from what its tests import
  (`scripts/vitest-browser-deps.ts`), and vite keys the cache on that list, so a new import
  discards the cache before a test loads. Tested against vite alone; not yet run on a node with a
  stale cache. To confirm: on a node that has run the suite, start a fleet run of a commit that
  adds an import of an installed, not yet imported dependency to a module a browser test loads.
  The log should read "Re-optimizing dependencies because vite config has changed" and no suite
  should fail to find the runner. Two things it does not cover: a dependency reached only through
  `import.meta.glob` or a computed `import()`, and the opt-in `forge-stories` project, which has
  no such list.

- **(P3) `onto test --spread` fails a run whose tree moved, where the other commands sync again.**
  onto `f621d8b` makes a launch carry the stamp its own sync was answered with, so a suite can no
  longer start in a tree another session synced; `scripts/fleet-tree.gate.ts` stays as the check
  on this side. `--spread` calls `prepare()` once and runs its shards outside the retry, since
  retrying would rerun groups already finished. The fix reaches a machine when its `onto` binary
  is rebuilt, and a node's agent refuses a launch against a tree that lost its stamp only after
  `onto push <node>`.

- **(P2) Browser tests time out under fleet load, inside a Playwright action.** A click, a key, or
  a screenshot that takes a fraction of a second alone stalls for seconds in a full run on studio,
  teitou, or msb-uai, a different handful of tests each run, and the test hits its 15 s limit or
  the action's own. Every one passes alone, and nobody has confirmed load is the cause. Two stalls
  were timed: 14.5 s in `userEvent.click` after the row was found and scrolled to
  (`PrefSchemaEditor.types.browser.test.tsx`, 0.3 s alone), and 7.8 s in `page.screenshot` waiting
  for a `position: fixed` element that never moves to be stable
  (`core/src/features/text/overlayAlignment.browser.test.tsx`, "sans-serif 16px lands on the canvas
  glyphs").
  - **Still exposed**, because the action is what the test is about and nothing in it sleeps or
    animates: `overlayAlignment` (a screenshot a test, 0.55 s each alone),
    `labkit/src/lightbox/Lightbox.browser.test.tsx`,
    `SelectionPanel/SelectionPanel.selection.browser.test.tsx`,
    `PatternPicker/PatternPicker.browser.test.tsx`, and the full-page screenshot in
    `labkit/src/lab/LabLightbox.browser.test.tsx`.
  - **Changed on 2026-10-13, none of it confirmed by a fleet run.** `PrefSchemaEditor.types`,
    `labkit/src/controls/compoundRows.browser.test.tsx`, and `LabLightbox`'s toolbar buttons click
    through the DOM, since the click is not what they test; `compoundRows` is one test a dialog and
    no longer waits for each to close. Testing Library's `waitFor` and `findBy*` wait 5 s in the
    `browser` project, as `expect.poll` already did; they waited 1 s, in `LabLightbox` and in
    `forge/src/timeline/timeline.browser.test.tsx` ("plays on real frames") among others. Two
    timeouts were raised for tests that do the work: the sweeps in
    `Prefs/PrefsForm.drop.browser.test.tsx` take 3.1 to 3.6 s each alone and have 60 s, and
    `AssetEditor.steps.test.tsx`, a jsdom test that timed out at 5 s, takes 0.9 to 1.4 s alone and
    has 20 s.
  - **Running `browser` after the other projects** (`sequence.groupOrder` in `vitest.config.ts`),
    measured 2026-10-12 over nine full runs at one commit, three on each node: none of six runs
    had a timeout, and one of three baseline runs did (`overlayAlignment`, on studio). That is
    suggestive and no more: at a one in three rate six clean runs come up about 9% of the time. It
    cost 12 to 52 s a run on teitou and msb-uai and nothing on studio, which takes about 175 s
    either way against 100 to 115 s on the others and hosts a long-running render service; both
    failing runs were there. A 15 s `browser` timeout in a run made since would mean running beside
    the other projects was not the cause, and the `groupOrder` line should come out. Not measured:
    fewer workers for `browser`, and whether studio's own load is the cause.
  - `forge/src/vite/plugin.test.ts` has its own entry under "Demos & visual regression".

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
    matrix around a gradient, or around an image when it does more than scale channels down. A solid or a glyph under a color matrix has its color
    mapped on the CPU (`draw/foldColor.ts`), which paints the same pixel as the shader in headless
    Chromium (`colorMatrixFold.browser.test.ts`) and has not been timed. The specs that break a run
    with a matrix on solid rects (`flush-anatomy`, `clip-cost`, `flush-noise`) turn the mapping off
    through `colorFolding`, and have not been run since that edit. An image under a matrix that only
    scales channels, each by 0 to 1, now rides its vertices the same way (`textureTint`), checked
    against the shader's pixel in `colorMatrixFold.browser.test.ts` and not timed;
    `image-quad.spec.ts`'s `unmerged` frame broke its runs with such a matrix, so it now uses a bias,
    and has not been run since.
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

- **(P3) Five leaf packages keep their own listener sets.** Every other store notifies through
  `createEmitter()` in `@weasel-js/registry` (a pass walks the listeners held when it began; a
  throwing listener is logged and the rest run). These still hold a `Set` and a loop, because each
  is in a package that depends on nothing else in weasel, and the move would give it its first
  sibling dependency: history and its journal, `select/store.ts`, storage's records (two sets),
  cursor's `paintedCursorState`, and react's `useFrameClock`. A throw from one of their listeners
  still reaches whatever caused the notify. Moving them means either that dependency or the
  emitter living somewhere all five can reach.

- **(P3) `SceneCanvasInner` is one 388-line function.** It is most of the 510-line
  `canvas/SceneCanvas.tsx`. What is left in it is the prop destructure and the JSX, most of that
  the props of `StandardActionsRegistrar` and `GestureDispatcherMounter`; getting under the cap
  means turning those mounters into hooks, the audit's section E, which also removes
  `getActionRef` and `actionsRegistryRef`. `docs/audits/2026-10-12-SceneCanvas.md` lists what belongs to another
  owner; its dead-code pass and its sections on the built-in tool registry, the preset table, the
  chrome-caps rule context, path editing, selection, ingestion, the device profile, the camera, the
  layer slots, and the redraw subscriptions have landed. `canvas/Canvas.tsx` is 742 lines, 443 of them `CanvasInner`,
  after its scene-layer construction, its dev HUDs, and its camera moved to SceneCanvas. Left open by the preset table and the rule context, and described in the audit:
  `selectTool.rotate === false` is still decided in three places that do not agree, and making
  them one changes behavior three ways the audit lists, each needing a decision. Left open by the selection pass: the kind label published with the selection and the routing
  kind disagree on every node, and `SelectionPanel` has a third classifier; the command palette's
  summary prints the label, so making them one needs a decision on what it should say.
