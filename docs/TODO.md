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
  bundling one domain's primitives, and `docs/taxonomy.md` calls each of those a "feature" too. The
  two are unrelated and both names stand for now, with the taxonomy saying so. Ruled 2026-10-11: the
  directory and the taxonomy's term take a new word, and the prop keeps `features`; the new word is
  not chosen yet. That leaves choosing it, then renaming the one path, its imports, and the section
  of the taxonomy.

- **(P3) apps/draw enters most modes by double-click only.** Path-edit's `Enter` is bound
  (`apps/draw/src/modality/shortcuts.ts`); the other modes with an `entry` shortcut, free-transform
  and crop, are not, since nothing says what target each would take from the selection. Draw also
  still enters every mode from `SceneCanvas`'s `onDoubleClick` observer rather than from
  `entry.trigger`, which nothing reads.
- **(P3) External-content ingestion — follow-ups.** The pipeline is in
  `packages/core/src/features/ingestion/` (its README is the map). Left:
  (a) drag-over feedback. A canvas now accepts a drag only when a `drop` binding would take what
  it carries, and shows `weasel-dropover` then. Still missing: asking the content handlers, so a
  drag no handler would claim is refused, and an insertion ghost under the pointer. Both belong in
  the `ingest` action (`interactions/actions/defaults/ingest.ts`), which gives prediction nothing
  to ask yet.
  (b) `kitTextHandler` turns pasted or dropped plain text into a text node sized to the string,
  and is exported but registered nowhere: a canvas opts in with `ingestion={{ handlers:
  [kitTextHandler] }}`. Whether `ingest` canvases should take text by default, and whether
  weaseldraw should, is undecided. The node gets the default text style, since the `insert` dep's
  `text` kind carries a string and nothing else.

- **(P3) The image and SVG drop handlers could leave core.** `kitImageHandler`
  / `embedFilesAsImageNodes`, `kitSvgHandler` (which reuses the image embed) and
  `openFilePicker` in `packages/core/src/features/ingestion/` are about 310 lines
  no kernel path needs; the registry, the `ingest` action, the `ingestion` dep
  and the weasel-JSON handler stay, since Cmd+V of the canvas's own content runs
  through them. Moving them makes a file drop do nothing on a bare
  `<SceneCanvas>` until the consumer installs the handlers. Left in place for now
  (ruled 2026-10-11). If they do move, the package is `images`; `ingest` was
  turned down.

- **(P3) The action pipeline's coordinates are 2D, so another kernel can't
  reuse it.** World points arrive as `{x, y}` or flat scalars in
  `InvocationCtx`, the dep payloads, the pick functions and
  `@weasel-js/gestures`' pointer events, and the camera is the 2D `View`. Tools
  themselves carry no geometry. **No longer a Phase 2 prerequisite**: the 3D lab
  (`packages/labkit/examples/3d-lab`) drives core's dispatcher over a WebGL
  viewport with core unchanged, because the deps rebuild the ray from a camera
  they close over and the pipeline keeps passing two numbers. What is left is
  ordinary type hygiene, not a blocker. Findings in
  `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`.

- **(P3) `apps/theme-editor` cannot become a `<Lab>` without being rebuilt.**
  Not a stale consumer: `<Lab>` is the trial runtime — it requires a non-empty
  `instruments` list, seeds a trial, and renders `children` into the header
  while its body is fixed as the surface buffers plus a `Workspace` of trials.
  PaletteLab's page *is* the shell body, flexing to fill `.lk-shell-body`, and
  the `#/theme` workbench beside it is a second bare `LabShell` page. Moving
  them in means making each an instrument and running it in a trial pane, with
  labkit's per-trial store and persistence beside its own, and a trial
  titlebar beside its own `PropertyPanel`. Worth doing only as its
  own arc, and worth asking first whether labkit should support a lab with no
  trials at all.

- **(P3) One dep still names a plane, not ten.** The count came from reading
  signatures for 2D-looking types; read for what a camera-bearing host can
  actually implement, the ten are: `geometryProjection` alone, whose
  `transform(node, m: Mat3)` has no 3D form (its own entry below, and core
  builds the `Mat3` at four call sites before the dep is consulted, so widening
  the type does not free it). `view` is not an obstruction but the design —
  viewport deps are per-kernel, and `kernel3d` declares `camera3d`.
  `editAnchors` and `booleansAdapter` are 2D *features* — anchor editing and
  path booleans — that a 3D kernel simply does not declare. The remaining six —
  `snap`, `lassoSelect`, `poseDescriptor`, `slice`, `ingestion`, `pointer` — are
  satisfiable as typed, because every coordinate in them is a screen point
  under the identity `clientToWorld` a 3D host passes. Re-measured 2026-09-13,
  dep by dep; `pointer` was removed 2026-09-18 and came back 2026-09-25 as the
  pointer store (a world `{ worldX, worldY, viewId }`), and has not been
  re-measured since.

  The routing package itself declares `View` in `tools/types.ts` (`ToolCtx`) and
  in its barrel. `RuleCtx` no longer does: it carries `zoom?: number`, so a host
  whose viewport is a camera can supply eligibility instead of leaving
  `getRuleCtx` unset and silently skipping every rule — which is what the 3D lab
  was doing. What is left is `ToolCtx`, and only `<Canvas>` ever builds one.
  `Point2` is orientation-free, and none of `dispatcher.ts`, `matcher.ts`,
  `invoker.ts`, `action.ts`, `buildDeps.ts` or `depRegistry.tsx` names a 2D type
  at all.

- **(P3) `geometryProjection` cannot hold a 3D transform.** `transform(node,
  m: Mat3)` names a plane in its signature, so a kernel with a camera has
  nothing to implement it with. `PoseDescriptor`, which was the same complaint,
  is closed: `forNode` hands it the node, and `remapBounds`/`fromBounds` resolve
  a screen rectangle at the pose's own depth (2026-09-13) rather than throwing.
  Whatever replaces `Mat3` here is the remaining piece of that family.

- **(P3) `cloneByAltDrag` and the `CloneBehavior` contract are unreachable.** `cloneAction.start`
  ignores `opts`, so no clone behavior ever runs, and the hook that consumed `CloneBehavior` is
  gone. `cloneByAltDrag` is still exported from `@weasel-js/core`. Either run behaviors in
  `cloneAction` the way move, rotate, and insert do, or remove the behavior and the type.

- **(P3) `GestureContext.pointer.clientX` / `clientY` are always 0.** Every default action fills
  them with a literal, so a behavior reading them gets a plausible wrong answer. Remove the fields
  from `PointerState`, or carry the client point through `InvocationCtx`.

- **(P3) Long-press: the native `contextmenu` a touch hold sends is unseen on a real device.**
  `useGestureDispatcher` now treats a `contextmenu` that arrives while a touch or pen hold is in
  progress as that hold's long-press: it fires the pending one early, or is dropped if the
  long-press already ran, so a `contextMenu` binding runs once. Tested in jsdom with a hand-sent
  event (`useGestureDispatcher.nativeLongPress.test.tsx`). Left: hold a finger on a canvas with a
  `contextMenu` binding in Android Chrome and confirm one menu, and that the event really arrives
  while the pointer is still held rather than after a `pointercancel`.

- **(P3) AltGr matching is unchecked in a real browser.** A key typed with AltGr now matches a
  binding for its character: the keyboard channel
  (`packages/routing/src/interactions/dispatcher/channels/keyboard.ts`) dispatches the chord as
  reported, and when nothing takes it and `getModifierState('AltGraph')` holds, dispatches again
  without Ctrl and Alt. Only jsdom has seen it. Left to check on Windows, with a layout that has
  AltGr: that Chrome and Firefox both report AltGraph for it, and that a plain Ctrl+Alt+letter, for
  which Firefox reports AltGraph too, is still read as a chord.

- **(P3) The pointer channel is still one closure.**
  `packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx` (about 1,170 lines) keeps
  pointer and multitouch synthesis, click and double-click, long-press, the hover-cursor pump, and
  tool lifecycle in one effect; keyboard, wheel, WebKit pinch, contextmenu, and drop and paste each
  moved to `channels/` around `DispatchCore`. Those that remain share the held-pointer map and the
  last hover position, so splitting them means deciding who owns each. `dispatcher.ts` (about 1,020
  lines) is down to `createDispatcher`: per-kind context building, the walk, and UI-driven handles,
  which share its in-flight maps.


### Cursor package follow-ups

All four arcs of `docs/superpowers/specs/2026-09-03-cursor-system-design.md`
have shipped. What remains:

- **(P3) Cursor rasterization is unmeasured in Safari.** Chrome and headed
  Firefox are measured (spec, "Measured browser behavior"); the baker's plain
  SVG `url()` is right for both. `node probe.mjs <dir> --browser safari` in
  `packages/cursor/scripts/probe/` is the instrument, and on studio on
  2026-09-30 it could not be trusted: its first run drew the arrow control
  and then the crosshair for every case after it, and every later run drew
  the crosshair even for the arrow — with the page frontmost, over HTTP
  (`--page http`) as well as `data:`, stepping by reload as well as by hash.
  Safari's cursor is not following the page under this driver, and why is
  the open question. A finding lands in `bake.ts`.

---

## Viewport

- **(P3) A controlled consumer's own `setState` cannot interrupt a glide.**
  Every view write that goes through the canvas cancels the camera runner, via
  the `onViewChange` it fires on both branches. A consumer who owns `view` in
  state and writes it directly does not go through the canvas: the prop change
  arrives asynchronously, after the runner has lowered the flag that
  distinguishes its own frames, so it is indistinguishable from one. Comparing
  the incoming prop against the last value written would work only for
  consumers who store the view by reference — one who normalizes or clamps it
  would have every frame of their own glide cancelled. Wants a real design.

- **(P3) Views do not nest.** A view paints and routes the surface's own stack,
  never another view, and a loupe magnifies the canvas's camera — aimed over a
  `<CanvasView>` panel it shows and edits the canvas's world, not the panel's.
  Composing would mean a view's camera derived from the view under its aim, and
  a resolver that descends rather than picking one rect.

- **(P2) `renderDebugSnapshot`: a y-up view throws.** A canvas with `view.scale.y < 0` (valid per
  `core/viewport/view.ts`) reaches `planPixelRender` with a negative `sourceRect.height` and
  `scale.y`, which throws "sourceRect.height must be a positive finite number"
  (`packages/core/src/canvas/renderDebugSnapshot.ts`, `renderSceneToPixels.ts`). So a flipped scene
  cannot be rasterized headlessly. Options: let `planPixelRender` take a signed scale (size from the
  magnitude, the view keeps the sign and offsets its origin), which changes `renderSceneToPixels`'s
  contract, or keep the limit and say so in both docs.

- **(P3) Canvas hosts: the renderer writes inline `width` and `height` style on a `<canvas>` it
  owns.** `WeaselRenderer`'s constructor and `resize` set `canvas.style.width`/`height`, so a
  `<SceneViewCanvas className>` or `<DrawCanvas className>` that sizes the element (`width: 100%`)
  loses to the inline style after the first paint. The docs now say so. Ruled 2026-10-11: the
  renderer sets only the canvas's backing-store size, and every host sizes its element by class.
  That leaves dropping both style writes, checking every host for a layout that depends on them, and
  taking the caveat back out of the docs.

- **(P3) Scene layer list: `<Canvas>` learns of a layer change by polling at paint.**
  `useSceneLayerList` (`packages/core/src/canvas/useSceneLayerList.ts`) re-reads
  `adapter.getLayers()` on every paint and queues a render when the ids differ, because the adapter
  contract has no layer-list subscription. That costs one skipped frame per change. If
  `CanvasAdapter` gains a layer-list version or subscription, key the layer memo on that and drop
  the poll.

---

## Paths & booleans

- **(P3) a pose's `transform` is drawn, picked, and edited as a path, and the selection chrome and
  the resize and rotate handles do not read it.** A box pose may carry a `transform` (`PoseLinear`,
  `packages/geom/src/poseFrame.ts`): the skew or per-axis scale its box and rotation
  cannot hold, which is how svg import keeps `<text transform="scale(4 1)">` as editable text four
  times as wide. `poseFrameOf` composes it with the rotation, and the render wrap, culling,
  silhouettes, `axisAlignedBounds` / `unionAABB` / `visualBoundsViaDescriptor`, point and region
  picking, `pathInWorld` / `worldEditToStorage`, `textToPath`, slicing, and flipping all go through
  it. Ruled 2026-10-11: text and image nodes carry a full transform, and such text stays editable
  text. These readers still see only the box and its rotation, so for such a node each acts on the
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

- **(P2) geom: whether an open subpath fills is answered three ways.** For `<polyline points="0,0
  100,0 100,100" fill="red"/>` (no `Z`), `tessellate` (`packages/geom/src/tessellate/tessellate.ts`)
  triangulates the closed triangle and `pathSignedArea` (`paths/winding.ts`) counts it as closed
  "the way a fill closes it", while `pointInPath` (`pathHitTest.ts`, `flatSubpaths`) files the run
  under `open` and returns false, and `path.ts` documents that open subpaths "don't contribute to
  fills". So the triangle paints and cannot be clicked. The options are SVG's rule (a fill closes
  every subpath implicitly), which means `flatSubpaths` treats an open run of three or more points
  as closed for the fill test and `path.ts` says so; or the kit rule (open never fills), which means
  `tessellate` skips open contours and `pathSignedArea` returns 0 for them, and SVG import has to
  close filled open shapes itself. SVG's rule cannot land in `pointInPath` alone: `containsInFrame`
  (`packages/core/src/canvas/SceneCanvas/poseGeometry.ts`) calls it without knowing whether the
  node has a fill, so every unfilled open stroke would become pickable across the area its ends
  enclose.

- **(P3) WeaselDraw: an imported clipped group is clipped to the clip's box, not its outline.**
  `svgNodesToKitDrafts` now gives a `<g clip-path>` container the clip as its `data`, an unpainted
  path the scene clips to, and `unpackSvgFiles` and `svgNodesFromKit` carry it both ways.
  `svgNodesToSceneDrafts` (`apps/draw/src/svgInterop.ts`) passes that `data` on, but the import in
  `apps/draw/src/Toolbar.tsx` still adds every container with `data: {}`; it has to add
  `draft.data`. Nothing has drawn a clipped import in a browser yet.

- **(P3) svg import: `<tspan>` glyph positioning is not read.** A `<tspan>` with its own `x` and
  a `dy` or new `y` starts a line (`packages/svg/src/tspanLines.ts`), and the pitch the lines state
  is read as the node's `lineHeight`. `dx`, `rotate`, and list-valued per-glyph `x` / `y` are not
  applied; each warns, on `<text>` and `<tspan>` alike. Kerned text exported as one `<tspan>` per
  glyph run imports with the glyphs run together: turning a positioned run into a letter spacing or
  a space needs the advance of the glyphs before it, which a parse with no face loaded cannot
  measure. `serializeSvg` writes no line height either, so a pitch read on import is dropped on
  export unless a caller carries it, as WeaselDraw does in `wd:line-height`.

