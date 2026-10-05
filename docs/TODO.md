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

### Combining animations

- **(P3) The animator on blits** — weasel has no model for two animations on one property; every
  case is last-writer-wins. Proposal: `docs/proposals/2026-09-30-animator-on-blits.md`, which keeps
  the animator's control surface and moves every value computation onto blits. blits' half is done
  (published, fixed-interval stepping, springs that keep velocity). Steps 2 and 3 live on branch
  `pose-overrides-mix`, unmerged: step 2 is built, and step 3 waits for dense lanes in blits' `mixer`
  (decided 2026-10-01). Don't rebuild step 2 on `main`; see the proposal on that branch.

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

- **(P2) A pref's label can't shorten to fit the space it's given.** A leaf (and an enum
  option) carries `name` and one `short` (`ToolPrefBase` in `core/tools/prefs.ts`), and each
  surface hard-codes which it reads: `ToolOptionsBar` takes `short ?? name`, SelectionPanel's
  flag bars take `icon`, then `short`, then `name`'s first letter, and every other surface
  takes `name`. A label that fits one width and truncates at another has no say. Let a leaf
  give its shorter forms in order (`name` stays canonical and the accessible name), and have
  a surface take the longest one that fits the cell it measured, instead of picking a field.

- **(P2) Emphasized text on an accent fill falls below 4.5:1 in dark mode.** `--wzl-fg-muted`
  and `--wzl-fg-subtle` now step down from the text color in effect (`rgb(from currentColor r g b
  / a)`, see `docs/conventions.md`, "Design tokens"), so on `--wzl-accent` they follow
  `--wzl-fg-on-accent`. But that text itself is only 4.73:1 on the dark accent, so muted lands at
  3.18:1 and subtle at 2.52:1 (light mode: 5.05 and 3.91). Either the dark accent darkens or the
  steps get an accent-specific alpha. Still open from the same arc: whether disabled gets its own
  signal now that emphasis is an alpha (disabled is `opacity: 0.4`–`0.5` on the whole control,
  subtle text is 0.54–0.64 alpha).

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

