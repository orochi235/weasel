# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@weasel-js/core`). The
kit aims to be a generic 2D scene-graph foundation. Items here are evaluated
for cross-app reuse, not consumer-app value.

For history of completed work, see `git log` and the dated specs under
`docs/superpowers/specs/`. Plans are deleted when their work merges.

When work merges, retire its entry here in the same change.

Priority tags:
- **(P1)** — foundational genericity gap; the kit can't do this today
- **(P2)** — broad reuse, or friction-likely
- **(P3)** — specialized, or resting on a foundation not built yet

---

## Tools & gestures

- **(P1) "Tool" still names two things outside the kit's own code.** Inside the kit it now
  means one: a contribution that can hold focus, picked from a palette or held on a key
  (`isTool`), and every container holding any entry says "entry" (see "Tool" in
  `docs/taxonomy.md`). Still undecided:
  - a command given a place on a tool rail: forge's Info, labkit's `ToolItem` with `onActivate`.
    It takes a palette slot but holds no focus and binds no input;
  - `select`, which only chooses: pick, marquee, clear. It is a tool by the definition above,
    though acting on the selection belongs to the always-live contributions in
    `selectionContributions.ts`.

  A bare `<SceneCanvas>` now only renders, and `features` presets turn behavior on
  (`canvas/SceneCanvas/features.ts`). Still waiting on the answer:
  - **Presets are coarser than two demos want.** `pick` is the only way to get the selection
    outline, so a demo supplying its own select tool (LayerList, MultiSelect) still mounts
    `pick`'s built-in one unused. `transform` brings rotation with resize, so a resize-only
    demo (PointSnap hides the rotation handle in its layer config; Text doesn't) can't ask
    for half.
  - **`features` now names two things.** The `<SceneCanvas features>` prop is unrelated to the
    `features/` source directories `docs/taxonomy.md` describes, and the two will be confused.
  - **`edit` cannot paste from the keyboard alone.** Cmd/Ctrl+V arrives as a DOM `paste`,
    which only `ingest` binds; `clipboard.paste` is the button-and-menu half.

- **(P3) `Widget.claims` is static.** A widget that is decoration in one mode
  and interactive in another can't change what it consumes without being
  swapped out. `claimsPointer` folded into `claims` on 2026-08-12, so this is
  one field rather than two, but it is still a declaration read at hit-test
  time. Fine while `rect` / `text` / `image` are unconditionally decorative;
  revisit when a stateful-claims widget appears.

- **(P3) apps/draw binds no mode-entry shortcut.** `modeShortcuts` (routing) binds a
  mode's `entry` chord when the consumer passes `enter`, and draw passes only the
  leaving roles. PATH_EDIT's Enter can't simply enter the machine's mode: the
  anchor editing it exists for keys off the kit's `editAnchors.editingId`, which only
  `enterPathEdit`'s double-click sets, so Enter would light the mode with no editable
  anchors. Draw also still enters every mode from `SceneCanvas`'s `onDoubleClick`
  observer rather than from `entry.trigger`, which nothing reads.

- **(P3) A press on empty canvas can't be an ambient binding beside the select tool.**
  `select.pick` binds `pointerDown` on empty space at active scope, and active
  outranks ambient, so an ambient contribution's `pointerDown` never fires while
  select is active. With no base tool it works: `CustomShaderDemo` spawns its
  ripple from an ambient binding on a bare canvas.

- **(P3) `targetConsultsAffordance` still guesses from shape.** The kit's four
  body predicates now carry `readsAffordance: false` and the filter honors it
  (2026-08-12), so the counterexamples the kit itself ships are handled — which
  they had to be, since `doubleclick` now carries an affordance and
  `enterPathEdit`'s `kindOf: isBody` would otherwise have entered path-edit
  mode on a double-click over HUD chrome. A *consumer* predicate that reads
  only `bodyTarget` and declares nothing still survives a claim that should
  bar it. The open question is whether the filter should infer at all: require
  the declaration, or have `TargetSpec` carry the answer instead of the
  predicate.

- **(P3) Unconfirmed: resize grabs the node under the handle, not the selected one.**
  Reported 2026-07-28 against **lbx-editor**, then on `@weasel-js/core@0.6.0` from
  npm — a build that still ran the **phase-table pipeline deleted on main**
  (`adc17bec`), where affordance hits reached actions through `composeAffordanceLayer`'s layer
  `hitTest` rather than through `affordanceAt`. lbx-editor also passes
  `selectTool={{ rotate: false }}`, and that older mechanism needed the rotate tool
  mounted as `ambient` to see selection chrome at all — a plausible mechanism for
  the report, and one that no longer exists.
  **Not reproducible on main.** Five configurations in apps/draw — overlapping node
  above the handle, rotated selection, click-without-drag, multi-select union
  handle, several zooms — all dispatch `resize` against the selected node with the
  selection intact. `select.pick` declines chrome in its *spec*, so a press carrying
  an affordance never reaches it, and the hit radius is scale-corrected.
  lbx-editor has since taken the bump: it pins `^0.7.2` (lbx-editor `87a6242`,
  2026-08-01), which contains `adc17bec`. Re-test there; close if it's gone.

- **(P3) SVG-file ingestion — follow-ups.** Shipped 2026-07-04: `kit:svg`
  content handler (`packages/core/src/features/ingestion/svgHandler.ts`, priority -90 —
  ahead of `kit:image`, behind consumer handlers) matching `image/svg+xml`
  plus `.svg`-extension sniff for empty-MIME files. Default keeps a dropped
  SVG as **one embedded-image node** (`data:image/svg+xml` URI, bytes
  verbatim; measured via an `Image` element since `createImageBitmap`
  rejects SVG blobs, 300×150 fallback for no-intrinsic-size files).
  `ingestion={{ svg: { unpack: unpackSvgFiles } }}` parses to native scene nodes
  instead (`@weasel-js/svg`'s `unpack.ts`: kit-painter-native path/text leaves under
  containers mirroring `<g>` structure, multi-root files wrapped in one
  container, pose-only fit-clamp + drop-point placement, one undoable
  batch per file). weaseldraw runs with `unpack` on, and its file-menu import
  and export carry `<image>` as an image object. An embedded SVG
  re-rasterizes at its drawn size (see `features/images/README.md`).
  Remaining: check in a browser that it actually looks sharp at zoom — so far
  only jsdom has.

- **(P3) External-content ingestion — follow-ups.** Shipped 2026-07-03 (spec
  `docs/superpowers/specs/2026-07-03-content-ingestion-design.md`): drop/paste
  gesture kinds (`DropSpec`/`PasteSpec`, MIME-glob `types`), dispatcher DOM
  channels (drop/dragover/dragenter/paste + `weasel-dropover` class), ambient
  `ingest` action, content-handler registry (`packages/core/src/features/ingestion/`,
  refcounted kit-handler registration), kit `image/*` handler (data-URI embed
  / `resolveSrc` override, fit-clamp, cascade), `openFilePicker`,
  `SceneCanvasApi.ingest`, `<SceneCanvas ingestion={…}>`. Remaining:
  (a) richer drag-over feedback (insertion ghost / per-handler accept cursor —
  v1 is the class toggle); (b) SVG-file drop → shipped 2026-07-04, see the
  SVG-file ingestion entry above; (c) kit `text/plain` handler → text-node
  insert. Unblocked 2026-07-23: `text` is now a kit-native insert kind
  (`useInsertDepSource` `case 'text'` mints `{ text }`, defaulting content to
  `''` and reading `extras.text` when present). Remaining for the handler
  itself: a dropped/pasted string has no drag rect, so the handler must choose
  a **box size** — either measure the string (needs a text-measure context) or
  default to a fixed box and let edit reflow it. Whether we even want
  drop/paste-text-to-canvas is an open question.
  Closed 2026-08-16: (d) `drop` and `paste` are route-grammar gesture names,
  targetless, carrying the MIME-glob filter as their arg (`drop(image/*)`);
  (e) paste now dispatches first and `preventDefault`s only on `'handled'`,
  wheel's shape — clipboard items materialize synchronously, so unlike drop the
  result is known while the default can still be suppressed, and a paste no
  binding wanted stays the page's.

- **(P3) The image and SVG drop handlers could leave core.** `kitImageHandler`
  / `embedFilesAsImageNodes`, `kitSvgHandler` (which reuses the image embed) and
  `openFilePicker` in `packages/core/src/features/ingestion/` are about 310 lines
  no kernel path needs; the registry, the `ingest` action, the `ingestion` dep
  and the weasel-JSON handler stay, since Cmd+V of the canvas's own content runs
  through them. Moving them makes a file drop do nothing on a bare
  `<SceneCanvas>` until the consumer installs the handlers. Deferred 2026-09-28
  because the package would be thin and no name is settled (`ingest` was turned
  down).

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

### Cursor package follow-ups

All four arcs of `docs/superpowers/specs/2026-09-03-cursor-system-design.md`
have shipped. What remains:

- **(P3) Cursor rasterization is measured only in Chrome.** Headless WebKit
  and Firefox parse, fetch and pick `image-set()` candidates exactly as Chrome
  does (spec, "WebKit and Firefox, headless"), but whether headed Firefox and
  Safari rasterize an SVG cursor at 1× or cap below 128 px needs a real window.
  `node probe.mjs <dir> --browser firefox` and `--browser safari` in
  `packages/cursor/scripts/probe/` do it (README). Not runnable on the fleet as
  of 2026-09-28: keiei, msb-uai and studio all sit at a locked screen, and the
  `onto` agent (`~/.local/bin/onto`) has neither Screen Recording nor
  Accessibility on any of them — `warp check` reports all three. Headed
  Playwright Firefox also captured the bare-`crosshair` control as the arrow
  on orochi; the probe now refuses to report until that control passes, so
  the first run on a granted node answers whether that was focus. A finding
  lands in `bake.ts`.

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

- [x] **Viewports as a first-class canvas concept — landed 2026-08-23.**
  `<CanvasView>` (`c91e186d`) is a second camera on one canvas: `SceneCanvas`
  takes `views?: readonly CanvasViewProps[]` and routes input through a
  `ViewIdResolver` in `useGestureDispatcher`, with per-pointer gesture pinning.
  You can drag a node inside a PiP. The four semantic questions this entry used
  to list were each answered by a named commit — pinch and hover route to the
  view under the pointer (`4ac9273b`), a view hit-tests its own chrome
  (`726f85e0`), selection is per-view (`7c202d28`). Tests:
  `packages/core/src/canvas/CanvasView.test.tsx`.

- **(P3) Views do not nest.** A view paints and routes the surface's own stack,
  never another view, and a loupe magnifies the canvas's camera — aimed over a
  `<CanvasView>` panel it shows and edits the canvas's world, not the panel's.
  Composing would mean a view's camera derived from the view under its aim, and
  a resolver that descends rather than picking one rect.

- **(P3) A `{ px }` stroke on a line that is not axis-aligned has no exact
  width under non-uniform zoom.** A ribbon is tessellated in world with one
  width, and `withResolvedStrokeLengths` (`renderer/draw.ts`) resolves `{ px }`
  through `meanScaleOf`, so at 4:1 a 1px hairline paints 2px wide vertically
  and 0.5px horizontally. Axis-aligned lines have an exact answer — the grid
  layer takes `pxExtent` on each line's cross axis — but a rect outline, an
  ellipse or a diagonal does not: `PanZoomDemo`, `ForceGraphDemo`,
  `ViewportDemo` and labkit's annotation point ring all divide by `meanScale`.
  The fix is the ribbon built after the view's linear part (path coords carried
  through it, stroked at `px`, drawn under the transform with that part
  removed), which touches the ribbon cache key, dashes, markers and the
  stencil-aligned polygon path. Picking reads ink widths through the same mean
  (`useSceneSelectTool`) and has to move with it.