- **(P3) svg import: a dropped file's hidden content is still left out.** `parseSvg(svg, {
  keepHidden: true })` keeps `display="none"` and `visibility="hidden"` content, each node marked
  `hidden`, and `svgNodesToKitDrafts` carries the flag onto its drafts. `unpackSvgFiles` does not
  ask for it, because a scene node has no hidden state of its own to map it to: only a layer has
  `visible`. With a per-node one, `unpackSvgFiles` passes `keepHidden` and writes the flag.

### Pathfinder follow-ups (post-v1)

Core five + Crop shipped. Remaining:

- **(P3) Create Outlines refuses synthetic-bold text.** `textToPath` answers `reason: 'synthetic-bold'`: emboldening it is a union with the glyphs' own outline stroke, but the width has to match what the renderer's distance-field shift (`SYNTH_BOLD_AMOUNT`) draws, and that mapping to em units is not worked out.
- **(P3) Outline Stroke passes over text.** `applyOutlineStroke` reads path nodes only, so stroked text has to go through Create Outlines first. `textToPathsByPaint` already gives each paint's glyphs with their stroke.
- **(P3) Trim and Merge are not Boolean operations yet.** The geometry exists: `pathTrim` and `pathMerge` (`@weasel-js/geom/booleans`) return each piece with the inputs it came from, and Merge takes the key that says which inputs wear the same paint. The adapter answers each operand's paint (`BooleansAdapter.getPaint`) and takes the paint a result must wear (`createPathNode`'s `paint`). What is left is `'trim'` and `'merge'` in `BooleanOp` and `applyBooleanOp`, which give each result its own source's paint where it passes one for all of them, and their actions and menu entries.
- **(P3) Divide and Crop paint every piece like the topmost source.** `applyBooleanOp` hands `createPathNode` one `sourceId`, the topmost, for every result, so a Crop's pieces take the mask's paint and its parent, not their own source's. `pathDividePieces` and `pathCropPieces` (`@weasel-js/geom/booleans`) now say which inputs each piece came from; `applyBooleanOp` still calls `pathDivide` and `pathCrop` and has to pass each piece's last source instead.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** v1 flattens beziers before clipping; the result is straight-line. Skia/PathKit-style curve-preserving booleans are next-level — substantially harder.
- **(P3) Live preview during the gesture.** Holding the op key while hovering a path to see the result before committing.
- **(P3) Booleans measure a `{ px }` stroke at the view's mean scale, and ignore a skewed pose.** `resolveOperand` and `applyOutlineStroke` call `strokeToPath` on the world path with one `scale`, so a stroke drawn under `RectPose.transform` or a non-uniform view is outlined as though it were not. `strokeToPath` now takes the `frame` a stroke is drawn in and stretches the outline with it; what is left is the two callers passing the node's `poseFrameOf`, or the screen's frame for a `{ px }` width, which `BooleansAdapter` and `CreateOutlinesAdapter` have no way to hand them yet.

---

## Rendering & paint

- **(P3) Pattern fills: what the tile picker left open.** The texture half of
  fill-mode expansion shipped 2026-08-12 — patterns tile, carry a serializable
  `TilePatternSpec`, round-trip through SVG `<pattern>`, and have a picker in
  WeaselDraw. What it deliberately did not do:

  - **Image-upload patterns.** The picker covers the four built-in tiles only.
    A user-supplied bitmap needs a payload variant that persists the image
    itself (data URI, or a document-scoped asset table), which is a storage
    question rather than a paint one.

  The gradient half's own gap is closed: a conic gradient serializes as a
  `<wzl:conicGradient>` def in `urn:weasel-js:svg` and reads back losslessly,
  and every reference to a paint SVG cannot express carries SVG's own paint
  fallback color so an unresolvable one paints flat. See
  `docs/proposals/2026-09-17-paint-kinds-beyond-svg.md` for what a richer kind
  writes inside that envelope.

- **(P3) No marker icons.** `defaultNodeProperties`'s `markerStart` /
  `markerMid` / `markerEnd` leaves use a labelled `select`, where the sibling
  stroke enums (`cap`, `join`, `align`, `dash`) are icon toggles — authoring
  eight glyphs to this repo's icon standard is its own piece of work and was
  deferred out of the stroke-markers arc.

- **(P2) Renderer: a translucent `ImageBitmap` is multiplied by its alpha twice.** A
  half-transparent white bitmap drawn with an image command onto a cleared canvas reads back as
  `(64, 64, 64, 128)` in headless Chromium where `(128, 128, 128, 128)` is correct, whether the
  bitmap came from `ImageData`, a PNG blob, or a canvas. Every PNG with soft edges shows a dark
  fringe. `createImageBitmap` with no options holds premultiplied pixels and `texImage2D` uploads
  them as they are, while `GLImageCache` and the batch shader
  (`packages/renderer/src/shaders/batchFill.ts`, `vec4(mapped.rgb * a, a)`) assume straight
  texels. A pattern texture registered from an `ImageBitmap` goes through `GLTextureCache` the same
  way, and an `HTMLImageElement` source uploads straight, so the two source types disagree. Two ways
  out: create every kit bitmap with `{ premultiplyAlpha: 'none' }` (`renderer/images/imageCache.ts`,
  `features/ingestion/imageHandler.ts`, the loupe) and document that requirement on
  `ImageDrawCommand.image`, which leaves a consumer's default bitmap wrong; or make image textures
  premultiplied by convention, set `UNPACK_PREMULTIPLY_ALPHA_WEBGL` for the non-bitmap sources, and
  have the shader unpremultiply before the color matrix, which fixes every source and filters better
  at edges.

- **(P3) Renderer: geometry and paint space far from the origin are still single precision.** The
  transform stack is in doubles now and a large model translation is rebased before upload
  (`setProjAndModel`, `u_origin`), so panning at world x = 262,144 and 64x zoom steps by fractions of
  a pixel; that is proven by float32 arithmetic in `draw.precision.test.ts`, not in a browser. Not
  measured, and still float32: a path's own coordinates (`PolygonPath.coords`, `Mesh.vertices`),
  which at that distance sit on a 1/32 world unit grid, 2 px at 64x, so a tessellated shape is
  quantized where a batched rect (doubles) is not; `u_worldInv`, which places a `units: 'world'`
  gradient or pattern per fragment from a world-sized translation; and the model a consumer's own
  vertex stage receives (`u_view` on a shader command, `u_model` in a registered paint kind), which
  has no `u_origin` to rebase against. The first needs a per-path origin in `@weasel-js/geom`'s
  tessellation, the second the same rebase applied to the paint matrix.

---

## Text

- **(P3) The edit overlay's text lands on whole CSS pixels; the canvas's does
  not.** Every tier now hangs its baseline where CSS does, so the overlay's
  measured `baselineDrop` is only rounding, but the overlay still cannot
  follow a fractional canvas baseline: moving its `top` by 0.4px moved its
  ink by exactly 1px in Chromium at DPR 1, and the matrix rows show the same
  jump in WebKit, Firefox and at DPR 2. On top of that sits a steady ink bias,
  overlay above canvas, of about -0.35px at DPR 1 and -0.17px at DPR 2
  (derived from Chromium's rows), of unknown origin. Together they are the whole of
  `dy` in `scripts/measure-overlay-alignment.config.ts` (mean |dy| about
  0.2px, max 0.75), and why `overlayAlignment.browser.test.tsx` allows
  `DY_TOLERANCE = 0.85`. Candidates: carry the fraction on a transform, snap
  the canvas's text baseline to device pixels as browsers do, or find the
  bias first. Recorded 2026-09-29.

- **(P3) WebKit at DPR 1 fails one overlay-alignment case, because it paints
  text on whole pixels.** `"Hgd" Inter 72px small caps` reports `dRight -0.79`
  against the 0.75 bound in `npx vitest run -c
  scripts/measure-overlay-alignment.config.ts`; Chromium and Firefox pass it at
  both DPRs, and so does WebKit at DPR 2. CI runs Chromium only, so nothing gates
  on it. It is not advances, small-caps synthesis or `text-rendering`: WebKit's
  DOM width of `GDGDGDGDGD` matches the atlas to 0.001px at 54.024px (the
  small-caps size) under both `geometricPrecision` and `auto`, and turning off
  `font-variant`, kerning or `geometricPrecision` on the overlay moves no pixel.
  What differs is where a text box starts painting. The small capitals sit in
  their own span, which starts at x 73.5; WebKit paints it from 73, so `G` and
  `D` land 0.44 and 0.69px left of the canvas's. Moving the overlay right by
  `f` (0 to 0.875 in eighths) moves WebKit's `H` ink by `-f` at DPR 1 and by
  `-(f mod 0.5)` at DPR 2, so a box's paint origin is floored to the
  device-pixel grid; Chromium's `H` stays within 0.08px throughout. Not
  compensable from the overlay as far as measured: a WebKit-only half-device-
  pixel `translate` (floor into round) fixes this case but moves WebKit DPR 1's
  matrix mean `dx` from -0.14 to +0.36 and fails three other cases, and a
  0.492px nudge on the small-caps span alone moved `D` a whole pixel and `G`
  not at all — WebKit picks a pixel either way. Measured 2026-10-07 on macOS
  (Playwright WebKit).

- **(P3) The character strip has no "no fill" chip.** WeaselDraw's text objects carry `fill: null`
  through its SVG export and import, and the sidebar's Fill leaf already offers None for a text
  node. What is missing is a None chip beside the strip's Color field. Ruled 2026-10-11: a run can
  carry no fill, so the chip unfills only the selected range. A run now holds `fill: null` through
  `resolveRuns`, the range algebra, the edit overlay, and SVG, so the chip is all that is left: a
  control that sends `{ fill: null }` through `CharacterOptions`' `onPatch`, and a reading of a
  `null` range fill (and of an unfilled node, which `effectiveRangeStyle` reports as an absent
  `fill`) that lights it. It wants looking at on screen.

- **(P3) At 12px with a script, the atlas tier's ink still sits ~0.55px off
  the overlay's at DPR 1, and the sign follows the sub-pixel phase.** `dx` is
  −0.5 at `x` 20 and +0.5 at 20.5 in every engine; DPR 2 agrees within 0.06.
  The stems of a 7.2px `H` are ~0.65px wide, and the shader reads coverage from
  the distance at each pixel's center, so a stem centered on a pixel carries
  about twice the ink of one straddling two, and the centroid leans toward
  whichever stem is on the grid. Center-sampled coverage cannot do better; area
  coverage would need several field taps per fragment on small glyphs. The same
  rows show `dy` of ±0.45, which predates this and is unexplained. The
  `super`/`sub` 12px rows of `npx vitest run -c
  scripts/measure-overlay-alignment.config.ts` show both.

- **(P3) Complex-script text shaping (HarfBuzz).** `packages/text/src/layout/layoutRuns.ts` walks codepoints linearly and applies BmFont kerning pairs — sufficient for Latin / Cyrillic / Greek / CJK ideographs, wrong for Arabic / Devanagari / Thai / any script needing contextual shaping. Real fix is wiring a HarfBuzz WASM build (harfbuzzjs ~1MB) behind a feature flag so consumers who only need Latin can stay slim. Touches the layout pipeline only; the renderer already takes pre-laid glyphs. Shaping is also what real small caps needs: `fontVariantCaps: 'small-caps'` is synthesized today (capitals scaled by x-height over cap height), and a face with an `smcp` feature should get its own small-cap glyphs instead.

- **(P3) `markdownToRuns` → AST.** Consider whether markdown markup (today `*`/`**`/`***` bold/italic toggles, parsed with flat boolean state in `packages/text/src/runs.ts`) should be promoted to a structured AST. The output is a flat `StyledRun[]`, not a tree. Defer to a future "rich text" pass — the current shape is sufficient for label/markdown rendering but limits reformatting / re-styling transforms.

- **(P3) Text edit: an edit that changes text ending in a newline drops that newline.**
  `trimCaretHolder` (`packages/core/src/features/text/useTextEdit.ts`) removes one trailing `\n` on
  the assumption the browser added it as the caret's holder, so a node whose text is `"abc\n"`
  becomes `"xabc"` when an `x` is typed at its start. An edit that changes nothing writes nothing,
  so open-and-close is safe. Whether a browser adds a holder to seeded text that already ends in
  `\n` has not been observed, and the fix turns on it.

- **(P3) Text edit: typed text is inserted by hand in `beforeinput`.** Every `insertText` is
  `preventDefault`-ed and inserted at the window selection
  (`packages/core/src/features/text/useTextEdit.ts`, `onBeforeInput`). No `input` event follows, so
  the `onInput` re-place that keeps a center- or bottom-aligned overlay from jumping a frame late
  runs only for paste and delete. Two further effects are inferred and not observed in a browser:
  input carrying its own target range (macOS double-space period, text replacement) would land at
  the caret, and typing would not be on the native undo stack. The alternative is to intercept only
  while a pending style is armed and normalize in `onInput` otherwise.

- **(P3) Text edit: a paste lands in the overlay as whatever markup the browser inserts.**
  `useTextEdit` has no `paste` handler. `domToRuns` and the caret-offset walkers
  (`packages/core/src/features/text/domOffsets.ts`) now agree on `<br>`, `<div>`, and `<p>`, so a
  pasted break reads as one newline and offsets hold after it, but other pasted structure (lists,
  tables, nested blocks) is still read ad hoc. Undecided: insert `text/plain` only, or sanitize the
  pasted markup to run spans and keep its styling. Which elements each browser inserts on paste has
  not been observed.

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
  two letters, and `👨‍👩‍👧` is three people, all in the run's fill color. Needs grapheme segmentation
  before glyph lookup and a color (RGBA) atlas page drawn untinted for clusters with emoji
  presentation. `LaidOutCell.clusterEnd` already marks where each cluster closes.

---

## Scene, adapters & layout

- **(P3) geom's `Mat3` and `mat3` are different matrices.** `Mat3` and the free functions beside
  it (`identity`, `multiply`, `invert`) are the six-number affine; `mat3` and `GlMat3`, which
  moved in from core's renderer, are the nine-element column-major matrix a GL uniform takes.
  Both are exported from `@weasel-js/geom`'s root, a capital letter apart.

- **(P2) `arrayAdapter` as the default Canvas adapter — full unification.** The Canvas-level synthesis tier this entry used to describe is gone — `Canvas.tsx` no longer takes `items`/`setItems`/`createDefault`/`poseBounds`/`intersectsRect`, and only `toPose` survives as a layer-config override. `arrayAdapter`, `useArrayAdapter` and `sceneToAdapter` are still three separate wirings. The deeper move — every scene is a tree rooted at one container — was taken by `useScene` (kit-owned tree with leaf/container) but the inline-props and explicit-adapter tiers still sit alongside rather than collapsed. Full unification (one adapter contract, one default wiring) remains an option for later.

- **(P2) Scene history: an entry that names a node removed by an untracked edit can never be
  undone.** `scene.add(n)`, `scene.setPose(n, p)`, then `scene.untracked(() => scene.remove(n))`,
  which is what `reconcileSpecs` does when outside data drops a node
  (`packages/core/src/core/scene/reconcileSpecs.ts`, called from
  `packages/diagram/src/DiagramView.tsx`). `scene.undo()` throws `Scene: unknown node id "n"` and
  the entry stays on top of the undo stack, so every later undo throws the same way and the entries
  beneath it are unreachable. The stacks and the scene stay consistent; the stack is just stuck.
  Options: have an untracked removal drop or neutralize the entries that touch the removed ids; have
  kit ops whose target is gone report `'noop'` on replay instead of throwing (the policy restored
  external ops already follow in `bindOpToHistoryAdapter`); or have `reconcileSpecs` clear history
  when it removes a node. The second option alone does not cover a gesture's entry: a live external
  op (`createTransformOp` bound by `bindOpToAdapter`) replays through `adapter.setPose` into
  `scene.setPose`, which throws in `requireNode` before any kit op runs (read from the code, not
  run). Nor does it cover the reverse case, an id that an untracked edit re-added: undoing an older
  `kit:remove` of that id overwrites the live node and attaches it a second time.

- **(P3) Scene: the selection keeps ids of nodes a removal took.** After `scene.setSelection([z])`
  and `scene.remove(z)`, `scene.getSelection()` still returns `['z']`, so every reader guards
  `scene.get(id)`. `kit:remove`'s apply in `packages/core/src/core/scene/scene.ts` could filter the
  selection the way `kit:setLayerLocked` does, but `reconcileSpecs` replaces a node by removing and
  re-adding its id, and filtering there would deselect a node the user sees as unchanged. The call
  is whether selection is a set of ids (stale ids are the reader's problem) or a set of live nodes
  (then a replace has to carry the selection across). `loadState` already drops ids the snapshot
  does not hold, but `setSelection` keeps an id no node has (`reachable` filters on locks only, and
  `scene.selection.test.ts` selects ids it never added), so today it is a set of ids.

- **(P3) `packages/core/src/core/scene/scene.ts` is still 1,100 lines.** The jobs that closed over
  their own state are out, each in a module beside it: `nodeStore`, `kitOps`, `layerStack`,
  `arrivalWindow`, `lockGuard`, `appliedLog`, `historyFacade`, `renderOrder`, and `serialization`.
  What is left is the recording core (`makeOp`, `executeAndLog`, `applyBatchNow`, about 200 lines)
  and the public `Scene` object's methods (about 580), and they share seven mutable variables:
  `batchDepth`, `batchDirty`, `currentBatch`, `suppressRecording`, `untrackedDepth`, `selection`,
  and `version`. Splitting them means putting those in one record the pieces close over, then
  cutting the methods by what they edit: nodes, layers, selection, and history and batches.

- **(P3) Duplicate and Alt-drag clone: a copy that derives from nodes outside the copy still follows
  the originals.** `copySelection` (`interactions/actions/defaults/copySubtree.ts`) re-points a
  copied node's `dependsOn` id list at the copies only when every node in it was copied too. With
  one or more left out, the copy keeps the original list, so duplicating an edge alone gives a
  second edge drawn exactly over the first. A paste drops such a node instead (ruled 2026-10-11);
  the call for a copy made inside the same scene, where the originals are still there to follow, is
  whether it does the same, keeps the list, or re-points the ids it can.

### Derived geometry follow-ups

Left open by the derived-path and derived-pose arcs (`dependsOn` / `derivePath` /
`derivePose` / `SceneRegistry`; the seam is documented in `docs/extending.md`).
Arcs 1, 1b, 2, 3, 5, 6 and most of 4 are in — a derived node is picked and
clipped where it paints, follows a live drag, and can drive its own pose; stroke
markers ship; and `@weasel-js/diagram` holds the `DiagramNode` trait, ports on
the outline, the body builder, edges routed by `straight` / `orthogonal` /
`bezier`, the connect gesture, `layered` / `tree` / `force` layout, edge labels,
and a live run of any of them.

A derivation is handed its dependencies' resolved paths as well as their poses
(`DerivedDep.path`, lazy and memoized), which is what an edge label reads;
`usePoseRun` publishes a frame of poses to the override channel and commits the
run as one batch; and `SceneNode.pickable: false` keeps a body's own label from
intercepting the press that drags the body.

- **(P3) The preview channel still carries pose twice.** `move` / `resize` /
  `rotate` publish each frame to the scene's pose overrides *and* keep their own
  `previews` map behind `previewIds` / `previewPose`. The overrides are what the
  scene reads (derived geometry, picking); the map is what the ghost layer and
  the selection-chrome bounds read. Collapsing them means teaching those two
  readers to resolve through `effectivePose`, after which the map is redundant
  for pose. It cannot go entirely: `previewData` — a path-anchor drag's
  in-flight `data` — has no override equivalent, and `PoseOverride` is
  `{ pose?, alpha? }`. Decide whether overrides grow a `data` field or the two
  channels stay split by what they carry rather than by who writes them.

- **(P3) A derived node is unpickable through a bare adapter.** The
  scene-backed half of this landed: `NodeShapeEntry.silhouette` takes a `NodeSilhouetteCtx`
  carrying `derivedPath`, `kit:derived` reports it plus its `ink`, and
  `PickSource.derivedPathOf` / `buildSceneTree`'s optional argument resolve it
  where a scene is in scope. What is left is the other side of that split:
  `adapterPickSource` and `Canvas`'s bare-adapter render path cannot derive —
  it needs the dependencies' poses — so a derived node there still answers from
  its own placeholder pose. Closing it means giving the adapter surface a
  dependency read, which is a bigger decision than picking.

- **(P3) A derived path's pull covers poses only.** `resolveDerivedPath`
  value-compares its dependencies' poses on a memo hit, so a moved dependency
  re-routes with nothing pushed behind it. But a derivation is handed
  `DerivedDep`, so it can read a dependency's `data` and its `layer` too, and
  those still ride on the scene's pushed invalidation on `kit:setData` and
  `kit:setLayer`. Widening the pull to those means deciding what a derivation
  is allowed to read, not just how a pose is compared.

- **(P3) `ForceGraphDemo` is a second force-graph pipeline.** It runs d3-force through
  `useSimulation` and paints with its own render layer, beside `@weasel-js/diagram`'s `force` layout
  and `DiagramView`. `force.ts` reserves that route for graphs too big for a scene node per edge,
  but the demo has 24 nodes. Ruled 2026-10-11: it stays as its own example, of the simulation loop,
  and is not rebuilt on `DiagramView`. That leaves a graph large enough to show why the route
  exists, and a registry blurb that names the bypass.

### `useScene` follow-ups

- **(P3) Scene layout: what the first cut left.** A container declares its layout
  on its node (`ContainerNode.layout`), and the scene's one layout pass
  (`core/scene/layoutPass.ts`, run through the arrival window) applies it to every
  arrival, departure, reorder and resize, and to a layout swapped in by
  `scene.setLayout` / `createSetLayoutOp`. Still open: a declared layout is measured by
  `UseSceneOptions.layoutFrame` unless a canvas installs its handler, so a scene whose
  canvas composes poses or uses a custom descriptor states that twice — folds away once
  composition is a scene property (see the cascade entry below); and whether the `layouts` prop, now a second way to name a container's layout, should
  be retired in favor of the node declaration.
- **(P3) Container-pose cascade as a scene-primitive semantic.** Today it is adapter-level
  configuration, two mutually exclusive ways: `sceneToAdapter({ cascadeContainerPose: true })`
  translates every descendant by a container's delta through the pose descriptor, and
  `poseComposition` makes a container's pose a frame its children are relative to. `Scene.setPose`
  itself still stores absolute poses. Ruled 2026-10-11: the scene owns composition: a child's pose
  is relative to its container's frame, and moving a container writes one pose. That leaves building
  it into the scene, deciding where the composition is supplied to the `useScene` constructor, and
  settling what becomes of `cascadeContainerPose`.

### Container layout strategies

- **(P3) Reparent-on-layout-drop lives in the move action's `layoutDrop` behavior (`actions/move/commit/layoutDrop.ts`), not the strategies' `commitDrop`** (which are pose-only), as does choosing the destination container (`<SceneCanvas layoutDropTarget>`, `LayoutStrategy.dropRegion`). If a strategy ever needs container-specific reparent semantics, revisit whether `commitDrop` should own it.
- **(P3) Nothing scrolls a `'scroll'` tile grid.** `tileGrid({ overflow: 'scroll' })` places its
  overflow past the container's last visible line and reports the region through
  `LayoutStrategy.contentExtent`, but no kit host reads it: the overflow just sits past the
  container's bounds. Ruled 2026-10-11: a container's scroll offset is view state, part of the frame
  the container gives its children, and the document never moves. An absolute-pose scene has no
  container frame today, so this waits on "Container-pose cascade as a scene-primitive semantic"
  making composition the scene's own. That leaves the offset itself, folded in by painting, picking,
  selection chrome, move, resize, and snapping with the rest of the frame, and a host that reads
  `contentExtent` and scrolls.

### Units

- **(P3) Per-subobject scale: a container cannot declare its unit scope.** `@weasel-js/quantity` has the conversion (`UnitScope`, `resolveScoped`, `scopesOf`), but a scope is still something the consumer keeps beside the scene and hands to `scopesOf` through `scopeOf`. What is left is a `ContainerNode` field holding the scope, which belongs in `packages/core/src/core/scene/types.ts`, and the readers that would take it from there: the grid strategies and the property fields resolve against one `unitSystem` option today.

---

## Animation

- **(P3) Timeline: a frame that skips whole laps fires them under `loop: n` and not under
  `loop: true`.** In `packages/animator/src/timeline/createTimeline.ts`, a frame long enough
  to skip whole laps fires every skipped lap's events under `loop: n` but none under `loop: true`,
  where `booking.ts` says crossings fire "nothing of the laps in between". Which of the two is
  meant is undecided.

### Timelines and rigging

The timeline, clips, the rig, and skinning are built; `docs/concepts.md` ("Clip", "Rig and
skin", "Animation target") describes them. What is left:

- **(P3) Two demos build by hand what a clip now holds** — `apps/site/demos/platformer/clips.ts`
  keeps its own `Clip` type and `clipTrack`, with function easings, and `TimelineDemo.tsx`
  moves its nodes from `onTick` closures. Both would be `Clip` data bound with `bindClip` and
  `sceneClipTargets`.
- **(P3) A clip cannot hold a path** — a key's value has to be what JSON reads back, and a
  `Path` keeps its points in typed arrays, so a track tweening a path-shaped pose makes
  `toClip` throw. `apps/draw/src/persistence.ts` tags typed arrays for its own files; a clip
  would need the same, in `packages/animator/src/timeline/clip.ts`.
- **(P3) A clip names a rig track's axes by number** — `ClipSampledTrack.axes` is positions in
  the target's axes, so a track on some of a rig's joints breaks when the skeleton's joint
  order changes. Naming joints needs the binder to answer a target's axes for names, as
  `jointAxes(skeleton, names)` does.
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

Animations combine through targets, described in `docs/concepts.md` ("Animation target") and
built 2026-10-11. What that left:

- **(P3) What `createTargetTable` leaves** — the table is built (2026-10-11;
  `docs/concepts.md`, "Animation target"), vertex colors are on one, and a row with a hold is
  shown by its pass. Left:
  - A row is still read by itself, at a single target's cost, while a tween or spring with a
    destination runs under a hold on it, and while something a stopped animation left waits
    beside a hold. What a hold hides of such a move is worked out per animation
    (`hidden` in `packages/animator/src/target.ts`), which the pass has no column for.
  - `shown` is a `Float64Array`. A painter that uploads it wants `Float32Array`, and a copy a
    frame is the caller's until the table can be asked for one.
- **(P3) A hold costs 0.3 to 0.7 µs a frame, where a tween costs under 0.1** — `node
  tests/perf/target-reads/run.mjs table 10000 held`: 10,000 table rows with one hold each and
  nothing else take 6.8 to 7.4 ms a frame, and 1,000 take 0.29 to 0.30 (orochi, 2026-10-12,
  plain Node 26). That is after a hold stopped building arrays every frame, which took a third
  off. What is left, from the CPU profile at 10,000: a quarter is blits running a voice that
  answers through a function (`rows`, `call`, `foldInto`, `ready`, and a `WeakMap` read per
  voice); the rest is the hold's own voice reaching, one after another, the group, each
  member, the function that gives its value, that value, and the committed value. Two designs
  would move it and neither is started: a hold whose `value` and `weight` are not functions
  need not be read again until its target's committed value changes, and holds on a target
  table's rows could keep their values and weights as rows of the table's own arrays.
- **(P2) A frame of the animator costs about 75 ns an animation at 10k, read or not, and a
  fifth of it is ticking each animation as an object** — `node
  tests/perf/target-reads/run.mjs table 10000 idle` (orochi, plain Node 26; five runs read 0.73
  to 0.93 ms a frame). In a CPU profile of 10k tweens `tickEach` is 22%: every animation is an
  object whose `tick` runs each frame, to advance its own clock and answer whether it is done,
  though a tween with no `onTick` has nothing to do until it ends. The rest is blits' pull.
  Ticking only the animations that have something to do each frame needs each one's clock
  kept some way other than a sum a frame; not designed.
- **(P2) Stopping and starting an animation costs more as more are running, and most of it is
  in blits** — `node tests/perf/target-reads/run.mjs churn 1000 10000` times the parts (orochi,
  plain Node 26, blits 0.10.0). With 100 restarted a frame: a cancel costs 5 µs with 1,000
  running and 21 with 10,000, a start 1 and 2, and the frame after them 1.1 ms and 4.1 against
  0.08 and 0.93 steady. The cancel is blits' `forget` walking every subject the mix holds, and
  the slow frame is blits' first read of the new voices; the animator's own lane and codec
  code is under 4% of the profile. `~/src/blits/NOTES-FROM-WEASEL.md` ("Stopping a subject's
  voice") has the lines and a fix. What is the animator's is the entry above: its two walks
  over every animation and every moving target read slower in a frame that follows restarts.
- **(P3) Playing an animation backward** — a time scale below 0 is refused where it is set
  (`timeScaleOf`, `engine/table.ts`). Playing backward needs the animator's clock to keep going
  forward and hand each voice a rate below 0, which blits 0.9.0 ends where the voice started,
  and an answer for what a tween run back to its start does: a blits voice past its start
  reads 0, which for a tween on a target is its destination.

### Earlier deferrals

All from `docs/specs/2026-05-04-animation-primitive-design.md`. The timeline arc's
decomposition meant to absorb the first; it has not landed:

- **(P3) Animation-aware undo** — "rewind the animation" instead of cancel + jump.
- **(P3) GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts.

---

### labkit presentation mode

`<Lab present>`, `?present` and `usePresentation()` show one trial without any
chrome, for portfolio embeds, with a refit view, play controls, `gestures`, a
`still` for poster capture, and `postMessage` play and pause for a host page;
README "Presenting a lab" and `packages/labkit/docs/AGENTS.md` cover it. What
is left:

- **(P2) agnew and rosee on `<Lab>`: built, waiting on a labkit release.** Each repo has an
  unpushed `lab-onto-labkit-lab` branch that mounts `<Lab>` and serves its `?bare` embed
  through presentation, with its smoke test passing. agnew's runs on labkit 1.9.2 as it is.
  rosee's needs the release carrying `<Lab clock>`, `opening`, and the empty-sidebar fix: it
  plays every tile on the lab's clock, and its `@weasel-js/labkit` range must be raised to
  that release before it can merge. agnew still plays from its own transport, because its
  three.js view advances the pen itself and holds a finished curve before redrawing it;
  moving it onto a lab clock is an agnew library change, and the owner's call.
- **(P3) A still of a clock that is not seekable is taken where the clock
  opens.** `<Lab still={1200}>` warns and leaves it there, because such an
  instrument's state is built by running. Holding it at a time means running
  it forward off screen, at a step the instrument would have to name.

### labkit's deprecated snapshot undo

- **(P3) Delete `packages/labkit/src/undo/undoStack.ts` and its exports**
  (`emptyStack`, `pushSnapshot`, `undo`, `redo`, `clearUndo`, `UndoStack`) once
  sherpa's studio (`apps/studio/src/Studio.tsx`), the last user, moves its
  document undo onto `createHistory`. labkit's own trials left it 2026-10-06.

## Audio

Design: `docs/superpowers/specs/2026-08-22-audio-engine-design.md`.

- [x] **`@weasel-js/audio` — shipped, published at 1.2.0.** A leaf package with
  no weasel dependencies: lookahead scheduling on its own one-shot timer, voices
  with handles and `cancelKey`, buses with gain/mute/solo, `spatialize()`, and
  analyser taps with `bands(n)`. Registered in `build:leaves` and the `fixed`
  group. Consumed by `AudioDemo`, `SceneScrollerDemo` and `platformer/sfx.ts`.

  Its plan file has every box unchecked too; the CHANGELOG and registry are the
  record. The follow-ups below are what is left.
- **(P3) The side-scroller's music bed as engine voices.** Its footsteps and
  landings are `playNoise` voices now; the bed is still hand-written PCM
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
  the cue and its parameters beside the sliders, since the devices work by
  bypassing the viewer's argument and the point of the surface is to let a
  consumer see which one is being applied.

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

- **(P3) A consumer's behavior cannot do frame math.** `GestureContext` carries no pose
  composition and no per-layer plane map, so `ctx.current` is a stored pose shifted by a plane
  delta and a behavior outside core cannot compose it to world. Move's own behaviors close over the
  session instead.

- **(P3) An action's code has two homes.** `actions/defaults/<name>.ts` holds the action, and a
  sibling `actions/<name>/` (move, resize, rotate, flip, align, distribute, clone, clipboard,
  booleans, outlines, edit-anchors, lasso-select) holds its options, geometry, and gesture
  adapter. One directory per action would hold both. `move` is done; the rest follow it.

- **(P3) Disabled has no signal of its own, now that emphasis is an alpha.** Disabled is `opacity:
  0.4`–`0.5` on the whole control, and subtle text is 0.54–0.64 alpha, so a disabled control and a
  subtle label can read alike. Ruled 2026-10-11: disabled gets a second cue besides fading. Which
  cue is not chosen yet; that leaves choosing it and giving it to every control that fades when
  disabled.

- **(P3) apps/site never loads the kit's faces.** It imports no
  `@weasel-js/theme/faces.css` or `fonts.css`, so `--wzl-font-ui`'s Oswald and
  `--wzl-font-numeric`'s Oswald Tabular fall back to system faces in every demo.
  Left as is for now by decision; draw loads `fonts.css` since the
  numeric-helper branch.

- **(P3) Are `ToggleBar`, `ButtonBar` and `OptionsBar` one component?** They
  differ only in what a segment does, yet `ToggleBar` keeps its own copy of the
  segmented-control styles (`ToggleBar.module.css`) while the other two share
  `components/segmentedControl.module.css`. The two files agree again on
  every rule they share (`segmentedControl.browser.test.tsx` measures the
  shared one), but a fix made in one still has to be made in the other.
  What `ToggleBar` adds is a `.segmentMixed` state, a `.variant_minimal` that
  genuinely diverges (bordered box, square corners, inner dividers, `gap: 0`)
  and a `.variant_flat`. Folding the files makes the shared module a base that
  `ToggleBar` overrides through descendant selectors, which `composes` handles
  badly, so decide the component question first.

- **(P3) Nothing in `@weasel-js/ui` shows a quantity's composites or styles its parts.**
  `presentRange` and `presentVector` exist, but no component calls them: `BandEditor` does not
  report a band as a range. `Slider`'s thumbs still take bare numbers where `BandEditor`'s bands
  take tagged ones; and nothing styles the `data-part` or `data-composite` spans the HTML form
  emits, so `PropertyField` still draws its suffix from its own `unit` prop.

- **(P2) Redesign the stop color/opacity swatches under `GradientEditor`.** Each stop gets
  a `ColorField` with an alpha slider in a row beneath the track (`GradientEditor.tsx`). The
  owner wants that row redesigned; the shape it should take is still open.

- **(P3) labkit's `LabSwitcher.less` menu is a fork of the weasel-ui popover skin.** It copies
  `MenuButton`'s menu and items, but with an opaque surface and a different shadow from
  `components/listbox.module.css`, which `MenuButton`, `Select`, `ComboBox` and `PaintField`
  share. Decide whether those differences are intended; if not, it wants the shared skin — and
  its items are links, which `MenuButton` has no way to render yet.

- **(P3) labkit and the apps hand-build what weasel-ui already draws.** Each differs a little
  from the ui component, so swapping changes pixels and needs a call on which look wins:
  labkit's `.lk-viewport-controls__button`, `.lk-toolbar-button` and `.lk-titlebar-button`
  against `Button`'s ghost icon button; labkit's `StatusBar` and `DragGhost` against the ui
  ones of the same name; `SidebarRegion`'s section head and undock button against
  `SidebarPanel`; `LabHeader`'s bare "Add trial" button beside the `MenuButton` it becomes
  with more than one instrument; the theme editor's
  swatch tabs against `ToggleBar`'s flat variant and its hex and number inputs against `Input`
  and `NumberField`.

- **(P3) The site's chrome colors come from its own `--ckd-*` palette, not theme tokens.**
  `canvas-kit-demo.css` declares `--ckd-*`, and it and the demos' stylesheets read them directly, so
  the site ignores light mode and any theme a reader picks. Its `:root` block already feeds most of
  them into `--wzl-*` (`--ckd-text` → `--wzl-fg`, `--ckd-muted` → `--wzl-fg-muted`, …), but
  `--ckd-bg` and `--ckd-surface-2` have no counterpart there, and `--ckd-accent` /
  `--ckd-accent-dim` split what `--wzl-accent` means. Ruled 2026-10-11: the site follows the
  reader's mode and theme through the theme tokens, and gives up its fixed dark look. That leaves
  picking tokens for those four, moving the stylesheets off `--ckd-*`, and dropping the
  `color-scheme: dark` that pins `canvas-kit-demo.css`.

- **(P3) Overlays still set React Aria's deprecated `UNSTABLE_portalContainer`.**
  Its replacement, `UNSAFE_PortalProvider`, is exported by `react-aria` but not
  re-exported by `react-aria-components` 1.18, and depending on `react-aria`
  directly risks a second copy whose context the overlays never read — which
  fails silently, as an unthemed overlay. Switch `useOverlayPortal`
  (`packages/ui/src/overlays/portalHost.tsx`) to the provider once RAC exports it.
  The same switch lets a contained `ToastRegion` drop its own region for RAC's,
  which would make it an F6 landmark again. Still absent from RAC's index at
  1.21.1 (still `latest`) and at nightly `3.0.0-nightly-99e610236-261006`,
  checked 2026-10-07. The installed 1.21.1 was read again on 2026-10-11: no
  `PortalProvider` in `dist/exports/index.*`, its types, or as a file under `dist/exports/`.

- **(P3) Hover reports motion only, and nothing in the kit binds it yet.** `hover` is a gesture
  now (`HoverSpec`; `docs/taxonomy.md`, "Gesture"): an immediate action bound to it runs on every
  unpressed pointer move. It does not say when the pointer leaves the surface or passes from one
  target to another, so the loupe (`packages/labkit/src/loupe/useLoupe.ts`), which puts its lens
  away on `pointerleave`, still hand-attaches both listeners, and so does `CustomShaderDemo`.
  Wants a leave signal (and a decision on whether crossing between targets is one), then the loupe's
  aim and the demo's cursor-following panels moved onto bindings. Only jsdom has run a hover binding.

- **(P3) Split `Properties.module.css`.** It is 73 KB and styles the panel, list, rows, group,
  subpanel, cards, and every field in one file, with three generated stance blocks inside it. Its
  header says the rules that cross components (`.listPairs > .subpanel`,
  `.groupBody > :not(.rowColor)`) are why it is one module. Wants those few shared names in one
  small module the rest compose from, and each component's rules beside the component, as
  `PropertyHelp.module.css` already is.

- **(P3) labkit's palette drag-drop runs its own pointer session.** A trial's
  pan, zoom, tap and loupe route through weasel's dispatcher (`CameraInput`),
  but dragging a palette item onto a canvas is `useDragDrop`
  (`packages/labkit/src/dragdrop/DragDropRuntime.tsx`): a press in the sidebar
  that ends over the canvas, which no binding on the canvas's dispatcher sees
  begin. Routing it needs a drag that starts on one element and drops on
  another — the same shape `ingest` answers for an OS drag.

- **(P2) Things that look duplicated in this engine and are not.** Left from the
  2026-08-29 duplicated-cascade audit, whose findings all landed — `git log` and
  `.changeset/` are the record. This list is the other half: pairs a future audit
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

  From the 2026-09-28 geom-adoption audit of labkit, modes, d3, paint and ui:
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

- **(P3) Reconcile `BandEditor` with `Slider`.** `BandEditor` (bands: a contiguous tiling of an axis, seams draggable, each band carrying a payload) ships alongside `Slider` (a thumb list on an axis, `constraint: 'ordered'`, `onAddThumb`/`onRemoveThumb`, `renderTrack`). Under a contiguous tiling the two are the same control — N seams determine N+1 bands, so seams *are* an ordered thumb list — and they were kept separate deliberately: bridging them means teaching `Slider` about the region *between* thumbs (payload, hit-testing, selection), which is the wider change the reconciliation actually requires. The other trigger is `Slider` needing a non-linear axis. A third option arrived with `windease` 1.0 (2026-08-20): its `LayoutStrategy` is public API — `layout()` returns placements plus affordances, `reduce()` folds a gutter drag into strategy state — so a band control is a strategy you write rather than a control you build, and it brings widened gutter grab targets, `affects` for lock suppression, and — as of 1.2.0 — keyboard-operable gutters with it (`role="separator"` with the value triple, arrows plus Home/End, each keypress synthesized into the same drag event the pointer sends so the strategy clamps once). It ships no band strategy of its own: the two built-ins are `gridStrategy` and `stripStrategy`, and strip is `LayoutStrategy<void>` whose gutters are single-child `resize-x` affordances writing pixel `placement.size`. Mapping domain values onto seams is still the consumer's. Note `Slider` is the former `RangePicker`; its spec carries a banner saying so.

- **(P3) The color literals with no token equivalent.** Arc 4 tokenized what had a token and
  left the rest rather than inventing a mapping — `check-design-tokens` covers size, weight,
  radius and the stray danger reds, but not color generally, for that reason. What remains is
  `Badge`'s status palette (`#7ab8d4`, `#d4a574`), the `GradientHandles` and `Keycaps` literals,
  and roughly 70 `rgba()` values that are depth geometry (box-shadow insets, gloss gradient
  stops, the dialog scrim) for which the theme ships no shadow, gloss or scrim token. Each needs
  a semantic name before it can become one.