- **(P3) `@weasel-js/quantity` has no composites and no styling.** A value is one number, so a
  range (`1/64–1/2`, which `BandEditor`'s bands would want to report) or a vector readout has no
  display of its own yet; `Slider`'s thumbs still take bare numbers where `BandEditor`'s bands take
  tagged ones; and nothing styles the `data-part` spans the HTML form emits, so `PropertyField`
  still draws its suffix from its own `unit` prop.

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

- **(P3) jsdom 30.1.1 runs patched.** From 29.0.2 on, reading a custom property no
  ancestor sets doubles in cost with every level of DOM depth: `_getComputedPropertyValue`
  caches only properties in `propertyDefinitions`, so `--*` reads go uncached, and
  `getInheritedPropertyValue` re-walks the chain from each ancestor. `Select`'s
  `--wzl-select-align` read turned one `Workshop.test.tsx` case from ~1s into ~150s.
  `patches/jsdom+30.1.1.patch` caches custom properties too, applied by `postinstall`;
  `Select/jsdomCustomProperty.test.ts` times out if it stops applying. Delete both, and
  `patch-package`, once a jsdom release carries the fix.

- **(P2) HUD vs DOM text: what the first measurement left open.**
  `tests/perf/hud-vs-dom.spec.ts` answered the main-thread question (findings
  and crossovers in `tests/perf/README.md`, "HUD text against a DOM overlay"),
  but only on a contended node. Still unanswered: frame rate and the
  off-main-thread totals, whose spread on studio at load 8–21 swamped a 2–3 ms
  lean toward the HUD — rerun on an idle node; a React-rendered overlay, which
  adds reconciliation the plain-DOM side does not pay; and a pure pan that moves
  the whole DOM layer as one element. Widget command caching cut the HUD's
  static-label cost from ~1 µs to ~0.2 µs of script per glyph per frame (the
  README's "After widget command caching"). A static label on a fixed camera
  still favors the DOM (1.43 ms against 0.35 at 5,000 glyphs), because the
  renderer re-walks every unchanged text command each frame. A layer-level
  skip for a HUD whose widgets are all unchanged would need `content` painters
  kept out of it. The every-frame cells have not been rerun since the cache
  landed.

- **(P3) Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one is desired. Today's barrel test (`packages/core/src/index.barrel.test.ts`) asserts parity for op factories, shape kinds and the `features` presets; public exports remain uncovered.

- **(P2) Breaking the batch is what a frame pays for, and a clipped group is
  the worst case.** Solids, all three gradients, images and text share one
  batch (`renderer/drawBatch.ts`), and a boundary between any two of them costs
  nothing measurable. What still costs is closing that batch early. Measured
  2026-10-03 on teitou (Apple M5 Max, ANGLE Metal, idle); the result files are
  in `tests/perf/recorded/render-cost-2026-10-03/`.

  | at 60 Hz, `frame-budget.spec.ts` | elements a frame |
  |---|---:|
  | solid rects | 249,856 |
  | images | 212,992 |
  | scene tree | 194,560 |
  | shader panels | 50,176 |
  | gradient rects | 42,496 |
  | stroked paths | 34,816 |
  | text labels | 21,760 |
  | mixed document | 15,616 |
  | clipped groups, depth 1 | 1,360 |
  | clipped groups, depth 4 | 976 |

  - **A one-rect batch flush costs 7–17 us, and the figure will not hold
    still.** `clip-cost.spec.ts` prices it at 16.6 us one run and 7.4 the next,
    and single rows swing 2x between rounds. A pattern rect, which draws alone
    from a mesh uploaded once, costs ~0.6 us and is steady.
  - **The stencil is not the clip's cost any more.** Push and pop together are
    0.83 us; the rest of a ~12 us clip entry is the flush the clip forces. Eight
    rects under one clip cost ~80 us an entry, more than one rect does, which
    nothing about the stencil explains.
  - **Text closes the dearest batch.** In `transition-matrix.spec.ts` a
    batched kind beside one that breaks the run pays 3–5 us a boundary for
    solid, gradient or image and 8–18 us for text. The additive per-kind model
    that fit in August no longer does; residuals reach 8 us.
  - **The flush's GL calls do not account for it.** `flush-anatomy.spec.ts`
    drops `flushBatch`'s calls one at a time through the real renderer, and the
    rows move up and down by more than any one call could cost: bind and draw
    alone ran 2.4–6.3 us across two runs. A ring of 1,024 slots instead of 64
    changed nothing outside that noise, so it is not slot reuse either. The
    instrument resolves nothing below ~5 us until whatever varies is found.
  - Three uniforms are written on every flush whatever their value —
    `u_synthBold`, `u_samplers`, `u_fieldScale` — plus a white-texture bind and
    two `activeTexture` resets. Cheap to cache, but unpriced for the reason
    above.

  These are not comparable with the August figures this entry replaced, which
  were measured on an M2 Max.

- **(P3) `sampling: 'nearest'` costs up to 8x on a 122MB sheet.** A consumer
  drawing a 5652px atlas sees nearest cost 8.11x linear at 2:1 minification,
  5.98x at 1.33:1, 1.08x at 1:1 and 1.14x magnified. `atlas-wall.spec.ts` finds
  no difference on our sheets, the largest about 3MB, and `GLImageCache` pins
  MIN_FILTER to LINEAR with no mipmaps, so `sampling` moves MAG_FILTER alone and
  a minified draw should never read it. Either MIN_FILTER is not what a draw at
  2:1 on a texture that size reads, or something else still varies with
  `sampling`. Widening the spec's sheet toward theirs is the experiment. Their
  column was single runs on a contended box: trust the shape, which tracks
  minification exactly, not the second digit.

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