---

## Paths & booleans

- **(P3) `@container` in `@weasel-js/svg` stylesheets.** `packages/svg/src/cascade.ts` evaluates `@media`, `@supports` and `@layer`, but skips a `@container` block whole, so its rules never apply. That is deliberate for now: a static parse lays nothing out, so no element is a size container and no query can hold. Applying them needs container sizes from somewhere — the root's viewport as the one container, or boxes supplied by the caller.

### Pathfinder follow-ups (post-v1)

Core five + Crop shipped. Remaining:

- **(P3) Outline.** Stroke-to-fill silhouette — needs proper offsetting with joins/caps/self-intersection cleanup. No lightweight JS lib without major deps. The same offsetting would let `textToPath` embolden synthetic-bold text, which it refuses today with `reason: 'synthetic-bold'`.
- **(P3) Trim and Merge.** Remove hidden portions / Trim + same-color reunion — need per-path style awareness, which the kit deliberately doesn't have since `data` is opaque. Wait on a compound-path-with-styles model.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** v1 flattens beziers before clipping; the result is straight-line. Skia/PathKit-style curve-preserving booleans are next-level — substantially harder.
- **(P3) Live preview during the gesture.** Holding the op key while hovering a path to see the result before committing.
- **(P3) Boolean ops on stroked paths.** Treat a stroke as a filled region, then clip. Blocked on stroke-to-fill (round/bevel/miter joins, end caps — its own design problem).

---

## Rendering & paint

- **(P3) A minimap's framing ignores pose overrides.** `<SceneViewCanvas>` and
  `<MinimapCanvas>` paint override poses as of 2026-08-25, but `computeFitView`
  still derives framing from document poses, so a node overridden outside the
  document bounds paints outside the fitted frame. Deliberate — recomputing the
  fit per frame would rescale the whole minimap through a drag or a settle, and
  costs an O(nodes) bounds sweep every frame. Revisit only if a consumer wants
  framing that tracks a simulation.

- **(P3) `GradientHandles` still draws its handles at a literal radius.**
  `MeshHandles` sizes its corners and controls from `--wzl-handle-size-lg` and
  `--wzl-handle-size`; `GradientHandles` keeps `HANDLE_RADIUS = 7`, so a ramp's
  endpoints are 14px across while a mesh corner beside them is 10px. Moving it
  onto the family is a visual call that wants a browser — it shrinks every
  gradient handle.

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

- **(P3) Promote `ShaderDrawCommand` past `@experimental`.** Three uses now exercise it (plasma / ripple / voronoi panels), which is enough to have validated the surface. Array uniforms take one flat value (`u_ripples: [x, y, t, …]`), and a re-registered source recompiles on each renderer's next frame. Left before stabilization: how to expose the renderer's program registry without leaking internals (`shaders` prop is the seam, but consumers writing custom RenderLayers may want more).

- **(P3) No marker icons.** `defaultNodeProperties`'s `markerStart` /
  `markerMid` / `markerEnd` leaves use a labelled `select`, where the sibling
  stroke enums (`cap`, `join`, `align`, `dash`) are icon toggles — authoring
  eight glyphs to this repo's icon standard is its own piece of work and was
  deferred out of the stroke-markers arc.

---

## Text