- **(P3) `<ToggleBar>` polish.** Shipped to `@weasel-js/ui` (spec/plan dated 2026-05-17). Visual still needs polish — literally, polish this.

- **(P3) Two CurveEditor handles are still literals.** The `--wzl-handle-size`
  family covers the 45°-rotated squares; the round ranks did not fold into it,
  because a radius is not a diamond edge. The plain anchor circle (`r={4}` in
  `createFunctionLayer`) and the bezier control handle (`HANDLE_RADIUS = 3.5` in
  `createKeyframeLayer`) are the two left. Either add `--wzl-handle-dot-size`
  for the round ranks or restate the family in terms of diameter — it is a
  visual call that wants a browser.


- **(P3) ToggleBar's selected segment is the Aqua glass ramp, not a color of its own.** Asked for:
  move the default treatment off "the aqua" and save it for a theme that wants it. There is no
  ToggleBar color to move — every surface in the ramp is `var(--wzl-accent)`, which seventeen
  components read, and `Button.variant_primary` is the same drawing. The panel's bars already sit
  outside it via the `flat` variant. Ruled 2026-10-11: the default theme draws selected and primary
  controls flat everywhere, `Button`'s primary included, and the glass becomes something a theme
  opts into. That leaves the flat default for everything drawn with the ramp, and a seat in the
  theme that turns the glass on.