- **(P3) `.dfont` machine faces still can't reach the outline tier.** The
  *silence* closed 2026-08-16 — `isDataForkFont` recognizes a Macintosh
  resource fork by its header offsets and `sfntFromCollection` throws by name,
  so the face degrades to the SDF tier saying why. Actually reading the `sfnt`
  resources out of the map is unwritten and unreachable on current macOS (204
  `.ttf` / 128 `.ttc` / 38 `.otf`, no `.dfont`). Design record for the whole
  tier: `docs/concepts.md` ("Font outlines"); the settled argument for
  keeping container unpacking in `sfnt.ts` rather than upstreaming it or
  adopting fontkit is in that file's own header.

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

- **(P3) The character strip has no "no fill" chip.** WeaselDraw's text
  objects carry `fill: null` through its SVG export and import, and the
  sidebar's Fill leaf already offers None for a text node. What is missing is
  a None chip beside the strip's Color field, and it needs a decision first:
  the strip is range-scoped, but a run cannot be unfilled (`StyledRun.fill`
  is `FillStyle`, no `null`). Either the chip unfills the whole node (and has
  to clear run fills, which reach text outside the selection), or runs gain
  `fill: null` through `resolveRuns`, the DOM overlay, the range algebra and
  `@weasel-js/svg`'s `<tspan>` output.

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

- **(P3) Complex-script text shaping (HarfBuzz).** `packages/text/src/layout/layoutRuns.ts` walks codepoints linearly and applies BmFont kerning pairs — sufficient for Latin / Cyrillic / Greek / CJK ideographs, wrong for Arabic / Devanagari / Thai / any script needing contextual shaping or reordering. Real fix is wiring a HarfBuzz WASM build (harfbuzzjs ~1MB) behind a feature flag so consumers who only need Latin can stay slim. Touches the layout pipeline only; the renderer already takes pre-laid glyphs. Shaping is also what real small caps needs: `fontVariantCaps: 'small-caps'` is synthesized today (capitals scaled by x-height over cap height), and a face with an `smcp` feature should get its own small-cap glyphs instead.

- **(P3) `markdownToRuns` → AST.** Consider whether markdown markup (today `*`/`**`/`***` bold/italic toggles, parsed with flat boolean state in `packages/text/src/runs.ts`) should be promoted to a structured AST. The output is a flat `StyledRun[]`, not a tree. Defer to a future "rich text" pass — the current shape is sufficient for label/markdown rendering but limits reformatting / re-styling transforms.

---

## Scene, adapters & layout

- **(P2) `arrayAdapter` as the default Canvas adapter — full unification.** The Canvas-level synthesis tier this entry used to describe is gone — `Canvas.tsx` no longer takes `items`/`setItems`/`createDefault`/`poseBounds`/`intersectsRect`, and only `toPose` survives as a layer-config override. `arrayAdapter`, `useArrayAdapter` and `sceneToAdapter` are still three separate wirings. The deeper move — every scene is a tree rooted at one container — was taken by `useScene` (kit-owned tree with leaf/container) but the inline-props and explicit-adapter tiers still sit alongside rather than collapsed. Full unification (one adapter contract, one default wiring) remains an option for later.

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

- **(P3) `Scene<TData, TLayer, TPose>` is contravariant in `TPose`** via
  `clipFromPose` and `derivePath`, so no concretely-typed scene satisfies the
  action-facing `Scene<unknown, string, unknown>`. Pre-dates `derivePath` —
  `clipFromPose` has the same shape — and the action layer already reaches its
  scene through a cast everywhere, so nothing is blocked today.

### `useScene` follow-ups

- **(P3) Scene layout: what the first cut left.** A container declares its layout
  on its node (`ContainerNode.layout`), and the scene's one layout pass
  (`core/scene/layoutPass.ts`, run through the arrival window) applies it to every
  arrival, departure, reorder and resize, and to a layout swapped in by
  `scene.setLayout` / `createSetLayoutOp`. Still open: a declared layout is measured by
  `UseSceneOptions.layoutFrame` unless a canvas installs its handler, so a scene whose
  canvas composes poses or uses a custom descriptor states that twice — folds away once
  composition is a scene property (see the cascade entry below); and whether the `layouts` prop, now a second way to name a container's layout, should
  be retired in favor of the node declaration. Also: an op-driven edit opens the
  arrival window on a layout-less scene only when it carries a `setLayout` op, so a
  custom op that calls `adapter.setLayout` itself does not arrange until the
  container's next change (inferred from the code, untested).
- **(P3) Full tier unification** (collapse inline-props/explicit-adapter onto Scene). Same effort as the P2 "`arrayAdapter` as the default Canvas adapter — full unification" above — track there.
- **(P3) Container-pose cascade as a scene-primitive semantic.** Today it is
  adapter-level configuration, two mutually exclusive ways:
  `sceneToAdapter({ cascadeContainerPose: true })` translates every descendant
  by a container's delta through the pose descriptor, and `poseComposition`
  makes a container's pose a frame its children are relative to. `Scene.setPose`
  itself still stores absolute poses. The deeper move is the scene owning one
  of these natively, which needs a decision on where the descriptor or
  composition is supplied to the `useScene` constructor.

### Container layout strategies

- **(P3) Reparent-on-layout-drop lives in `moveAction`, not the strategies' `commitDrop`** (which are pose-only), as does choosing the destination container (`<SceneCanvas layoutDropTarget>`, `LayoutStrategy.dropRegion`). If a strategy ever needs container-specific reparent semantics, revisit whether `commitDrop` should own it.
- **(P3) Nothing scrolls a `'scroll'` tile grid.** `tileGrid({ overflow: 'scroll' })` places its overflow past the container's last visible line and reports the region through `LayoutStrategy.contentExtent`, but no kit host reads it: the overflow just sits past the container's bounds.
  Undecided before building it: whether a container's scroll offset is document state or
  view state. As document state, the layout pass lays the children out shifted by the
  offset, and picking, dragging and selection chrome need nothing new — but every wheel
  tick rewrites every child's stored pose and is an undo step. As view state, the offset
  is part of the frame the container gives its children and the document never moves —
  but an absolute-pose scene has no container frame today, so painting, picking,
  selection chrome, move, resize and snapping each have to fold it in, the way the
  readers that honor `poseComposition` do under a composing scene.