- **(P3) Loose ends of the condition work.** labkit's `isEntryShown` has no resolved schema and
  compares stored values, where every other reader decodes. A rail entry for a group drawn under
  `markHidden` carries no mark, and a hidden `Bar` cell is dimmed with no badge. In a
  `SelectionPanel`'s narrow label column the `hidden` badge runs about a pixel into the field.
  `Bar`'s item conditions run through `SelectionPanel`'s shared code and have no test of their
  own. `Properties.module.css` is one 1,597-line sheet. `PrefSchemaEditor` edits an entry's own
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
  Its drag ghost draws a pointer with no `over`, as an alias of nothing. (3) labkit's
  `ControlMatrix` takes no `over`, so a cell's popover finds an alias's leaf in the matrix's own
  schema, and a lab resolves its instrument's config schema with none (`useConfigSchema`), so
  that schema cannot hold a condition on another's setting. (4) An alias of nothing in a bar
  inside a `PrefsForm` draws no cell on a horizontal bar, where a `Bar` draws
  `(alias: no pref at …)`.

- **(P3) What a bar does not do yet.** `ActionBar` is not built on `Bar`: its `icons` prop
  overrides an entry's icon with a `ReactNode`, which a leaf, being data, cannot carry, so it needs
  that prop to become icon names or `Bar` to take icon overrides by path. A bar too long for its
  room scrolls, with no overflow menu. A group a standalone `Bar` opens from a button draws as
  labeled rows whatever its `as`, where a bar in a `PrefsForm` opens it in its own form.

- **(P3) Disabled and panel-box rough edges seen in headless Chromium, 2026-10-11.** A disabled
  `Bar` action button draws at 0.4 where every other disabled cell draws at 0.5. A disabled text
  area in a `Bar` keeps a full-strength, working "Notes" button that opens to a disabled text
  area. labkit's "Pin" button on a disabled `ControlPanel` row still works. In light mode a panel
  box's own 1px `--wzl-border` is invisible on its sunken fill in `PrefsForm` and `SelectionPanel`,
  because light mode sets `--wzl-border` and `--wzl-surface-sunken` to the same gray; `MotifFrame`
  got around the same collision by mixing its edge from its own surface (`25b22ee40`).

- **(P3) `PrefSchemaEditor` drags no browser test drives.** `PrefSchemaEditor.drag.browser.test.tsx`
  drives a pointer through a palette drag onto the preview, a row drag, a rail drag, and a tree
  drag, and a tree row onto the Unplaced list as far as the hold. Not covered: that drop, a
  palette tool dropped on the tree, and a drag held on a rail entry until its page opens (the
  500 ms `RAIL_OPEN_MS` timer).

- **(P3) A rail of sections and pages: two things not decided.** A `PrefsForm` rail lists a page
  at any depth, and a section only when it sits directly on a page, the root's own included. (1) A
  foldable rail unfolds an entry only while the open page is it or under it, so a section holding
  pages of its own keeps their entries shut while the reader scrolls through it. Whether the
  section in view should unfold is open; it would move the rail under a reader who is scrolling.
  (2) A section's rail entry and a nested page's look the same until one is chosen.

- **(P3) A stuck section heading in a rail pane sits below the pane's top edge.** `.sectionTitle`
  is `position: sticky; top: 0`, and in Chromium its box rests the pane's `padding-top` below the
  scrollport's edge (measured: the heading's top at 10px with 10px of padding), where the
  comment on the rule says the offset is measured from the edge. Whether rows scrolling under it
  show in that strip has not been looked at. The `scroll-margin-top` on what a section holds
  adds the padding for the same reason, and estimates the heading's line as `1lh` of the element
  scrolled to, which leaves a few pixels of gap under the heading.

- **(P3) `PrefSchemaEditor`: shift does nothing in the live preview.** Cmd-click adds a row to the
  selection there; a range has no clear meaning across pages, and what it should take is not decided.

- **(P3) What `SelectionPanel`'s `selected` still does not reach.** A `pair` row and a top-level
  section under a heading, in a tab, or in a panel mark and report now. Left: a cell a bar fuses
  from a run of flags is marked only for its first leaf, so a later flag in `selected` marks
  nothing (seen in a browser, in a section `as: 'bar'`); doing it needs the panel's `renderers`
  where the marks are worked out, since a renderer decides whether flags fuse. A top-level
  section drawn `as: 'bar'` or `as: 'fragment'`, or with no name, draws no heading, tab, or panel,
  and its key marks and reports nothing, which is ruled to stay so (2026-10-11). Cmd or Ctrl on a press of
  a tab does not toggle, in the panel or in `PrefsForm`: a react-aria tab keeps its pointer events,
  so the press arrives as the focus it causes, which carries no modifier.

- **(P3) Loose ends beside the selection mark, none checked further.** The fragment mark in
  `Prefs.module.css` repeats the three declarations `Prefs/selection.css` now owns.
  `PrefsForm.selection.test.tsx`'s `marked()` queries bare `[data-selected]`, which an open
  react-aria tab also carries. That is a drawn bug too: `PrefsForm` puts `data-pref-path` on each
  tab, so the open tab of a run always wears the selection mark, with nothing selected (seen in a
  browser: `outline-style: solid`). `SelectionPanel` names its tab with `data-pref-rail` instead
  and marks the tab's panel.

- **(P3) Loose ends beside a number's unit as data.** A unit is data (`PrefLinearUnit`) or code,
  read through `resolvePrefUnit`. `PrefSchemaEditor` edits a number's default, and its auto value,
  in the stored unit and not the one the leaf shows. The text tool's percent unit
  (`useTextTool.ts`) is still code, for the rounding it does on the way back to the stored value,
  so the run properties do not export as a literal. Nothing reads a unit's `format` yet. A unit
  whose accepted suffix is all digits moves to the front of the list, as an object's integer keys
  do.

- **(P3) A rail does not see through a fragment.** A page nested in an `as: 'fragment'` group gets no rail entry
  and is drawn as a section where the fragment sits, the same as a group nested in a tab or a panel. If a fragment
  is to be a pure macro, `prefRailItems` and `RailLayout`'s `ownOf` would treat its children as its parent's.
  Its element has no box (`display: contents`), so a drag in `PrefSchemaEditor`'s preview cannot land beside or
  into the group itself, only beside the rows inside it; the structure tree takes both.

- **(P3) `PrefSchemaEditor` sees only a `ResolvedConfig`'s `group`.** A schema built with
  `f.section` keeps its sections, `showIf` rules, `.render` overrides and `.dialog` rows beside the
  `PrefGroup` tree, not in it, so the editor shows a sectioned schema as one flat list and its
  export drops all four. Seen on astv's `/prefs-schema.html`, whose settings are sectioned rather
  than nested because `f.group` would move their config paths.

- **(P3) `sectionTree` doesn't lift heading controls.** `ControlPanel` draws a `.heading()` leaf,
  or a first row repeating its heading ("Pump" under "Pumping"), in the heading's title row and
  warns about the repeat. The prefs rail `sectionTree` feeds to `PrefsForm` still draws that leaf
  as a row under a heading of the same name, and doesn't warn, because `PrefsForm` has no slot for
  a control in a rail item or subsection heading.

- **(P3) The desktop themes bevel four things and have never been looked at.** `win9xTheme` and
  `platinumTheme` (`@weasel-js/theme/themes/*`) and the `titlebar` frame motif exist, and browser
  tests pin their computed colors, shadows, and sizes, but only `Button`, the field frame,
  `PropertyPanel`, and a `titlebar` frame read the `--wzl-bevel-*` hooks. Checkbox, radio, switch, tabs, sliders,
  `ToggleBar` and the segmented control, menus and popovers, `Dialog`, toolbars, and the tooltip
  take each theme's colors and corners and draw no bevel, so a screen of them reads as flat
  gray. Each wants the matching hook read as a `var()` fallback, as `field.module.css` does. The
  systems' own faces are named in the font stacks and not bundled; a bundled lookalike needs a
  face whose license allows it. And nobody has seen either theme: the first screenshot will find
  what computed values cannot.

- **(P2) The built-in theme's status colors fall short of 4.5:1 where they are painted as text.**
  `--wzl-danger` is a field's error text (`field.module.css`) and, with `--wzl-warning` and
  `--wzl-success`, a link `Button`'s status color. Computed from the resolved tokens, in light
  mode danger reads at 3.85:1 on `surface` and 2.58:1 on `surface-sunken`, warning at 2.23:1 and
  1.50:1, and success at 2.11:1 and 1.42:1; in dark mode danger reads at 4.15:1 on `surface` and
  3.56:1 on `surface-raised`. The light code colors fall short on `surface-sunken` too (3.09:1 to
  4.37:1), and `--wzl-fg-on-accent` on `--wzl-accent-hover` reads at 2.54:1 dark and 4.10:1
  light. `gateFailures(theme, definition, lookup, TEXT_PAIRINGS)` in
  `packages/theme/src/testing/themeGate.ts` lists every one; the built-in theme is held only to
  `BUILT_IN_PAIRINGS`, which it passes. Not fixed where it was found because the fix repaints
  the default theme, which every visual baseline records.

- **(P2) A `ColorList` still holds CSS strings, not `ColorSource`s.** Every color a `@weasel-js/ui`
  component or a hud window takes is a `ColorSource` now, resolved by `colorSourceCss` /
  `colorSourceLiteral` (`packages/theme/src/colorSource.ts`). The tone list they index is not: a
  `ColorList` (`packages/theme/src/colorList.ts`) is literal strings, a ramp, a generator, or
  `(i) => string`, read with `colorAt` / `colorCssAt`, so a theme's `tones` cannot name a palette
  entry, and labkit's `Lab` and `nebula` and two site demos read lists as strings. Wanted: a list
  whose items are `ColorSource`s, read through the same two functions. Two smaller gaps beside it:
  a palette entry or a function source is written to CSS as the literal it resolves to in the
  provider's selection, so with no `<ThemeProvider>` it does not follow a mode change the way a
  theme ref does; and a custom `CurveLayer` has no resolver on its `LayerRenderCtx`, so one that
  wants a color has to render a component that calls `useColorCss`, as `CurveFill` does.

- **(P3) labkit stored lab: a trial that fails to hydrate is left out with only a console warning.**
  `hydrateTrials` and `hydrateSnapshots` (`packages/labkit/src/state/store.ts`) now skip a trial or
  a snapshot whose `deserialize` or `migrateConfig` throws, and its record stays in storage,
  unwritten and undeleted. Nothing in the lab says a trial is missing, and nothing can discard its
  record, which stays for good. The call to make is whether the lab draws a failed tile with a way
  to discard it.

- **(P2) labkit trial: the settings panel and the instrument write config through two `setConfig`s
  that disagree.** The chrome's (`packages/labkit/src/trial/TrialChrome.tsx`, used by the settings
  panel and by chrome contributions) calls the instrument's `onConfigChange` but takes no undo
  snapshot; the instrument's own `ctx.setConfig` (`renderCtx` in
  `packages/labkit/src/trial/Trial.tsx`) snapshots on `config.change` and `config.change:<path>` but
  never calls `onConfigChange`. So an instrument declaring `undo: { snapshotOn: ['config.change'] }`
  gets no undo entry for anything changed in the settings panel, and one declaring `onConfigChange`
  gets no derived state for its own writes. Wanted: one `setConfig` owned by the trial runtime that
  snapshots, writes, and runs `onConfigChange` against the stored record, handed to both contexts.
  The open calls: whether a panel edit should snapshot per write or once per gesture (a slider drag
  writes on every move), and whether an instrument's own write should run `onConfigChange`.

- **(P3) labkit lab: every trial re-renders whenever any trial's record changes.** `LabContext`'s
  value carries `trials` (`packages/labkit/src/lab/Lab.tsx`), and both `Trial` and `TrialChrome`
  read that context, so a pan frame, a job item, a clock write, or a mark save in one trial
  re-renders all of them. `CanvasStack` no longer repaints on it, but the React work remains, and
  `as2DView` (`packages/labkit/src/state/view.ts`) still allocates a view per render for every other
  reader. `LabContextValue.trials` is public, so splitting it out (a separate context, or a selector
  hook over the store, with the commands in a value that does not change) is an API decision.

- **(P3) labkit transport: on a looping clock, End and a scrub to the far right land at the start of
  the next pass.** `transportControl.seek` (`packages/labkit/src/clock/transportControl.ts`) clamps
  to `[0, duration]` and seeks `passStart + duration`, which a looping clock reads as phase 0 of the
  next pass, so the playhead shows at the left edge; with a counted loop (`loop: 3`), repeated End
  presses walk through the passes and end the run. The last pass is right as it is. The call to make
  is where "the end of a pass that another follows" sits: a fixed step short of `duration` (and how
  short, given `seek` takes ms and the pass can be any length), or a clock-level notion of "end of
  pass n" that reports phase 1 without rolling over.

- **(P3) labkit canvases: a device-pixel-ratio change is tested only against a stand-in.**
  `useTiledSurface` and `CanvasStack` now re-measure through core's `watchDevicePixelRatio`, and
  their tests fire a stubbed `matchMedia`, which jsdom lacks. Unverified: that the shared buffer and
  the layer canvases take the new backing size in a real browser when the ratio changes with no
  resize. Wants a browser test that emulates the change (`Emulation.setDeviceMetricsOverride`).

- **(P2) labkit trial: marks drawn in another tab never appear, and the next local mark erases
  them.** A trial builds its annotation store once from `record.annotations`
  (`packages/labkit/src/trial/Trial.tsx`, "One store for the trial's lifetime") and never reads the
  record again. When another tab's write replaces the record (`bindLabStore` in
  `packages/labkit/src/state/openLabStore.ts`), this tab's state and config update on screen and its
  marks do not; its next mark then saves `annotations.toJSON()` over the other tab's. Options:
  rebuild the store when the record is replaced by a remote write (losing this tab's mark undo
  history, as the remote path already does for state history), remount the trial on a remote
  replacement, or merge mark by mark, which needs an answer for a mark both tabs edited.

- **(P3) Which control a leaf gets is decided again in each params surface.** `prefFieldProps` is
  the shared half; each caller then overrides it: `Prefs/PrefsRow.tsx`,
  `SelectionPanel/renderLeaf.tsx` (`renderBuiltin`), labkit's `controls/fields.tsx` (`labField`) and
  `controls/ControlMatrix.tsx`, and `packages/labkit/examples/schema-lab/prefsToFields.ts`. The
  answers differ: a boolean with no `control` is a checkbox in the form and labkit and a switch in
  the panel; `control: 'toggle'` on a boolean is a checkbox in labkit; a `slider` number with no
  bounds is a 0..100 slider in ui and a typed input in labkit (`isSliderLeaf` wants both bounds); an
  enum's `radio` is segments in labkit and `menu` is a select; `font-family` and `font-weight` get
  "no control for" in labkit because `labField` gates on `isBuiltinPref` before `prefFieldProps` can
  answer; a stored value that is absent is the default in the form, unset in the panel, and `??
  default` in labkit, where `null` also reads as absent. The icon lookup against `ICON_PATHS` is
  written four times (`Prefs/prefField.tsx`, `Bar/renderBarLeaf.tsx`, `useLeafAction.tsx`,
  `SelectionPanel/renderLeaf.tsx`). Home: a `surface` argument on `prefFieldProps` (`'form' |
  'panel' | 'lab'`) carrying these defaults in one table. labkit's "radio means segments" and "a
  slider needs bounds" are the two to decide on purpose.

- **(P3) When an edit is written differs by params surface, with no one place saying so.** A typed
  number writes on blur, Enter, or step in `PrefsForm` and `SelectionPanel`, and on every keystroke
  in labkit's `ControlPanel`; a slider writes on release in the form and on every move in the other
  two; text writes per keystroke in the form, on blur or Enter in the panel, and debounced 150 ms in
  labkit; a color writes once per gesture in the form and panel and on every move in labkit. Each is
  a no-op `onInput` passed or withheld, and `settledOnly` is declared twice (`Prefs/PrefsRow.tsx`,
  `SelectionPanel/renderLeaf.tsx`). The panel's comment gives undo steps as the reason text and
  color settle, yet a slider there writes per move; whether `scene.batch` coalesces those into one
  undo step is unverified. Home: the same `surface` argument on `prefFieldProps`, returning props
  with the commit policy applied.

- **(P3) Collecting a run of `tab` groups, and what each other `as` draws, is written five times.**
  `Prefs/PrefsPane.tsx`, `Prefs/ObjectLeaf.tsx`, `SelectionPanel/SelectionPanel.tsx` (`drawn`),
  `SelectionPanel/renderLeaf.tsx` (`rowsOf`), and labkit's `ControlPanel.tsx` (`rowsFor`).
  `GroupTabs` is shared; the run logic is not, and it differs: `panel` is a bordered box in ui and a
  plain `PropertyGroup` in labkit; `section` is a `Subpanel` in labkit and a heading elsewhere; a
  group's `description` shows under a tab in `PrefsPane` and is dropped for tabs and sections in
  labkit; `SelectionPanel`'s top level flattens nested sections (`flatten` in `model.ts`), so a
  nested `tab` or `panel` loses its `as` while the object leaf beside it honors nesting; an empty
  tab section neither joins nor ends the run in `renderLeaf`, a hidden one does not end it in
  labkit, and `PrefsPane` has no emptiness check. Home: a pure "children as runs" helper in
  `@weasel-js/prefs` (leaf, tab run, or group with its resolved `as`) that all five walk.