- **(P3) Stateful layout strategy factories.** All v1 strategies are pure. If profiling shows recompute pain (likely only quadtree-class), promote to a factory returning `(container) → { ... }` with cached state.
- **(P3) Quadtree / packing layouts.** Niche enough not to belong in the generic kit; stays in eric or a future plugin.
- **(P3) Slot-based layout strategy** (rows / grid / ring arrangements à la eric's `@/model/arrangement`). Worth lifting once the v1 three settle.

### Units

- **(P3) Per-subobject scale.** Today the unit system is global per consumer. Real apps want a child object (a sub-assembly in a CAD scene) to declare its own unit/scale, with conversion at the parent boundary. Likely lives on the parent/group node.
- **(P3) Mixed-unit arithmetic** (`50% + 2ft`) — needs a context to resolve percentages against. Separate design problem.
- **(P3) Per-axis units** — x and y carrying different units (timeline charts where x is time and y is value).

---

## Animation

### Timelines and rigging

Design: `docs/superpowers/specs/2026-08-22-animation-timeline-rig-design.md`.
Arc context: `docs/superpowers/specs/2026-08-22-game-audio-animation-decomposition.md`.

- [x] **Timeline primitive and hierarchical rig — landed 2026-08-22.**
  `animator.timeline(opts)` (`packages/core/src/animation/timeline/`) registers
  in the animator's table, with sampled / event / nested tracks. The rig
  (`packages/core/src/animation/rig/`) ships `blendPoses`, `resolveSkeleton`,
  `IDENTITY_JOINT`, and `useRig` / `bindRig`, which drive bound scene nodes
  through pose overrides; animating one is a `SampledTrack<Pose>`. Demos:
  `apps/site/demos/TimelineDemo.tsx`, `RigDemo.tsx`.

  The follow-ups below are what is left.

- **(P3) Skinning** — per-vertex bone weights deforming path geometry. The
  renderer flattens paths to meshes, so weights must reach the vertex shader or
  be applied on the CPU per frame. Needs the hierarchical rig first.
- **(P3) Serializable clips** — follows from tracks being typed callbacks rather
  than data. Revisit with the editor's experience in hand.

### Earlier deferrals

All from `docs/specs/2026-05-04-animation-primitive-design.md`. The timeline arc's
decomposition meant to absorb the first; it has not landed:

- **(P3) Animation-aware undo** — "rewind the animation" instead of cancel + jump.
- **(P3) GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts.

---

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
  and its chugs and bass as harmonic partials with a `decay`, but the bed is an
  arrangement as much as a timbre: every hit lands late by its own amount, the
  whole loop drifts sharp and back, and the four bars are peak-normalized
  together. `createPatternPlayer` has no per-event timing offset or pitch drift,
  so a port needs those first, and a check that its busiest moments fit the
  music bus's voice limit — a lid, a lead note and a drum each ring for five or
  six sixteenths, and each metal hit is seven sources.

- **(P3) Trope-aware generative scoring.** Builds on `playNote` and `createPatternPlayer`.
  Screen scoring for factual content — news packages, documentaries — runs on a
  small, highly codified set of devices, and each one is reachable from a few
  nearly-orthogonal parameters: mode, tempo, subdivision density, articulation
  (sustained vs plucked), register spread, harmonic rhythm, and the consonance
  of added intervals. Dread is sustained low tones a minor second or tritone
  apart with no pulse; investigation is a minor ostinato that adds layers;
  wonder is Lydian with open voicings and a soft attack; urgency is driving
  sixteenths on stacked fourths and fifths. Because the parameters are few and
  mostly independent, a consumer-facing surface could be two or three axes —
  valence, tension, urgency — mapped onto them, with the score generated
  continuously rather than selected from clips.

  The mapping is tight enough to hit by accident: this demo's first music bed
  was four pure sine tones with slow envelopes, written only to loop without
  clicking, and it landed squarely on the dread cue — reported unprompted as
  "creepy" (2026-08-22). That is the evidence the vocabulary is learnable.

  Worth naming what it is: these devices work by bypassing the viewer's
  argument, which is precisely their function in the genre. Anything built here
  should let a consumer see which cue is being applied, not just hear it.

- **(P3) AudioWorklet scheduling** — immune to main-thread jank; costs a worklet
  module, cross-thread messaging and a bundling story. Revisit if jank proves
  audible.

---

## Selection, actions & UI panels

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

- **(P3) `@weasel-js/quantity` has no composites and no styling.** A value is one number, so a
  range (`1/64–1/2`, which `BandEditor`'s bands would want to report) or a vector readout has no
  display of its own yet; `Slider`'s thumbs still take bare numbers where `BandEditor`'s bands take
  tagged ones; and nothing styles the `data-part` spans the HTML form emits, so `PropertyField`
  still draws its suffix from its own `unit` prop.

- **(P3) Nothing reads `PoseDescriptor.intersectsRect` any more.** `arrayAdapter`'s marquee was
  its last reader; marquee and lasso now both test the node's drawn outline
  (`core/geometry/regionHit.ts`). `RECT_POSE_DESCRIPTOR`, `ROTATED_POSE_DESCRIPTOR`,
  `pathPoseDescriptor`, `AUTO_POSE_DESCRIPTOR` and kernel3d's descriptor still implement it.
  Undecided: remove the field, or give it a reader — as the outline test for a pose shape no
  painter draws.

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
  `canvas-kit-demo.css` declares `--ckd-*`, and it and the demos'
  stylesheets read them directly, so the site ignores light mode and any theme a reader picks.
  Its `:root` block already feeds most of them into `--wzl-*` (`--ckd-text` → `--wzl-fg`,
  `--ckd-muted` → `--wzl-fg-muted`, …), but `--ckd-bg` and `--ckd-surface-2` have no
  counterpart there, and `--ckd-accent` / `--ckd-accent-dim` split what `--wzl-accent` means.
  Migrating means picking tokens for those and deciding whether the site keeps its fixed dark
  look or follows mode.

- **(P3) Overlays still set React Aria's deprecated `UNSTABLE_portalContainer`.**
  Its replacement, `UNSAFE_PortalProvider`, is exported by `react-aria` but not
  re-exported by `react-aria-components` 1.18, and depending on `react-aria`
  directly risks a second copy whose context the overlays never read — which
  fails silently, as an unthemed overlay. Switch `useOverlayPortal`
  (`packages/ui/src/overlays/portalHost.tsx`) to the provider once RAC exports it.
  The same switch lets a contained `ToastRegion` drop its own region for RAC's,
  which would make it an F6 landmark again. Still absent from RAC's index at
  1.21.1, checked 2026-09-29.

- **(P3) The grammar names no hover gesture.** The loupe now routes its peek key
  and its wheel through the dispatcher, but aiming the lens is still a plain
  `pointermove` listener in `packages/labkit/src/loupe/useLoupe.ts`, because
  `GESTURE_DESCRIPTORS` has no continuous-motion entry. Every other consumer that
  wants to follow the pointer without a press — a coordinate readout, an
  eyedropper preview, a hover ruler, `CustomShaderDemo`'s cursor-following
  panels — hand-attaches the same listener. Adding one
  is an input-taxonomy change: it has no press to own, so it cannot be an ongoing
  action, and `docs/taxonomy.md` would need to say what a hover binding claims.

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

- **(P3) `.lk-shell` falls back to the viewport's height.** It is `height:
  100dvh; max-height: 100%` (`packages/labkit/src/lab/LabShell.less`), so a
  container of definite height caps it. Under an ancestor with no definite
  height, a shell mounted below other page content still takes the whole
  viewport and overflows by its offset. Plain `height: 100%` fixes that case
  and breaks another: `LabFit.browser.test.tsx`'s `wrapped` cases, a host that
  never set `html, body, #root { height: 100% }`, then size the lab to its
  content. So this is a choice between the two mounts, not a CSS fix; that
  test (`npm run test:browser`) is what checks either one.

- **(P3) Two CurveEditor handles are still literals.** The `--wzl-handle-size`
  family covers the 45°-rotated squares; the round ranks did not fold into it,
  because a radius is not a diamond edge. The plain anchor circle (`r={4}` in
  `createFunctionLayer`) and the bezier control handle (`HANDLE_RADIUS = 3.5` in
  `createKeyframeLayer`) are the two left. Either add `--wzl-handle-dot-size`
  for the round ranks or restate the family in terms of diameter — it is a
  visual call that wants a browser.


- **(P3) ToggleBar's selected segment is the Aqua glass ramp, not a colour of
  its own.** Asked for: move the default treatment off "the aqua" and save it
  for a theme that wants it. There is no ToggleBar colour to move — every
  surface in the ramp is `var(--wzl-accent)`, which seventeen components read,
  and `Button.variant_primary` is the same drawing. The panel's bars already sit
  outside it via the `flat` variant. Doing this generally is a theme decision
  about the glass, not a component change.

### WeaselDraw app follow-ups (defer)

- **(P3) Palette presets / recently-used colors.**
- **(P3) Multi-page documents.**

---

### Plugin/bundling convention

A feature ships as one `SurfaceContribution` — bindings, actions, deps,
overlay, views and an `attach` for mount/unmount — installed through
`<SceneCanvas ambient>`. `docs/extending.md` opens with the map; the minimap and
the HUD are built on it.

- **(P3) Per-frame hooks and version negotiation.** `attach` covers mount and
  unmount; a contribution cannot yet run before or after a paint, or declare
  the kit versions it was written against.


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

**Shipped.** `useSimulation` + d3-force compat (2026-05-16), then the data-join and transition chain in `@weasel-js/d3`: `d3Bind(scene, data, { key, animator }).pose().data().join()` and `.transition().duration().ease().delay().pose().tween().end()`, chainable with a further `.transition()`. `join()` takes no arguments — enter/update/exit is a diff it performs; `.exit(fn)` on the binding takes over the exit set, and `transition.remove()` deletes each node when its transition ends. Demos: `ForceGraphDemo`, `D3SortableDemo`.

Nothing open; one item parked:

- **(P3) `d3-zoom` / `d3-drag` adapters — parked.** Both duplicate kit systems
  (the `viewport.zoom` / `viewport.pan` actions, `useHandTool`, `useViewAnimation`;
  `useDragGesture`).
  Worth building only for d3 semantics the kit genuinely lacks, not for parity —
  none identified yet.

### Interactive parallax planes

A scene layer carrying `parallax` paints through its plane. Picking, chrome,
snapping and the editing actions cross into it: `inPlane`
(`interactions/actions/planeInput.ts`) carries a move, resize, rotate, clone,
insert or anchor edit into the plane of the layer it edits. What does not
cross yet:

- **(P3) A selection spanning planes that scale differently.** `inPlane` edits
  the whole invocation in one plane — a handle's target's, else the first
  selected node's — so a move carries every node by that plane's delta, and a
  node on a plane that scales differently drifts off the pointer. The same
  holds for a container dragged with a child on another plane, and for
  reparent-on-drop or a layout drop onto a container on another plane.
  The fix is a delta per node rather than per invocation: leave the action's
  input in the camera's world and hand it a `planeOf(id)` dep instead, so move
  translates each node by `toPlane(own map, current) − toPlane(own map, start)`
  and resize / rotate map the pivot into each node's plane before applying the
  per-node transform. Snapping keeps using the primary node's plane and
  shifts the rest by the snapped camera-world delta. A reparent across planes
  carries the pose through `planeToPlane(source, destination)` with the pose
  descriptor's box-to-box rescale, so the node lands where it was drawn.

---

## forge

`@weasel-js/forge` is the component workshop built on labkit: each story renders
in the workshop page as a lab trial with controls. A story that sets `isolate`
renders in an iframe ("frame") instead; that path is frozen, kept for as long
as any story needs it, and `check:forge-isolate` holds the count. It is the
only story runner in the repo.

- **(P3) Marks are off in the workshop until annotations are a feature.** forge's
  instruments no longer declare labkit's `annotations` capability, so trials show
  no Marks section and the tool rail holds only Info. The removed wiring — the
  story as the one annotation target, sized and captured through the trial's
  frame registry — is in `git log --grep 'take marks out of forge'`.

- **(P3) The CSS Vars panel saves scale edits only.** A single token edited by
  hand — a color, a step changed after its scale — stays a per-trial override,
  because a token's value comes from a semantic rule, a ramp or a pin and the
  panel has no mapping back to which. Scale edits save through
  `applyScaleEdits` (`packages/forge/src/shell/cssVars/saveScales.ts`). A save
  also refuses a param that differs by `mode` while the trial's mode is Auto,
  since the panel does not know which scheme the frame resolved.

- **(P3) A captured forge story loses what `:root`, `html` and `body` style.**
  The frame serializes its story into a `<foreignObject>` whose root is a
  `<div>` (`packages/forge/src/frame/capture.ts`), so a rule hanging off those
  three selectors does not reach the clone. Custom properties are restated on
  the capture root, which covers theme tokens; a page background or a body
  font is still lost, and so is any font or image the document did not inline.


- **(P3, isolated stories only) A forge story with a `viewport` reloads its
  frame once when first opened.** The instrument built before the frame's `ready` message has no
  `stage`, and the one built after it does. labkit's `Trial`
  (`packages/labkit/src/trial/Trial.tsx`) renders stage content inside `<Stage>`
  and other content bare, so the switch remounts `FrameView` and reloads the
  iframe. Mount the provisional instrument under the same tree position, or learn
  the viewport before the first instrument is built.

- **(P3, isolated stories only) Opening a trial in forge reloads another
  trial's story.** Measured
  2026-09-22 in the dev app: with one Button trial open, opening a second from
  the route re-ran the first trial's `FrameView` frame effect, so its story
  loaded again into a new frame. Whether labkit remounts the trial's body when
  the tiling changes, or its host briefly leaves the `IntersectionObserver`
  margin, is not yet known. Each reload also takes a frame from the warm pool
  (`packages/forge/src/shell/framePool.ts`), which is why it keeps two.

- **(P3) A trial tile narrower than 300px cuts off its content pane.** A trial's
  `Split` (`packages/labkit/src/primitives/Split.tsx`) holds the sidebar at its
  140px floor and the content at its 160px floor however narrow the tile gets,
  so below 300px the content pane runs out past the tile. Measured in forge on
  2026-09-28 with two trials beside the story sidebar and CSS Vars aside: at a
  1000px viewport each tile is 176px and the content pane reaches 124px past
  it, at 1100px 74px; at 1718px with default sidebar widths the tiles are 535px
  and nothing overflows. The 2026-09-13 fit-check warning (`.lk-shell-body`
  scrolls, a pane 68px past `lk-trial__panes`) was this, but every split zone
  between the pane and the shell body now has `overflow: hidden`, so the lab
  no longer scrolls and the fit check stays silent: the story is clipped with
  no way to reach its right side. Needs a decision on who gives way — the
  split relaxing its floors (sidebar first) when the zone cannot hold both, or
  the workspace refusing tiles below the split's floor and reflowing them.
  At the same 140px the forge Globals group's label/value columns overlap
  ("MODE" over "Lab").

- **(P3, isolated stories only) Check forge's out-of-view frame unmounting in
  a browser.** `FrameView`
  (`packages/forge/src/shell/FrameView.tsx`) drops a trial's iframe once its host
  is more than half a viewport outside the viewport (`IntersectionObserver`,
  `rootMargin: '50%'`) and reloads it on return. Tested only against a stubbed
  observer: confirm in the dev app that scrolling a trial away and back reloads
  its story with the trial's config and state, and that the margin keeps a small
  scroll from reloading it.

---

## Demos & visual regression

- **(P2) `batch-pixels.spec.ts` fails on any machine running wake, until wake's `fix/base-path`
  merges.** wake injects its client as `/@id/virtual:wake-client` whatever vite's `base` is, and
  the site serves under `/weasel/`, so every page load 404s on it. That spec is the only visual
  spec that fails on a console error, so it goes red on a dev machine and stays green in CI,
  which runs without wake. Fixed in `~/src/wake` on branch `fix/base-path` (61a274a); merge it
  there and run `npm run build`, then delete this entry.

- **(P3) LayoutDemo clips a child dropped outside its container.** The child stays that
  container's child and is drawn clipped to it, so it vanishes from sight wherever it lands.
  Either the drop should reparent it out, or the demo's containers should not clip. Seen
  in headless Chromium 2026-09-29; predates the reflow glide work.


- **(P3) SVG export writes wrapped text as one line.** `data-weasel-wrap` round-trips `TextStyle.wrap` for weasel's own reader, but SVG `<text>` never wraps, so any other reader draws a wrapped node as its unbroken lines. Exporting the laid-out lines needs fonts at serialize time, which `@weasel-js/svg` does not have. A justified node is written at its start edge with `data-weasel-align="justify"` for the same reason: once lines are exported, its wrapped lines need per-word `x` placement too, since `text-anchor` has no justify.

---

## Backends (WebGL future)

From the WebGL transition spec — all deferred:

- **(P3) WebGPU backend.** Separate future spec.
- **(P3) Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win, significant API complexity. Defer until measured pain on the single-thread pipeline. (Note: `OffscreenCanvas` is already used on the main thread for pattern-tile rasterization in `packages/core/src/features/patterns/` — that's not worker offload; the worker move is the open item.)
- **(P3) Exotic composite operations** (xor, custom Porter-Duff) via framebuffer pingpong — deferred from v1 GL.
- **(P3) Headless server-side rendering in Node.** The browser/worker headless path landed 2026-07-19 as `renderSceneToPixels` (`packages/core/src/canvas/renderSceneToPixels.ts`, public) — it accepts a caller-supplied `gl`, so it already works with an `OffscreenCanvas` in a worker. Remaining P3 scope is specifically Node: verify against a caller-supplied `gl` from `headless-gl` (untested there), or wire up a worker + `OffscreenCanvas` path for a Node-hosted consumer.
- **(P3) Screen adoption of mipmap image minification** — `imageMinification: 'mipmap'` exists on `WeaselRenderer` but the screen path stays `'linear'`; evaluate upload-time `generateMipmap` cost before flipping the default (print already gets it).
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

- **(P3) eslint-plugin-react-hooks v7 compiler rules** — `refs` (387 findings
  across 103 files; it has no writes-only mode, so render-time *writes* are
  enforced by the local `weasel/no-render-ref-write` instead), `immutability` (18), `set-state-in-effect` (21),
  `use-memo` (7), `globals` (6), `static-components` (3),
  `preserve-manual-memoization` (2). `refs` dominates because reading a ref
  during render is how a canvas library reaches mutable frame state, so a large
  share are expected false positives. Worth evaluating rule by rule; not worth
  adopting as a block.

`eqeqeq`, `@typescript-eslint/no-unused-vars` and
`reportUnusedDisableDirectives` are all on as of 2026-09-05. The counts that
had them recorded as large sweeps were measured with the rules' strict
defaults: every one of the 317 `eqeqeq` reports was a `== null`, and 135 of the
136 unused-vars reports were the `_`-prefixed discards this repo already writes
deliberately. Configured to match those two conventions, the whole sweep was
one dead `const` and four stale disable directives.

---

## Release-gate & build hygiene

- **(P2) jsdom is pinned to exactly 29.0.1.** From 29.0.2 through 30.1.1
  (the latest), reading an inherited property that no ancestor sets — an unset
  custom property is enough — costs twice as much for every level of DOM depth:
  about 1.3s at depth 22 on 30.1.1, against about 3ms on 26. `getInheritedPropertyValue` in
  jsdom's `living/css/helpers/computed-style.js` walks every ancestor, and each
  ancestor's lookup walks its own ancestors again. `Select`'s
  `getComputedStyle(trigger).getPropertyValue('--wzl-select-align')` hit it
  inside forge's workshop, turning one `Workshop.test.tsx` case from ~1s into
  ~150s. A depth-sweep repro is a dozen lines against `new JSDOM()`; move off the pin once
  a jsdom release is flat on it.

- **(P2) HUD vs DOM text: what the first measurement left open.**
  `tests/perf/hud-vs-dom.spec.ts` answered the main-thread question (findings
  and crossovers in `tests/perf/README.md`, "HUD text against a DOM overlay"),
  but only on a contended node. Still unanswered: frame rate and the
  off-main-thread totals, whose spread on studio at load 8–21 swamped a 2–3 ms
  lean toward the HUD — rerun on an idle node; a React-rendered overlay, which
  adds reconciliation the plain-DOM side does not pay; and a pure pan that moves
  the whole DOM layer as one element. Separately, the HUD's static-label cost
  (~1 µs of script per glyph per frame) comes from `attachHud`'s layer asking
  every widget for a fresh command on every repaint; caching an unchanged
  widget's commands would remove the one axis where the DOM wins outright.

- **(P3) Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one is desired. Today's barrel test (`packages/core/src/index.barrel.test.ts`) asserts parity for op factories, shape kinds and the `features` presets; public exports remain uncovered.

- **(P3) React `act()` warnings in CI vitest are back in the hundreds.** The June 2026 sweep took the `ci.yml` "not wrapped in act(...)" count 200 → 4 (and killed the ~91 jsdom `getContext` stack dumps); see `vitest.setup.ts` (global `getContext` stub) and the test-side `act()` wrapping. The last green main run (36271062844, 2026-09-26) prints 650 per Node leg, nearly all from labkit and forge: `LabRuntime`, `StoreContainer`, `Trial` and `LabSections` updates, led by `packages/forge/src/shell/storyInstrument.test.tsx`, `packages/forge/src/frame/FrameController.test.tsx`, `packages/labkit/src/lab/Lab.test.tsx` and `packages/forge/src/shell/cssVars/CssVarsPanel.test.tsx`. The old residue remains: `packages/core/src/canvas/SceneCanvas.tools.test.tsx`'s *"omitted defaultTools: resize is registered"* test raises a SceneCanvas-internal deferred update from the resize-gesture commit that resists every test-side `act()` strategy tried (async microtask flush, `setTimeout(0)` macrotask flush, dispatching the whole down→move→up gesture inside one `act()`); a real fix there has to live in SceneCanvas's update scheduling, not the test. Note: these warnings only reproduce under CI (ubuntu/worker timing), not locally — verify via the `ci.yml` log.

- **(P2) Per-command draw cost, for everything that is not batched solid
  geometry.** `tests/perf/draw-loop.spec.ts` sweeps commands per frame under
  real GL (`npm run test:perf`; gates nothing, and its result file records the
  unmasked GL renderer so a software backend is obvious).

  The cost turned out not to be the draw call. A warm mesh draw is ~1.8 us;
  what cost ~66 us was *writing a buffer between draws*, which the driver
  cannot pipeline over. So batching pays by moving buffer writes to once a
  frame, and consecutive solid-fill geometry — rects, tessellated fills, stroke
  ribbons — now shares one `drawElements`. At 3,200 commands on an M2 Max via
  ANGLE: scene-shaped rects 209 -> 0.39 ms, rotated rects 217 -> 0.70 ms, solid
  octagons 5.6 -> 0.65 ms, stroked rects 244 -> 9.4 ms.

  Stroked commands then went 9.4 -> 1.7–2.0 ms on 2026-08-15: batching had left
  them ~85% stroke tessellation, and `cache/strokeMeshCache.ts` now keys that on
  `Path` identity so a ribbon is built once per stroke configuration rather than
  once per frame. A ribbon also earns a persistent VAO on its second sight *in a
  given GL context* — `GLMeshCache.uploadRecurring`, which is where that gate
  has to live, since one scene can be drawn by several renderers. Design:
  `docs/superpowers/specs/2026-08-15-stroke-ribbon-cache-design.md`.

  What still pays per command, at 512 a frame on the same machine
  (`tests/perf/transition-matrix.spec.ts`): solid 0.14 us, shader 1.22,
  pattern 1.60, gradient 1.78, stencil fill 3.22, per-vertex-color 3.87,
  image 3.6 (7.0 before the quad ring landed), text 6.7–7.1. None of those is
  the barrier any more, and neither is a *neighbour of a different kind*: that
  boundary cost 27 us — all of it the solid batch's stalled flush — until the
  batch started cycling its buffers, and is now 2.5 us for solid and under one
  for every other kind. See the boundary entry below.

  Text took the same ring on 2026-08-27 and went 6.65 -> 3.3 us, level with an
  image draw; a slot's buffer grows to the largest run it has seen, and one
  shared index buffer serves every slot because the quad pattern for N quads
  is a prefix of the pattern for any larger N. The remaining per-command costs
  above are otherwise unchanged.

  Images stopped paying per command on 2026-09-05. Consecutive image quads
  coalesce into one `drawElements`, and `kind: 'sprites'` hands a run over as a
  `Float32Array` rather than a command object each. Over one atlas at 20,000
  quads: 51.3 -> 10.6 ms coalescing, -> 0.79 ms packed. A run breaks on
  MAG_FILTER, clip depth or color matrix; transform, group alpha and
  per-command opacity ride the vertices, and as of the slot work below so does
  the bitmap, up to seven of them.

  Text joined that batch on 2026-09-09. Glyphs, the rules under underlined
  words and tessellated glyph outlines all stage alongside the geometry around
  them, so a captioned thumbnail is one draw where the caption used to cost two
  — and `dispatch` no longer flushes ahead of a text command whether or not it
  draws anything. The batch shader carries the glyph math behind a paint mode
  and runs it on *every* fragment, glyph or not: `fwidth` in non-uniform control
  flow is undefined, so the derivative has to be taken before anything selects
  on the mode. That roughly doubles a fragment that is not a glyph
  (`tests/perf/fill-rate.spec.ts`) — recorded here as 1.4% when text landed,
  which was the instrument and not the shader: the control gated its glyph math
  on a factor the compiler folds to zero and then deletes the math behind, so it
  timed `plain` against `plain`. Fill is not what a wall is bound by, so the
  decision stands; a fill-heavy scene pays more for text than this entry said.

  **The cost of folding text in was the vertex, and packing is what paid it.**
  The first cut gave the vertex a paint mode and a bold threshold of its own,
  and that measured 9% slower at the densest wall rung — 1.78 ms against 1.63
  for 7,500 commands, ABBA in one sitting, with the pure-rect column showing the
  same shape. The batch exists to make one buffer write a frame cheap, so a
  float only glyphs read still widens the write for every rect and quad beside
  them. Slot and mode are both small enumerations, so `slot + 8 * mode` fits in
  the float `a_texSlot` already was; the threshold went back to a uniform, which
  breaks a run where a faked bold meets text that is not. Re-measured the same
  way, the rect column is at parity (0.56 / 0.57 against 0.53 / 0.57) and
  wall-1x sits a few percent above baseline, inside the spread each variant
  showed against itself.

  What a run no longer breaks on: a second text color in a paragraph, a
  decoration whose fill differs from its glyphs, and the difference between a
  baked MSDF atlas and the runtime canvas bake. A font atlas takes a texture
  slot in the same list bitmaps take, so seven textures in a run is now seven of
  either kind.

  **Linear gradients joined the batch on 2026-09-10, on a ramp atlas.** Every
  baked ramp is a row of one texture (`cache/GradientRampAtlas.ts`) rather than
  a texture of its own, so every gradient in a frame shares one texture slot
  instead of taking one each — which is the thing that made a gradient
  unbatchable at all. The atlas doubles from 16 rows to 1024 and recycles the
  least recently used row past that, which also bounds an animating gradient:
  the old cache grew a GL texture per frame for one and freed none.

  A linear gradient's ramp position is affine in position, so a vertex carries
  it and the rasterizer's interpolation across a triangle is exact. That makes
  such a fill a textured quad off the atlas — the plain paint mode, `a_uv =
  (ramp position, row)`, white vertices carrying its opacity — and it cost no
  paint mode, no vertex float and no line of shader. Fills, stroke ribbons and
  glyph-outline meshes all take it.

  The trap it carries: a staged vertex names its row by where the row sits, so
  an atlas that grows or recycles a row repaints geometry already staged.
  `wouldReshape` is asked before the bake and the run flushed if the answer is
  yes — asking afterwards is too late.

  **The measurement to quote is the mixing, not the per-command cost.** Three
  runs of `tests/perf/transition-matrix.spec.ts` in one sitting put 512
  alternating solids and gradients at 0.35 / 0.40 / 0.50 ms a frame against
  0.51 / 0.75 / 0.78 for 512 gradients alone — so a solid beside a gradient
  costs nothing, which is the claim. That spread is ~50% on an unchanged
  fixture, wide enough that a per-command before-and-after does not resolve
  against it; the draw counts in `drawBatch.test.ts` are the exact evidence.

  Gradient fills also pick up the group color matrix, which `gradFill` was the
  only paint program not to apply. The batch program applies it to everything
  in a run, so without this a linear gradient and a radial one under the same
  group would have disagreed.

  **Radial and conic followed the same day.** Their ramp position is not affine,
  but the coordinate they need is, so a vertex carries a gradient-space point in
  `a_uv` and its atlas row in `a_post`, and the shader takes a `length` or an
  `atan` of it. Both sit behind a branch on the paint mode, which is legal where
  it would not be around the glyph math: the mode is a flat varying, so every
  fragment of a quad takes the same arm, and neither arm holds a derivative.

  **The branch carries the sample, not just the coordinate, and that is worth
  65% of a fragment.** Selecting a coordinate and then sampling once is a
  texture read the hardware cannot schedule against a varying; splitting the
  fetch across the two arms gives every non-gradient fragment its plain read
  back. Measured against the same shader without the branch at all: +65.1% one
  way, +4.9% the other (`tests/perf/fill-rate.spec.ts`). Step 4 of
  `docs/superpowers/specs/2026-08-14-batched-dispatch-design.md` is now closed.

  Solid geometry and image quads share that batch as of 2026-09-09
  (`renderer/drawBatch.ts`). They used to be exclusive — staging a solid
  drained the image run and staging an image drained the solid one — so a wall
  of thumbnails, which is a ground rect under an atlas quad per cell, paid a
  flush per command however well each half batched on its own. Measured over a
  viewport-filling grid of those cells (`tests/perf/atlas-wall.spec.ts`): 600
  commands 2.83 -> 0.10 ms, 1,650 11.37 -> 0.20, 5,400 40.50 -> 0.58, 15,000
  126.15 -> 1.50. Draw calls 15,000 -> 2, the second only because the run
  crosses the per-flush vertex cap.

  **Every vertex names the texture it samples** (`a_texSlot`, slot 0 the white
  texel). The first cut had solids carrying the white texel's *UV* while the
  flush bound the run's bitmap, so every ground rect beside an atlas quad drew
  multiplied by that atlas's middle texel — white grounds came out olive, and
  no baseline saw it because in every demo the quad covers its ground.
  `tests/visual/batch-pixels.spec.ts` reads the framebuffer channel by channel
  and is the gate for that whole class.

  Slots also let one run hold seven bitmaps rather than one, so a document with
  a handful of loose images stops breaking its run per bitmap. The run still
  breaks on an eighth, and on one bitmap wanted at two MAG_FILTERs — texture
  state, not unit state. The fragment shader unrolls a compare per slot because
  GLSL ES 3.0 will not index a sampler array with a variable, and the arms cost
  nothing measurable: at 15,000 commands a two-slot chain and an eight-slot one
  are the same, and the whole change measures 1.85 -> 1.95 ms against its own
  parent run back to back.

  Read those two against each other, not against the 1.50 above: the same
  unchanged tree measured 1.85 on the later day. These absolutes drift by
  around a quarter between sessions on one machine.

  **There is no step in this at a thousand commands.** A consumer measuring the
  same wall found per-command cost flat at ~1.3 us up to ~800 and flat at ~7.3
  past ~1,400, and read the step as a batch or cache limit being crossed. It
  was the ladder: the rungs below it drew cells the atlas had no tile for,
  which are solid fills and batched, and the rungs above drew sprites, which
  interleaved with their grounds and did not. The two regimes weasel had are
  exactly those two numbers. `atlas-wall.spec.ts` walks the same cell sizes with
  the sampling held fixed and is flat across the whole ladder.

  **`sampling: 'nearest'` is free on our sheets and is not free on a big one.**
  `atlas-wall.spec.ts` prices both filters at every rung and finds no
  difference, which agrees with the reasoning: `GLImageCache` pins MIN_FILTER
  to LINEAR and generates no mipmaps on the screen path, so `sampling` moves
  MAG_FILTER alone and a minified draw should never read it. A consumer
  measuring the same shape on a 12MB sheet gets nearest costing up to 8x
  linear, and the ratio tracks minification exactly — 8.11 at 2:1, 5.98 at
  1.33:1, 1.08 at 1:1, 1.14 magnified — vanishing the moment the draw stops
  minifying, and inverting to the ordinary expectation on their small sheet.

  Our sheets are 16x16 tiles, so the largest is about 3MB. Theirs is 5652px
  square — **122MB resident**, forty times ours, not four; the 12MB first
  reported was the compressed webp on the wire. A texture that size against a
  cache hierarchy is why 3MB may see nothing where 122MB does not fit.

  **One redundant write is already gone.** `flushBatch` re-asserted MAG_FILTER
  on every flush for every slot, and filtering is state on the texture object,
  so most of those were writes to a live texture for no reason.
  `GLImageCache.setMagFilter` now skips a value the texture already carries.
  That fits the shape of their measurement — their linear pass re-asserted the
  upload default while their nearest pass changed state on every draw — but it
  does not explain it: their control is the pre-batch build, which set the
  filter per *command*, and the ratio they see tracks minification rather than
  command count. So it is a fix, not the answer.

  What is left of the fork: either MIN_FILTER is not what a draw at 2:1 on a
  122MB texture actually reads, or something else in the renderer still varies
  with `sampling`. Widening this spec's sheet toward theirs is the experiment.
  Their column is single runs per rung on a box that had a fleet job on it all
  evening — believe the shape, which lands exactly at 1:1 and is not something
  contention produces, and not the second digit.

  The rest of the plan — one program plus atlases — is in
  `docs/superpowers/specs/2026-08-14-batched-dispatch-design.md`, with the traps, and a
  two-phase dispatch split that would make it tractable.

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

- **(P3) Per-layer GPU dispatch skipping.** `RenderLayer.deps` (shipped
  2026-08-22, `packages/core/src/core/layers/render.ts`) skips rebuilding a
  layer's command tree, not submitting it — every layer is still dispatched
  to the renderer every frame regardless of caching. Skipping submission too
  would need render-to-texture per layer plus compositing, which the
  renderer has no concept of today. Nobody has measured whether dispatch
  alone costs enough to justify that. Measure before building.

- **(P3) Whether the benchmarks gate CI.** Every benchmark lives in
  `tests/perf/` and writes a result file per run; nothing gates anything. The
  vitest microbenchmarks keep a committed baseline in `tests/perf/bench/`. `tests/perf/README.md` argues a hard
  threshold on shared runners would have to be loose enough to miss real
  regressions. The shape a gate could take instead: a PR job that runs the
  benchmarks on both revisions and posts the `npm run perf:compare` table as a
  comment without failing the build. Mike's call.

- **(P3) `tests/perf/bench/baseline.json` needs a re-record on an idle
  machine.** It is still the 2026-08-14 run, in vitest 4's `--outputJson`
  shape, so `lib/vitest-bench.ts` keeps a reader for that shape only for it.
  It also predates the move of `getMesh miss`'s cache reset and the cold
  `renderOrder` walk's layer reorder into tinybench's untimed `beforeEach`:
  its `getMesh miss` row times the reset too, and its cold-walk group still
  has the old row names, including `layer reorder only`, which the suite no
  longer has. Run `npm run perf:bench:baseline` on a fleet node with no other
  work on it (never orochi), commit both files, and delete the vitest 4 branch
  of `readBenchReport` and its test in the same change. The 2026-09-29 attempt
  found every node running census renders all night.

- **(P2) A clipped group costs ~10 us to enter, and the stencil is now the
  larger half.** `tests/perf/clip-cost.spec.ts` separates entry's two costs by
  clipping contents that would not have batched anyway: a gradient rect never
  joins the solid batch, so wrapping one in a clip adds the stencil and nothing
  else. Per clip entry on an M2 Max via ANGLE — stencil push and pop 5.25 us,
  whole entry around a solid rect 10.16, so the break is 4.90. A second route
  agrees: a group carrying a color matrix breaks the run through the same test
  without touching the stencil, and prices one flush at 4.35 us. Nesting is
  still free, and eight leaves under one clip instead of one takes the per-leaf
  figure from 10.2 us to 0.65.

  Those were 64.89 and 54.38 before `SolidBatch` stopped rewriting one pair of
  buffers on every flush. The driver tracks a write hazard per buffer object,
  so each write waited on the draw still reading what it was about to
  overwrite. The batch now cycles a ring of 64 slot-sized buffer sets, plus a
  4-deep ring of growable ones for flushes past a slot, so a write lands that
  many draws behind the read that hazards it.

  What is left is not the draw. `tests/perf/flush-anatomy.spec.ts` reproduces
  the flush's call sequence over the same ring and removes one GL call per row,
  so adjacent rows differ by that call's cost, against a 0.34 us floor for
  bind-and-draw alone. The index upload and the `u_color` / `u_alpha` writes
  are now skipped when the GPU already holds those bytes (a ring slot remembers
  its index pattern; both uniforms go through `UploadedUniforms`), which took a
  flush from 5.39 to 3.22 us and a clip entry from 12.47 to 9.53 in one A/B.
  The vertex `bufferSubData`, 1.84 us, is the largest item left — the one thing
  a flush exists to do — and text is the bigger target now (see the boundary
  entry below).

- **(P2) A boundary between two command kinds costs 0.3–2.5 us, and solid is
  the expensive one.** `tests/perf/transition-matrix.spec.ts` prices each
  ordered pair of command kinds: a frame alternating A and B, minus half of
  each kind's own frame, over the boundaries between them. Fitting the matrix
  to `S(A,B) = f(A) + f(B)` leaves residuals inside the noise floor, so a
  boundary is not a property of the pair — each kind carries its own cost and
  pays it against any neighbour that is not itself. Those costs, in us per
  boundary: solid 2.48, clip 0.68, text 0.57, gradient 0.54, stencil 0.54,
  pattern 0.51, image 0.38, per-vertex-color 0.35, shader 0.28.
  Repeat-measurement noise on the same cells is 0.02–0.32.

  Solid was 28.37 until the flush stopped stalling (see above), which is what
  made a mixed document cost several times the sum of its parts. It is still
  the highest of the nine, and still one flush: 512 rects each broken out of
  the run are 2.5 ms a frame against 0.06 for 512 unbroken ones, where the same
  frame was 28.3 ms.

  `frame-budget.spec.ts`'s `mixed-doc` row moved with it, measured by running
  that spec twice over the same tree with only `solidBatch.ts` swapped: 3,232
  document elements in a 16.7 ms frame before, 8,320 after. Against the cost
  its element mix predicts from the single-kind rows, the row was 3.41x and is
  now 1.37x — so a document interleaving kinds is no longer several times the
  sum of its parts. Every single-kind row is unchanged within noise; the two
  that moved besides this one are the clipped groups, 6.4x and 3.5x.

  **Text is what is left.** At 15% of the mix and 6.5 us a label it contributes
  more of the mixed row than everything else together, which is the same
  per-draw allocation the transition entry above names.