- **(P3) Merging `pair`ed leaves into one row is written three times.** `pairRows` in
  `SelectionPanel/model.ts`, `rowsOf` in `SelectionPanel/renderLeaf.tsx`, and `rowsFor` in labkit's
  `ControlPanel.tsx`. `pairRows` drops `pair` from a row left with one leaf; the other two keep it,
  so a lone paired leaf is labeled by the pair and loses its own name. `effectiveSections` filters
  leaves after pairing and does not re-run that drop, so a multi-kind selection whose intersection
  keeps half of a pair draws a row labeled for the pair holding one field, and a lone `toggle`
  boolean there becomes a one-segment flag bar. Home: `pairRowsOf` in `@weasel-js/prefs` returning
  the rows, not only the lookup map.

- **(P3) The schema lab's `prefsToFields` re-derives what `@weasel-js/prefs` owns, and gets a unit's
  step wrong.** `packages/labkit/examples/schema-lab/prefsToFields.ts` converts `min` and `max` with
  the unit's `toDisplay` and passes `step` through unconverted, so a leaf stored in radians and
  shown in degrees with `step: 0.01` steps by 0.01 degrees; a decreasing conversion yields `min >
  max`. `prefDisplayBounds` converts the step as a distance and swaps flipped ends.
  `decodePrefValue` there applies an enum `encoding` and not a boolean one, and a `field` leaf
  becomes free text. Not hit today, since the lab's schema is the rect's. The example exists to show
  the API, and `ControlPanel`'s `fields` prop is marked deprecated in favor of `schema`: pass the
  schema, which goes through `prefFieldProps`, and delete the file. Not a drop-in today: an
  instrument's `config` takes labkit's own `ConfigSchema` (`packages/labkit/src/config/types.ts`),
  and nothing turns a `PrefSection` with dotted keys into one or into a `ResolvedConfig`, so the
  example first needs a way for an instrument to declare its config as a pref schema.

- **(P3) Three params files hold several owners each.**
  `packages/labkit/src/controls/ControlPanel.tsx` (about 810 lines: panel, auto state, reset, row
  dispatch, paired rows, debounced text row),
  `packages/ui/src/components/Properties/PropertyField.tsx` (about 740: the row component and every
  kind's control), `packages/ui/src/components/SelectionPanel/renderLeaf.tsx` (about 690: cells,
  flag bar, built-in dispatch, object leaf), and `Properties.module.css` (about 1,575). Split:
  `ControlRow`, `LeafRow`, and `PairedRow` into their own file, which `ControlMatrix` already
  imports from the panel; one file per control kind under `Properties/`, each with its CSS;
  `ObjectLeaf` out of `renderLeaf`.

- **(P3) `PrefSchemaEditor`'s attributes pane lists a mixed object or union attribute read-only.**
  `aggregateAttributes` drops an object, list, map, or union attribute from the form when the
  selected nodes disagree on it. `PrefsForm` now draws a mixed field and writes it at its own path,
  so the pane could show such an attribute field by field; its `onChange` would then have to take
  a field path, where `attrOf` reads `default.width` as an attribute name.

- **(P3) `PrefsForm` rail layout: the pane draws a group's leaves before its groups, where columns
  and list keep schema order.** `PrefsPane` (`packages/ui/src/components/Prefs/PrefsPane.tsx`)
  filters leaves and fragments out ahead of the groups, so children `{ light: tab, note: leaf, dark:
  tab }` draw as the row and then one `Light | Dark` strip in the rail, and as a `Light` strip, the
  row, and a `Dark` strip elsewhere; a drop placeholder between two sections is drawn up among the
  leaves. `paneChildren`'s doc says "in schema order", which the pane's own call does not honor. One
  walk in schema order for every layout, wrapping each run of rows in `.rows`, makes them agree; it
  changes what existing rail forms look like, which is why it is a decision.


- **(P2) TokenPanel scale: dragging a step's thumb back to where it started reads one unit off.** On
  a `px` scale with a step at 16, drag its thumb to 20 and back in one drag: near the start the
  readout shows 17 (or 15 from below), and exactly at the start it stops updating. `Slider` keeps
  calling the `onInput` it was given at pointerdown, so `commit` in
  `packages/ui/src/components/TokenPanel/Scale.tsx` compares every move against the starting amount,
  and its "an arrow key still moves a step by one unit" nudge fires for drags too. The nudge is only
  right for a key press, and `Slider` gives its caller no way to tell one from a drag (both arrive
  through `onInput`; a key press also calls `onChange`, but so does a drag's end). Options: `Slider`
  passes the source of a change to `onInput`/`onChange`; or `Scale` owns the arrow keys for its
  thumbs and `commit` never nudges.

### WeaselDraw app follow-ups (defer)

- **(P3) Multi-page documents.**

---

### weasel-den deferrals

From `docs/specs/2026-05-03-weasel-den-design.md`. **Read `packages/den/README.md` first** — the spec's `{ registry, alwaysOn, keybindings }` pack shape was superseded by core's `Contribution` + `mergeContributions`, and its convenience layer shipped inside core as the `features` presets plus `defaultTools` / `toolOptions` on `SceneCanvas`. The items below are what survives that.

- **(P3) Additional domain bundles.** `useWhiteboardPack` (sticky notes, freeform pen, text), `usePresentationPack` (frame tools, slide nav). Each is its own arc, and each is a `Contribution` bundle rather than a den pack. The diagram bundle shipped as `@weasel-js/diagram`; don't propose another.
- **(P3) Move `useSelectTool` / `useTextTool` / `usePenTool` /
  `usePencilTool` out of core's builtin tools.** The den's one motivation nothing
  has absorbed: separating finished, stable tools' test surface from core's. It
  needs no new package — `packages/den` is a README, not a package — and core's
  own workspace layout can hold them. Defer until each is stable. (`useInsertTool` was removed as a duplicate of `useRectTool`, and
  `useUserPenTool` never existed — this entry named both for months.)

### d3 integration plugin

`@weasel-js/d3` shipped; one item is parked:

- **(P3) `d3-zoom` / `d3-drag` adapters — parked.** Both duplicate kit systems
  (the `viewport.zoom` / `viewport.pan` actions, `useHandTool`, `useViewAnimation`;
  `useDragGesture`).
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
  would read them. By a grep of `render: () =>`, that is about 230 of the 508
  stories, and 39 story files have no story that takes args. A story drawing one
  instance in a plain configuration is the kind to rewrite around `args`, the way
  `Tooltip`'s `Basic` is; a matrix or a hand-built composition stays as it is.
  Where a component's props are a union or generic, as `ToggleBar`'s and
  `PropertyField`'s are, its stories pass a few named args and the other controls
  do nothing. Where a story holds a value in state, as `Timeline`'s playhead and
  `Jog`'s index are, the control only sets where it starts.

- **(P3) Marks are off in the workshop until annotations are a feature.** forge's
  instruments no longer declare labkit's `annotations` capability, so trials show
  no Marks section and no tool rail. The removed wiring — the
  story as the one annotation target, sized and captured through the trial's
  frame registry — is in `git log --grep 'take marks out of forge'`.

- **(P3) The CSS Vars panel does not save a token the theme derives.** A token
  edited by hand saves when the definition writes its value out: a pin, a
  component or a literal semantic, in the branch the trial's globals read
  (`applyTokenEdits`, `packages/forge/src/shell/cssVars/saveTokens.ts`). One
  that follows another token, a ramp, a contrast rule or an alpha stays a
  per-trial override, and so does a scale step changed after its scale, because
  a value written over it would drop the derivation for every mode and density
  the branch covers. A save also refuses a param that differs by `mode` while
  the trial's mode is Auto, since the panel does not know which scheme the
  frame resolved.

- **(P3, isolated stories only) A forge story whose `viewport` the index cannot
  read reloads its frame once when first opened.** The index reads a native
  story's `viewport` when both sides are number literals, and the first
  instrument takes its stage from that. Otherwise — a computed size, or a CSF
  story, whose viewport comes from `parameters.viewport` and `globals.viewport` —
  the stage arrives with the frame's `ready`, and labkit's `Trial`
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
  again (`createSplitStore`). The fix belongs in windease; the workaround goes
  when it lands.

- **(P2) A forge dev server started with `WAKE_EXTRA` served the modules it started with, whatever
  was edited after.** Seen 2026-10-11 on `WAKE_EXTRA=33461 npm run dev:forge`, four times in one
  session: after an edit to `packages/labkit/src/chrome/regions/SidebarRegion.less`,
  `/packages/labkit/src/styles.less` (which imports it) kept answering with the old rules while
  `/@fs/…/SidebarRegion.less` asked for directly had the new ones, and a `touch` changed nothing;
  after an edit to `packages/forge/src/shell/cssVars/CssVarsPanel.tsx` the page ran the old
  component across reloads. No `hmr update` line reached the log, so the watcher looks dead rather
  than one import edge untracked. A restart served the new code every time. Checked 2026-10-12
  against a real vite server on a temp root, and neither reproduces it: a file replaced whole (written
  beside and renamed over) is served new each time, for a module and for a stylesheet another one
  imports (`packages/forge/src/vite/replacedFile.test.ts`), and it still is with 13,000 more
  directories under the root, about what 26 worktrees in `.claude/worktrees` add to the main
  checkout's watch. Read, not run: nothing in wake's `WAKE_EXTRA` path or forge's plugin touches the
  watcher. Not checked: the real server on the repo root, where it has to be watched failing, and
  whether the server wake owns does the same.

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

- **(P3) labkit's clock browser test failed once on the fleet.** `clock.browser.test.tsx`, "a timed
  layer repaints as the clock plays, and holds once it pauses", line 92: the canvas read back red
  0 where the paused frame's shade was 3, in a full run on teitou on 2026-10-10 that passed the
  other 16,953 tests. It failed the same way a second time on 2026-10-11, at `d02d059c2`
  (`expected +0 to be 4`), and passed alone on this machine at that commit. Whether it is a race
  between the last paint and the readback or a real missed repaint is not known.

- **(P3) labkit's `usePersistedState` test failed once on the fleet.** "keeps its value across a
  remount, lab-scoped outside a trial" read `'shape'` where it expected `'color+'`, in a full run
  of `9c526ca33` on 2026-10-11 that passed 19,793 others; alone on this machine at that commit
  the file passes 6 of 6. Not rerun on the fleet.

- **(P3) Browser tests time out on the fleet, a different handful each run.** Across six full runs
  on studio and teitou on 2026-10-11, each of these failed once or twice with a 15 s test timeout
  or a `locator.screenshot` timeout, and passed in the runs around it:
  `Prefs/PrefsForm.drop.browser.test.tsx`, `labkit/src/lightbox/Lightbox.browser.test.tsx`,
  `labkit/src/controls/compoundRows.browser.test.tsx`,
  `PatternPicker/PatternPicker.browser.test.tsx`, and
  `core/src/features/text/overlayAlignment.browser.test.tsx`. The last two pass when run alone
  on this machine at the commit that failed. `labkit/src/lab/LabLightbox.browser.test.tsx`
  ("an expanded trial keeps its marks over it and takes new ones") hit the 15 s test timeout on
  teitou in two of four full runs on 2026-10-11, at `68e9d70bb` and `de222e61f`, and passed in
  the two between; alone on this machine at `de222e61f` it passed 3 of 3. It hit
  the same timeout on msb-uai at `4c93cc185`, the only failure of that run, and took 1.3 s alone
  here at that commit. `compoundRows` failed
  twice the same evening on an assertion, and its wait was hardened in `de222e61f`; it then hit the
  15 s test timeout once on msb-uai at `076c8ab87`, the only failure of that run. Outside the
  `browser` project, `forge/src/vite/plugin.test.ts` ("serves the component graph from source, and
  pushes it again when a component file changes") failed once on studio at `bff047e78`: the graph
  had not followed a rewritten file inside the 15 s it polls for. It passed on teitou at the commits
  either side. A second test in that file ("titles a native story by its meta when forge's meta
  reaches it through a helper module, and re-decides when the helper changes") failed the same way
  on teitou at `8f86cc034`, the only failure of that run: the index had not followed the rewritten
  helper inside its poll. On 2026-10-12 the file failed on the fleet at `af9f3db6b` and then alone on
  orochi, where it is not load from the suite: 2 of 3 runs failed at `af9f3db6b`, up to five tests
  each, and 1 of 2 at `29dfa85eb`, every failure a test that writes a file and waits 15 to 20 s for
  the server to follow it. A site dev server on orochi that evening also served a file as it was
  before an edit, and a `touch` did not wake it, so there the watcher missed the write. `browser`
  timeouts on the same fleet runs added `SelectionPanel/SelectionPanel.selection.browser.test.tsx`
  and `PrefSchemaEditor/PrefSchemaEditor.types.browser.test.tsx` to the list above. Measured 2026-10-12, nine full runs at one
  commit, three on each of studio, teitou, and msb-uai: with `browser` run after the other
  projects (`sequence.groupOrder`, now on `main`) none of six runs had a timeout, and one of three
  baseline runs did (`overlayAlignment`, on studio). That is suggestive and no more: at a one in
  three rate six clean runs come up about 9% of the time. It cost 12 to 52 s a run on teitou and
  msb-uai and nothing on studio, which takes about 175 s either way against 100 to 115 s on the
  others and hosts a long-running render service; both failing runs were there. A 15 s `browser`
  timeout in a run made since would mean running beside the other projects was not the cause, and
  the `groupOrder` line should come out. Not measured: fewer workers for `browser`, and whether
  studio's own load is the cause. The `PrefsRail` failures were a different thing, a bug in
  `useScrollSpy`, fixed in `addb11568`.

- **(P2) A docs minisite per package: overview, guides, and demos.** The API reference half is
  built: `npm run build:api` documents every published package in one TypeDoc site at `/api/`,
  each package a module with its README as the landing page. Still to design: an overview and
  hand-written guides per package (only labkit has any, in its own VitePress site), and the
  demos that exercise a package shown from its pages. Rendering TypeDoc's JSON output inside the
  site's own shell is the route that puts all four in one place.
- **(P2) The API reference build reports warnings in the packages it newly covers.**
  `docs/conventions.md` says `npx typedoc` reports none; that held while it read only core.
  Most are a documented export referencing a type its barrel does not export, each one a call
  between exporting the type and listing it under `intentionallyNotExported` in that package's
  `typedoc.config.mjs`. 91 warnings remain as of 2026-10-11: 87 of that kind, `{@link Field}`
  in ui's `Input` and `ComboBox` props (unresolved only where labkit re-exports them), and
  `{@link KEEP}` in `PrefSchemaEditor/schemaExport.ts`.
- **(P3) A symbol core re-exports from a sibling is documented twice.** `ClaimableGesture` has a
  page under `@weasel-js/core` and another under `@weasel-js/gestures`, with the same text.
  TypeDoc's `packages` strategy converts each package on its own, so core's copy is a full
  declaration, not a pointer. Type references do cross: core's pages link into the sibling's.
- **(P3) SVG export writes wrapped text as one line.** `data-weasel-wrap` round-trips `TextStyle.wrap` for weasel's own reader, but SVG `<text>` never wraps, so any other reader draws a wrapped node as its unbroken lines. Exporting the laid-out lines needs fonts at serialize time, which `@weasel-js/svg` does not have. A justified node is written at its start edge with `data-weasel-align="justify"` for the same reason: once lines are exported, its wrapped lines need per-word `x` placement too, since `text-anchor` has no justify.

- **(P2) draw: Open adds the file to the current document instead of replacing it, and keeps the old
  filename.** Open an SVG into a non-empty document and both sets of shapes are on the page; the
  undo entry is labeled "Import SVG" while the button says "Open". The filename stays the previous
  document's (`parsedToDoc` returns `title`, `pickSvgFile` drops `file.name`, and `onOpenSvg` in
  `apps/draw/src/App.tsx` reads neither), so the next Save downloads under the wrong name. Paper
  size and background are already taken from the file, which only makes sense for a replace.
  Options: Open replaces (clear the scene in the same batch, take the filename from the picked file,
  reset the background to white when the file names none) and a separate Import appends; or the
  button is renamed Import and stops adopting the file's paper size and background.

- **(P3) AnimationDemo: the demo builds and mutates its own adapter because the animation wrappers
  have no canvas seat.** `apps/site/demos/AnimationDemo.tsx` spreads `sceneToAdapter(scene, {
  selection })`, overrides `insertNode` / `removeNode` / `snapshotSelection` by hand, wraps the
  result in `animateOnSetPose` and `animateLifecycle` through two `as never` casts, hands that to
  `useSelectTool` / `useTools`, and then calls `adapter.setPose` / `adapter.insertNode` from button
  handlers, so those writes skip the op pipeline and undo. It also re-renders React once per
  animator tick (`bumpTick`) to repaint per-card scale and alpha. `<SceneCanvas>` should take the
  wrappers itself (an `animate={{ setPose, lifecycle }}` option, or a `SurfaceContribution` that
  wraps the adapter the canvas already builds), so the demo keeps `features={['pick', 'move']}`, its
  buttons call `scene.setPose` / `scene.add`, and per-node effects repaint through `redrawOn` /
  `requestRedraw`.

- **(P2) draw: the input recorder is reachable from nothing.** `recorder.ts`, `recordingIO.ts`, and
  `replay.ts` are complete and tested, and no control starts a recording or plays one. Wiring them
  needs a `Recorder` on the canvas's pointer and keyboard surface, which wants a
  `SurfaceContribution` with `attach` rather than a capture-phase listener in the app. The command
  bar's Record button, profile select, and Play button went with the no-op handlers behind them;
  `git log -S'Record input' -- apps/draw/src/CommandBar.tsx` has them.

- **(P3) draw: no toast host and no first-run notice.** Save failures and SVG import warnings go
  to `console.warn` (`onWarn` in `apps/draw/src/App.tsx`) where a toast should carry them. The
  command palette opens on Cmd+K and has no button in the command bar: `app.commands` has no
  icon, so it sits in no bar group. (Moved from the deleted `apps/draw/TODO.md`.)

- **(P3) draw: two owners for "which mode is the editor in".** The kit holds `textEdit.editingId`
  and `editAnchors.editingId`; the app holds a second mode machine
  (`apps/draw/src/modality/machine.ts`) whose `text-edit` and `path-edit` modes say the same thing.
  Two effects with `prev` refs in `apps/draw/src/App.tsx` reconcile text editing in each direction,
  and their comments record two shipped bugs from the split; path editing has no reconciling effect
  at all, and the kit papers over it by reading the mode
  (`packages/core/src/canvas/SceneCanvas.tsx`, the `effectivePathEditingId` block). A double-click
  is acted on by both the kit's `enterPathEdit` binding and the app's `onDoubleClick` observer. One
  owner: either the machine's `enterMode` / `exitMode` are the only callers of `startEdit` /
  `setEditingId`, or the kit's edit state drives the mode registry and the machine keeps only
  journals.

- **(P3) `apps/site/demos/RotatedResizeMathDemo.tsx` is 713 lines holding two jobs.** The four-panel
  ledger chrome and the resize math variants are separable. draw's `App.tsx` had the same shape and
  is split by job now; what is left in it is `EditorWithSharedScene`, one 500-line component.

- **(P3) draw: dead surface left in the tree.** `modality/backgroundClickPolicy.ts` has no caller
  outside its test, and a TODO in `App.tsx` says it waits on a hook into the dispatcher for
  background clicks outside normal mode. `PreferencesModal`'s `registryEnumSources` prop is never
  passed, so the one `registry-enum` pref (`LAST_TOOL` in `prefs.ts`, source `tools`) renders as
  free text through `RegistrySelect`'s fallback; a `tools` resolver needs the tool list, which the
  canvas holds and `App.tsx` does not.

- **(P3) draw: paper sizes and "no paint" are each defined more than once.** Paper sizes:
  `PaperSizeKey` (`CommandBar.tsx`), `WeaselDrawPaperSize` (`svgInterop.ts`), `PAPER_PRESETS`
  (`docPersistence.ts`), and two label lists that disagree: the New menu says "US Letter"
  (`PAPER_ITEMS`), the document properties say "Letter" (`PAPER_SIZE_OPTIONS`). One table of `{ key,
  label, width, height }` should feed all four; which label wins is a wording call. No paint: `{
  kind: 'none' }` in the color context's `ActivePaint`, `null` in node data, with `toFillStyle` in
  `ActiveSwatches.tsx` translating; `ActivePaint` could be `FillStyle | null` and the translation
  would go.

- **(P3) CustomShaderDemo: every frame re-renders React to move one uniform.**
  `apps/site/demos/CustomShaderDemo.tsx` calls `setTime` from its `useVisibleRaf` loop, rebuilding
  three uniform objects and re-rendering three `<SceneCanvas>` trees for a number only the shader
  reads (a test pins this at one commit per frame, down from more). The demo should keep `time` in a
  ref and ask for a repaint, which needs `<SceneCanvas>` to expose `requestRedraw` (or accept a
  `redrawOn` source) to a custom layer's owner without the demo reaching for the canvas ref in three
  places; a `useFrameUniforms(ref)` helper on the shader layer would absorb it.

---

## Backends (WebGL future)

From the WebGL transition spec — all deferred:

- **(P3) WebGPU backend.** Separate future spec.
- **(P3) Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win, significant API complexity. Defer until measured pain on the single-thread pipeline. (Note: `OffscreenCanvas` is already used on the main thread for pattern-tile rasterization in `packages/core/src/features/patterns/` — that's not worker offload; the worker move is the open item.)
- **(P3) Headless server-side rendering in Node.** The browser/worker headless path landed 2026-07-19 as `renderSceneToPixels` (`packages/core/src/canvas/renderSceneToPixels.ts`, public) — it accepts a caller-supplied `gl`, so it already works with an `OffscreenCanvas` in a worker. Remaining P3 scope is specifically Node: verify against a caller-supplied `gl` from `headless-gl` (untested there), or wire up a worker + `OffscreenCanvas` path for a Node-hosted consumer.
- **(P3) Screen adoption of mipmap image minification** — `imageMinification: 'auto'` on `WeaselRenderer` builds an image's mipmaps the first time a frame draws it at half size or smaller, so only an image that is drawn small pays for them. The screen path still builds its renderer with the default `'linear'` (`packages/core/src/canvas/canvasRenderer.ts`), and `<Canvas>` has no prop for it. Making `'auto'` the screen default changes the pixels of every minified image, so it needs the visual baselines regenerated and a look at a sprite sheet drawn small: trilinear filtering blends neighboring cells at the higher mip levels, which `'linear'` does not. The cost of `generateMipmap` on a large sheet is not measured. Never mipmap `GLTextureCache`; it holds MSDF atlases.
- **(P3) Gradient ramp resolution at print scale** — 1×256 LINEAR ramps verified adequate for 8-bit output (interpolation error < 1/255 per channel); revisit only if >8-bit output lands.

(WebGL1 fallback explicitly rejected — WebGL2 only.)

---

## Lint

A correctness baseline runs over `packages` and `apps` as of 2026-08-22, on
top of the scoped `no-restricted-imports` blocks that were previously the whole
config. Eleven rules, enumerated in `eslint.config.js` rather than spread from
a plugin `recommended` so a dependency upgrade can't change what's enforced.
`npm run lint` gates it in CI.

Turning it on cost ~100 fixes and found real bugs: six Badge effects called
`useId` after a `variant` early return, so a variant round-trip remounted them
and changed the `<clipPath id>` their gradients point at; `Canvas.tsx`'s paint
effect closed over a stale `helpersForLayers`; `useDeviceProfile` ignored a
provider-supplied `targetScale`; and a bare `Function` cast in `slice.test.ts`
was hiding an assertion that read `.space` without narrowing.

Deferred, with the rationale in `eslint.config.js` next to each:

- **(P3) eslint-plugin-react-hooks v7 compiler rules still off.**
  `static-components`, `use-memo`, `globals` (outside tests) and
  `set-state-in-effect` are on; each effect that sets state legitimately says
  why in its disable comment. The rest:
  - `refs` — 387 reports; reading a ref during render is how a canvas library
    reaches frame state, and there is no writes-only mode
    (`weasel/no-render-ref-write` covers writes).
  - `immutability` — 52 reports, none a defect: `useVisibleRaf` loops
    re-requesting themselves, and writes to forwarded refs, DOM nodes and
    mutable engine objects.
  - `preserve-manual-memoization` — reports where React Compiler would bail,
    and nothing here is compiled.

`eqeqeq`, `@typescript-eslint/no-unused-vars` and
`reportUnusedDisableDirectives` are all on as of 2026-09-05. The counts that
had them recorded as large sweeps were measured with the rules' strict
defaults: every one of the 317 `eqeqeq` reports was a `== null`, and 135 of the
136 unused-vars reports were the `_`-prefixed discards this repo already writes
deliberately. Configured to match those two conventions, the whole sweep was
one dead `const` and four stale disable directives.

---

## Release-gate & build hygiene

- **(P2) Two browser tests timed out once in a fleet run, each inside a Playwright action.** On
  studio at `9df030cfa`, 2026-10-11, with 19,605 other tests and the gate passing:
  `PrefSchemaEditor.types.browser.test.tsx` ("a list's entry is edited inside the attributes
  pane…") spent 14.5 s in `userEvent.click` after the tree row was found and scrolled to, and
  `core/src/features/text/overlayAlignment.browser.test.tsx` ("sans-serif 16px lands on the canvas
  glyphs") spent 7.8 s in `page.screenshot` waiting for the element to be stable. The first passes
  alone in 0.3 s. Two unrelated files failing the same way in one run reads as load, which nobody
  has confirmed; `AssetEditor.steps.test.tsx` has also timed out at 5 s under load and passed
  alone.

- **(P2) HUD vs DOM text: what the idle rerun left open.**
  `tests/perf/hud-vs-dom.spec.ts` now prices the HUD against plain DOM, a
  React overlay, and a DOM layer moved as one element, on an idle node
  (`tests/perf/README.md`, "HUD text against a DOM overlay"). Two things are
  still open:
  - **The HUD's 5,000-glyph readout gets the fewest frames** — about 70 ms
    apart under every camera, against 43–61 for the DOM — while its traced
    busy time is the lowest, about 9 ms per frame. Either the headless frame
    scheduler or a thread the trace analysis does not count (renderer worker
    threads, for one) accounts for the rest; nothing has checked which. Until
    it is, none of the frame intervals can be read as a display's frame rate.
  - **A static label on a fixed camera still favors the DOM**, 1.38 ms of main
    thread against 0.33 at 5,000 glyphs, because the renderer walks every
    unchanged text command each frame. A layer-level skip for a HUD whose
    widgets are all unchanged would need `content` painters kept out of it.

- **(P3) Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one is desired. Today's barrel test (`packages/core/src/index.barrel.test.ts`) asserts parity for op factories, shape kinds and the `features` presets; public exports remain uncovered.

- **(P2) What still breaks the batch, now that a rect clip does not.** A group
  clipped by an axis-aligned rect no longer flushes: `batchClip.ts` cuts staged
  quads to the rect on the CPU. Measured on teitou (Apple M5 Max, ANGLE Metal),
  2026-10-06, one frame a task, each sample ending in a one-pixel `readPixels`
  so the GPU's own time counts; the result files are in
  `tests/perf/recorded/render-cost-2026-10-06/`.

  | at 60 Hz, `frame-budget.spec.ts` | before | now |
  |---|---:|---:|
  | clipped groups, depth 1 | 3,424 | 83,968 |
  | clipped groups, depth 4 | 2,080 | 42,496 |

  The before column is the renderer ahead of the rect-clip change, measured
  2026-10-04 through `gl.finish()`, which does not wait for the GPU
  (`tests/perf/README.md`, "Timing a frame"); its files are in
  `tests/perf/recorded/render-cost-2026-10-04/before/`. Re-measuring it means
  that renderer under today's timing, so the size of the gain is not settled.
  What is left:

  - **A run-breaker costs about 21 us a flush** (`flush-anatomy.spec.ts`),
    16 of it bind and draw; no other call in `flushBatch` moves it by more than
    its noise, about 1.2 us. So what remains is the draw count: synthetic bold
    and an eighth texture still break the run, and so does a color matrix
    around an image or a gradient. A solid or a glyph under a color matrix no
    longer does: its color is mapped on the CPU (`draw/foldColor.ts`), which
    paints the same pixel as the shader in headless Chromium
    (`colorMatrixFold.browser.test.ts`) and has not been timed. The specs that
    break a run with a matrix on solid rects (`flush-anatomy`, `clip-cost`,
    `flush-noise`) turn the mapping off through `colorFolding`, and have not
    been run since that edit. An image under a diagonal matrix with no bias
    could be mapped the same way and is not.
  - **A clip only the stencil can express still flushes on entry and exit**:
    a polygon, a rect turned off the axes, and a rect clip with a slanted item
    crossing it (`DrawBatch.clipQuad` says why a slanted edge cannot be cut).
    The stencil itself costs about 4.9 us a push and pop, 7.9 at 8 leaves
    (`clip-cost.spec.ts`).
  - **Caching `u_synthBold`, `u_samplers` and `u_fieldScale` was tried and
    reverted**, measured through `finish`: it saved about 0.1 us a flush on
    color-matrix breaks and made a frame of 20,000 stroked rects 30% slower,
    with both renderers interleaved in one page. The cause was not found.
  - **Changing kind costs 1.35–4.9 us a boundary** (`transition-matrix.spec.ts`):
    text and gradient the least, shader (4.9) and vcolor (4.4) the most. Pairs
    whose kinds share a batch cost nothing extra; the rest add 8–16 us, with a
    run-to-run spread up to 9.7 us, so the spec ranks pairs but does not price
    one.

- **(P2) A ring of buffers measures slower than rewriting one.**
  `SOLID_RING_SIZE` (64) exists so a flush never writes a buffer a draw is
  still reading. On teitou (Apple M5 Max, ANGLE Metal), 2026-10-06, four passes
  back to back in ABBA order, a quad that ends its run (`image-quad`,
  `renderer/unmerged`, 20,000 a frame) cost 22.50 and 21.99 us through a ring
  of 64 against 17.75 and 18.09 through a ring of 1, with no overlap between
  the sides' samples; `flush-anatomy` did not separate them. Result files:
  `tests/perf/recorded/ring-size-2026-10-06/`. Only one GPU and backend has
  been measured, and the ring's own case was made on an M2 Max by the retired
  block method; D3D and Vulkan backends are where an in-flight buffer write
  would stall, if anywhere.

- **(P3) The mesh batching caps are measured on one GPU.** A mesh joins a run
  up to `MAX_BATCHED_MESH_VERTICES_IN_RUN` (1,024) vertices when one is open,
  and up to `MAX_BATCHED_MESH_VERTICES` (96) when none is
  (`packages/renderer/src/draw.ts`). `tests/perf/mesh-batch.spec.ts` times
  256 convex meshes a frame, batched against drawn alone:

  | Frame | Break-even, two passes (vertices) | At 256: alone less batched (us/mesh) |
  |---|---:|---:|
  | meshes back to back | 136 and 92 | -2.36 and -1.00 |
  | a rect before every mesh | 1,488 and 1,724 | 26.31 and 21.02 |

  Drawn alone among rects, a mesh costs 26–37 us whatever its size, because it
  closes the rect's run and switches program twice; back to back it costs
  1.4–6.7 us. Both caps sit below their break-even because being wrong on the
  open-run side costs about ten times more a mesh. A chain of mid-sized meshes
  that a small one opened stays batched, which is the cheap side of being wrong.
  Measured on teitou (Apple M5 Max, ANGLE Metal), 2026-10-07, at the spec in
  `2108ceb69`, two passes 20 minutes apart; load average 2–5 on 18 cores, with
  small fleet jobs overlapping. Result files:
  `tests/perf/recorded/mesh-batch-2026-10-07/`. Left: the same run on a D3D or
  Vulkan backend, where the break-evens may sit elsewhere.

- **(P3) What inside Chromium or ANGLE slows frames drawn back to back in one
  task** — 4–10x after about eight (`tests/perf/README.md`, "Timing a frame")
  — is unknown.

- **(P3) A consumer's `sampling: 'nearest'` costing up to 8x does not
  reproduce here.** They drew a 5652px atlas (~122MB) and saw nearest cost
  8.11x linear at 2:1 minification, 5.98x at 1.33:1, 1.08x at 1:1 and 1.14x
  magnified, in single runs on a contended box. `atlas-wall.spec.ts` with
  `WEASEL_PERF_SHEET=5652` builds sheets that size, cells sampling tiles across
  all of it. On teitou (Apple M5 Max, ANGLE Metal), 2026-10-07, at
  `48f473a66`, in ABBA passes against our 0.1–3MB sheets, 5 runs a pass,
  nearest over linear was:

  | Sheet | Pass | 1:1 (56px) | 1.33:1 (42px) | 2:1 (28px) |
  |---|---:|---:|---:|---:|
  | 5652px | 1 | 1.30 | 1.20 | 0.66 |
  | 3MB    | 2 | 1.11 | 0.97 | 0.77 |
  | 3MB    | 3 | 1.17 | 1.68 | 1.11 |
  | 5652px | 4 | 0.63 | 1.08 | 1.25 |

  Every ratio, magnified rungs included, falls between 0.6 and 1.7 either way
  with no trend in sheet size or minification. The frames are 0.2–0.6 ms,
  where 0.1 ms is noise; an 8x would be 3 ms and could not hide. That matches
  the code: `GLImageCache` uploads with MIN_FILTER LINEAR and no mipmaps, and
  `sampling` reaches GL only as `setMagFilter`, which skips a value the texture
  already holds. Result files: `tests/perf/recorded/atlas-wall-sheet-2026-10-07/`.
  What is left is their side: whether their build predates `fee0c98db`
  (which stopped re-asserting MAG_FILTER per flush), their GPU and backend, and
  their dpr. Only their harness can answer it.

- **(P3) Whether the batched path costs a co-tenant on the same page.**
  Unverified here, and reported rather than measured. A consumer benchmarking
  its wall against a canvas2d control found that at one rung the *canvas2d*
  side went from ~8.8 ms to 102-160 ms, and only when the page also held a
  build with the merged batch. Reproducible in both directions.

  Its seven rungs narrow it to an interaction rather than to either cause
  alone. Five rungs share one byte-identical 12MB atlas, and only the densest
  of them is anomalous — canvas2d costs 160.4 ms at 16px / 2,700 commands
  against 5.2 at 24px / 1,419, on the same sheet. So it is not residency. The
  two rungs with *more* commands, 8px at 7,500 and 12px at 4,275, are fine on a
  smaller sheet, so it is not command count. What is unique is the pair: the
  most commands anyone draws against the large texture.

  Two axes move together across that ladder and want separating. Holding the
  cell at 16px and drawing fewer of them varies command count at a fixed 2:1
  minification; drawing 24px cells until the count reaches 2,700 varies the
  sampling ratio at a fixed count. Density of access to a large texture is a
  texture-cache story, not a memory-pressure one, and 16px is where a 32px tile
  is minified hardest by anything drawing that many of them — `GLImageCache`
  sets MIN_FILTER to LINEAR and generates no mipmaps on the screen path, so a
  minified draw scatters its taps.

  **Run the control first.** Every number in it is canvas2d on a page that also
  holds a WebGL2 context. Nobody has measured that rung with no GL context at
  all, so "the batch costs its co-tenant" and "this rung is expensive whenever
  GL is resident, and the batch only changes the timing" are not yet separated.
  That is one run and it could retire the entry.

  Worth chasing because a real app is a co-tenant too: weasel beside a chart
  library, or two surfaces on one page.

- **(P3) Per-layer GPU dispatch skipping.** `RenderLayer.deps`
  (`packages/core/src/core/layers/render.ts`) skips rebuilding a layer's
  command tree, not submitting it: every layer still goes through
  `WeaselRenderer.render` every frame. Skipping that means drawing each cached
  layer into its own texture once and compositing one quad per layer, which
  the renderer has no concept of today.

  Measured: **compositing a cached layer is cheaper than resubmitting it once
  the layer holds more than about 130–250 commands**, at every layer count
  from 4 to 64. Below that, resubmitting wins, by up to 7 ms at 64 layers of
  10 commands. At 64 layers of 1,000 commands, submission costs 58 ms a frame
  and the composite 5.4. With a single layer the composite costs nothing
  measurable, so it never loses there.

  `tests/perf/layer-dispatch.spec.ts` times `N` unchanged layers of `M`
  commands (half solid rects, a quarter text labels, 15% images, 10% linear
  gradients) through `drawLayers` with a warm command cache, against a frame
  holding only one live rect. The composite stands in for cached layers with
  one canvas-sized image per layer, which batches 7 to a draw. Canvas
  1280x800 at dpr 2. ms a frame over that control, two passes (`pass 1 / pass 2`),
  each the median of 3 runs:

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

  Interpolating linearly between the 100 and 300 rungs, the crossing falls
  at 143 / 210 commands for 4 layers, 245 / 217 for 16, and 131 / 128 for 64.
  Submission runs about 0.75–1.2 us a command from 300 commands a layer up;
  the renderer's own `render()` time is about a third of that, and the rest is
  the GPU process and the GPU. A composited layer costs 0.08–0.25 ms, almost
  none of it in `render()` (0.04–0.09 ms for the whole composite frame).

  **With one layer changing every frame, the crossing moves to about 300
  commands a layer, and past 1,000 for a single layer.** The changed layer
  draws into an offscreen buffer as a group with one copy effect, then
  composites with the rest (`compositeDirty`), against submitting every layer
  with that one's `deps` changing (`submitDirty`). The copy is a full-buffer
  pass a real layer texture would not need, so the composite side is an upper
  bound. ms a frame over the control, `pass 1 / pass 2`:

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

  A dirty layer adds 0.4–3.5 ms to the composite frame, most at 16 layers;
  submitting barely notices it, since rebuilding one layer's command tree is
  cheap next to submitting it. Full rows are in the result files.

  Still left out, both counting against building it: the texture memory, 16 MB
  a layer at this canvas size (1 GB at 64 layers); and quads bounded to a
  layer's content rather than the whole canvas, which would cost less fill and
  memory than measured here.

  Unexplained: the composite frame is identical down a layer count, yet it
  falls from 3.6 to 1.7 ms at 16 layers and 7.5 to 5.4 at 64 as the submit
  frames interleaved beside it get heavier. One reading, not checked: heavy
  neighbors hold the GPU at a higher clock. And one composited layer measures
  near zero while four measure 0.5–0.9 ms.

  Measured on teitou (Apple M5 Max, ANGLE Metal, headless Chromium 153),
  2026-10-07, at the spec in `7e16a79d7`, and the dirty rows at `a91417aea`,
  whose clean rows reproduce the first run; load average 2.4–4.3 on 18 cores,
  no other fleet job running. Result files:
  `tests/perf/recorded/layer-dispatch-2026-10-07/` and
  `tests/perf/recorded/layer-dispatch-dirty-2026-10-07/`. One GPU and backend
  only.
- **(P3) The pull request benchmark job has never run.** `.github/workflows/perf-pr.yml` runs
  `perf:bench` and `test:perf` on a pull request's base and head and posts the `perf:compare` table
  as a comment, without gating. It was written on 2026-10-11 with no pull request open to try it on:
  the comment and directory-compare scripts are tested, the workflow steps are not. Unmeasured: how
  long two full runs take on the one self-hosted machine (the job allows 100 minutes), and whether
  the base, measured first, reads differently from the head for that reason alone.

- **(P3) Overlays sit on two unrelated z-index scales.** The theme defines `--wzl-z-toolbar`,
  `--wzl-z-overlay`, and `--wzl-z-modal` as 10, 20, and 30. `Dialog` (1000), `Toast` (1100),
  `Tooltip` and `Callout` (1200), core's debug HUDs (900), labkit's `DragGhost` (9999), and
  `pointerDrag`'s cloned ghost (10000, set in script) are literals; ui's `DragGhost`, labkit's
  `Lightbox`, `ViewportRegion`, `LabSwitcher`, and `LabShell`, and draw's HUDs read the tokens. So
  the token named "modal" is below every real modal, a consumer retuning `--wzl-z-modal` moves the
  lightbox and none of the dialogs, and ui's `DragGhost` (20) dragged out of a list inside a
  `Dialog` (1000) can draw behind it. Extend the ladder to the layers that exist (hud, modal, toast,
  popover, drag) and have every site read a token.

- **(P3) labkit inlines siblings that own module state.** `packages/labkit/tsup.config.ts` bundles
  every `@weasel-js/*` sibling except core and theme, and its own comment gives the reason those two
  are external: a module-global registry inlined twice is two registries. The same holds for
  `@weasel-js/quantity` (`registerDisplayKind` writes a module-level map, so a kind an app registers
  is unknown to the copy inside labkit's `dist`, and `displayKindOf` falls back to decimal without a
  warning), `@weasel-js/storage` (`memorySubscribers`), and `@weasel-js/ui` (`RecentColorsProvider`,
  the overlay portal host). labkit also lists those siblings as `dependencies`, so a consumer
  installs one copy and runs another. In the repo, aliases resolve both to one source, so no test
  can see it.

- **(P3) Dev aliases, tsconfig `paths`, and `exports` are three hand-kept maps that disagree.**
  `scripts/vite-aliases.ts` sends `@weasel-js/<pkg>/<tail>` to `packages/<pkg>/src/<tail>` for any
  tail. `@weasel-js/diagram/layout` is published from `src/layout.entry.ts` and the alias resolves
  it to `src/layout.ts`, a different module with different exports; `@weasel-js/labkit/weasel-ui`
  works only where a config overrides the alias by hand; and a subpath no `exports` map publishes
  resolves in every dev server and test (`@weasel-js/labkit/styles.less` in seven app and demo
  files, `@weasel-js/labkit/theme/interstellar` in `apps/forge/themes.ts`).
  `packages/core/tsconfig.json` maps nine siblings to source and leaves `paint`, `text`, `font`,
  `cursor`, `quantity`, and `prefs` to resolve to their built `dist`. Generate the aliases and the
  `paths` from each package's `exports` and build entries, and reject a subpath that is not
  exported.

- **(P3) Most stores still keep their own listener set.** `createEmitter()` in `@weasel-js/registry`
  is the shared subscribe/notify primitive (a pass walks the listeners held when it began; a
  throwing listener is logged and the rest run), and the reflectable registry, modes' scoping layer
  and decorations, and core's pose overrides, pose feed, reflow, parallax plane, and key state use
  it. Still hand-rolled, each a `Set` and a loop: the scene (four loops in `core/scene/scene.ts`),
  `PointerContext`, `useSliceTool`, history and its journal, `select/store.ts`, prefs' store,
  storage's records, routing's `longPressState`, loupe's `canvasSource`, ui's `recentColors`,
  labkit's `panelHost`, `clockRegistry`, and `cameraRegistry`, and seven in forge. history, select,
  prefs, storage, routing, and loupe do not depend on registry yet.

- **(P3) Three drag-ghost implementations.** core's `pointerDrag` `defaultGhost` clones the source,
  ui's `DragGhost` portals to the themed host, and labkit's `dragdrop/DragGhost` is a third. They
  sit at three stacking levels, and only ui's corrects for a transformed containing block, so
  labkit's and core's `position: fixed` ghosts are offset inside a transformed ancestor (read from
  the CSS and the clone code, not rendered). labkit's should render ui's.

- **(P3) `check:spacing` reads only `packages/ui/src`.** Walked over every package and app
  stylesheet on 2026-10-11 it reports 300 spacing literals that have a rung: 220 in `apps/site`, 51
  in `apps/theme-editor`, 18 in labkit's `.less`, 5 in core, 3 each in forge and `apps/draw`.
  Widening the walk means moving those to tokens first, and each move wants a look at the page.
  `check:controls` already walks all of them.

- **(P3) `SceneCanvasInner` is one 1,370-line function.** `canvas/SceneCanvas.tsx` is down to
  1,550 lines: its props type, coordinate trace, and the mounters and registrars are files in
  `SceneCanvas/` now, and what is left is the inner component, which wants breaking into hooks by
  concern rather than moving. `draw.ts`, `scene.ts`, `Canvas.tsx`, the two dispatcher files, and
  draw's `App.tsx` have their own entries.

