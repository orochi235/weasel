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

- **(P2) A canvas's keyboard shortcuts claim keys page-wide.** The gesture dispatcher listens
  on `window`, and a page with one canvas has it as the active scope, so held Space pans that
  canvas from anywhere on the page — a read-only canvas in a side panel takes Space from a
  page that wants it (the blits playground's space-to-play listens in the capture phase to
  get there first). Keys aimed at an editable field, or Space/Enter on a focused button or
  link (`activatesFocusedControl`), are already left alone, and `enableKeybindings={false}`
  turns a canvas's keys off. Left: deciding when a canvas owns a key that reaches the body —
  focus inside the canvas, the pointer over it, or the last canvas interacted with — without
  breaking an app like WeaselDraw, whose shortcuts work from the body today.

- **(P2) `features` names two things.** The `<SceneCanvas features>` prop composes behavior
  presets (`canvas/SceneCanvas/features.ts`); `packages/core/src/features/<name>/` is a source
  directory bundling one domain's primitives, and `docs/taxonomy.md` calls each of those a
  "feature" too. The two are unrelated and both names stand for now, with the taxonomy saying so.
  Left: one of them takes a new word. The prop is at 215 call sites and is consumer API; the
  directory is one path, its imports, and a section of the taxonomy.

- **(P3) A canvas without `ingest` is still a drop target.** `SceneCanvas` attaches the
  dispatcher's drop listeners whatever `features` says, so an OS drag over a bare or `edit`-only
  canvas shows the copy cursor and `weasel-dropover`, and the drop is swallowed with nothing
  inserted. `DispatcherChannels.ingest` covers drop and paste together and would need splitting,
  which also decides whether a consumer's own drop binding works without the preset. Beside it:
  `SceneCanvasApi.ingest()` is a silent no-op without the `ingest` preset, because it triggers an
  action that was never registered.

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

- **(P2) What diagram groups still cannot do.** `DiagramData.groups` draws a box around its
  members, and `layered` and `tree` keep them together (`cluster.ts`). Three things are left:
  - **Nesting.** A group is never a member of another, so a subsystem inside a system has no
    shape. The column packer would recurse: lay a group's members out as a block, then pack that
    block as one item of its parent.
  - **`force` ignores groups.** It wants an attraction toward each group's centroid, and a
    repulsion between boxes rather than only between nodes.
  - **The box cannot be dragged.** It is `pickable: false`, because a drag would write a pose
    its derivation overwrites on the next read. Dragging it should move its members, and that is
    a move action reading the box's `dependsOn`.

- **(P3) `ForceGraphDemo` is a second force-graph pipeline.** It runs d3-force
  through `useSimulation` and paints with its own render layer, beside
  `@weasel-js/diagram`'s `force` layout and `DiagramView`. `force.ts` reserves
  that route for graphs too big for a scene node per edge, but the demo has 24
  nodes. Decide whether it stays as the large-graph example (and says so, at a
  size that shows why) or is rebuilt on `DiagramView`.

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
  the animator's control surface and moves every value computation onto blits. Built: pose
  overrides fold through a mix (step 2), and tweens, springs, physics, decay and keyframe
  sampling compute in blits (step 3), at about 3× today's tween frame for 10k nodes, which Mike
  accepted on 2026-10-04, and 2.5–3.5× today's keyframe sampling, which Mike accepted on 2026-10-08
  (the rest of that gap is blits' read path).
  Left: steps 4–6, each needing a plan.
  - **(P3) Two edges `sampleTrack` changed on blits.** A `NaN` time now samples as `NaN`, where it
    used to return the first key. And at an interior key, a track with its own `interpolate`
    returns that key's value object rather than a fresh `interpolate(a, b, 0)`, so a consumer
    mutating it mutates the key.

### Earlier deferrals

All from `docs/specs/2026-05-04-animation-primitive-design.md`. The timeline arc's
decomposition meant to absorb the first; it has not landed:

- **(P3) Animation-aware undo** — "rewind the animation" instead of cancel + jump.
- **(P3) GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts.

---

### labkit presentation mode

`<Lab present>`, `?present` and `usePresentation()` show one trial without any
chrome, for portfolio embeds, with a refit view, play controls and `gestures`;
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
- **(P3) A still for poster capture, and `postMessage` play/pause** so a host
  page's play control can reach a live lab.

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

- **(P3) Should routing declare the `activeTool` dep itself?** `ActionDeps` types each dep
  through `DepSchema`, but `activeTool` is merged in by core, so routing's own
  `makeToolOffhandAction` still reads `ctx.deps.activeTool as ActiveToolContextValue` — routing
  builds without core's augmentation, and the type it casts to is routing's own. Declaring the
  entry in routing's `DepSchema` would drop that last cast; the question is whether routing
  should own a dep entry at all, when it is empty by design today.

- **(P3) Range selection on the canvas.** `@weasel-js/select` ranges over an `order` the caller
  supplies, and a canvas has none of its own, so core's `useSelection` never ranges and keeps no
  anchor. The order could be z-order, tree order, or a layer panel's row order handed across;
  which one is the open question, not the plumbing.

- **(P3) Should `LayerList` toggle on shift, or range like `Tree`?** `LayerList` follows the
  canvas convention (shift-press toggles a row), where `Tree`, Finder and most layer panels range
  on shift and toggle on Cmd/Ctrl. Changing it is its `PRESS_POLICY`; the question is which
  convention a layer panel beside a canvas should follow.

- **(P3) Does disabled get its own signal, now that emphasis is an alpha?** Disabled is
  `opacity: 0.4`–`0.5` on the whole control, and subtle text is 0.54–0.64 alpha, so a disabled
  control and a subtle label can read alike.

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
  1.21.1 (still `latest`) and at nightly `3.0.0-nightly-99e610236-261006`,
  checked 2026-10-07.

- **(P3) The grammar names no hover gesture.** The loupe now routes its peek key
  and its wheel through the dispatcher, but aiming the lens is still a plain
  `pointermove` listener in `packages/labkit/src/loupe/useLoupe.ts`, because
  `GESTURE_DESCRIPTORS` has no continuous-motion entry. Every other consumer that
  wants to follow the pointer without a press — a coordinate readout, an
  eyedropper preview, a hover ruler, `CustomShaderDemo`'s cursor-following
  panels — hand-attaches the same listener. Adding one
  is an input-taxonomy change: it has no press to own, so it cannot be an ongoing
  action, and `docs/taxonomy.md` would need to say what a hover binding claims.

- **(P3) Split `Properties.module.css`.** It is 73 KB and styles the panel, list, rows, group,
  subpanel, cards, and every field in one file, with three generated stance blocks inside it. Its
  header says the rules that cross components (`.listPairs > .subpanel`,
  `.groupBody > :not(.rowColor)`) are why it is one module. Wants those few shared names in one
  small module the rest compose from, and each component's rules beside the component, as
  `PropertyHelp.module.css` already is.

- **(P3) `PropertyHelp` trips react-aria's "`<Focusable>` child must be focusable" warning.** Seen
  in forge on 2026-10-10: the `ui/Properties/Rows/PropertyRow` story `AutoValue` logs it once per ⓘ
  button on load, and a story with no ⓘ logs none. The child is a real `<button>`, and the tooltip
  opens from the keyboard, so the check in `useFocusable.js` is failing on something other than
  the element's kind. Cause not found.

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


- **(P3) ToggleBar's selected segment is the Aqua glass ramp, not a color of
  its own.** Asked for: move the default treatment off "the aqua" and save it
  for a theme that wants it. There is no ToggleBar color to move — every
  surface in the ramp is `var(--wzl-accent)`, which seventeen components read,
  and `Button.variant_primary` is the same drawing. The panel's bars already sit
  outside it via the `flat` variant. Doing this generally is a theme decision
  about the glass, not a component change.

- **(P3) Escape cancels a reorder drag.** Neither `Tree`'s drag (`useTreeDrag`) nor
  `useReorderDragList` listens for Escape, so a drag can only end by releasing somewhere.
  `ThresholdDragHandle.cancel` already exists; both hooks need the key wired to it, and the
  dragged rows must stay where they were.

- **(P3) `Tree` can steal focus after a keyboard move that never re-renders.** An Alt+arrow move
  records the node to refocus and waits for the next render. If the consumer's `onMove` is async
  or doesn't update `nodes`, the next unrelated render moves focus to that node. Clear the pending
  focus when the move doesn't land within a frame.

- **(P3) `PrefSchemaEditor` exports enum options with empty or duplicate values.** The options
  editor adds a row as `{ value: '', label: '' }` and accepts repeats, and the exported literal
  carries them as-is — an enum that cannot round-trip. Flag the bad rows in the editor rather
  than export them silently.

- **(P3) `PrefSchemaEditor` clears required custom attributes.** Emptying an attribute removes
  it, which is right for optional built-in attributes but deletes a custom kind's required one —
  `registry-enum`'s `source` on WeaselDraw's `#/dev/prefs`. `CustomKinds` has no way to mark an
  attribute required; it needs one, and `blankLeaf` should seed those attributes for a custom kind.

- **(P3) `PrefSchemaEditor` layout rough edges.** The preview's scratch values are keyed by path,
  so after a rename or move they fall back to defaults. The always-mounted notice row adds one
  grid gap above the attributes pane, and the Key/Kind rows are wider than the attribute form
  under them. Seen on `#/dev/prefs` at 1440×900.

- **(P2) `PrefSchemaEditor` layout by dragging, what is left.** A stored value in the Unplaced
  list cannot be dragged; it is still added by a click. A `label` is a kind only `PrefsForm`'s rail
  and columns rows draw: `SelectionPanel` and labkit's `ControlPanel` show it as an unknown kind,
  `prefFieldChoices` offers it as a field, and `@weasel-js/prefs` does not know the kind.
  `PrefsForm.drop.browser.test.tsx` checks the form's drop target and reflow in a real browser; no
  test in the repo drives a pointer through the editor itself. Palette, row, rail, and tree drags
  were driven through a headless browser on astv's page and on the editor's story on 2026-10-10.

- **(P3) `PrefsForm`'s drop reflow, rough edges.** Rows jump to their new places; nothing
  animates them, and the hit test already ignores where they are drawn, so a transform on them
  would be safe. The line a placeholder adds can be the one that makes the pane scroll, and the
  scrollbar then moves every row a few pixels. A row dragged off every target is drawn back at
  home at full strength until it finds one. A sticky section title over a scrolled row does not
  hide the row from `prefDropTargetAt`.

- **(P3) `PrefSchemaEditor`: undoing a move made through a rail entry leaves the moved node out of
  sight.** Holding a drag over a rail entry opens that page by selecting its group, so the step
  records that group as the selection to go back to. Undo puts the node back on its own page and
  selects the group, and the preview stays on the page the node just left.

- **(P3) `subPages` and `foldable` overlap a group's `as`.** `PrefsForm`'s form-wide `subPages`
  and `foldable` props decide what `as: 'page'` on a nested group and a folding panel should;
  fold both into `as`. `as: 'page'` means nothing where there is no rail (`ControlPanel`, the
  columns and list layouts, any `PrefSection`) and draws as the default there.

- **(P3) `PrefSchemaEditor`: a drag begun in the structure tree shows the tree's rows as its ghost over the live preview.** A
  palette drag and a drag begun in the preview show the node as the form draws it (`NodeGhost`). `Tree` draws its
  own ghost and has no way to be handed one, so it needs a prop for what to draw, and for when the drag has left it.
  Over the preview that ghost now also sits on top of the node the form draws where it would land; the palette's and
  the preview's own ghosts step aside for it (`drawsNode`).
- **(P3) `PrefSchemaEditor`'s properties-panel preview ignores the selection.** For a group
  schema the tree and the live preview select and scroll to each other, through `PrefsForm`'s
  `selected`/`onSelect`. A section schema previews through `SelectionPanel`, which has neither.

- **(P1) A prefs schema cannot say "a list of X".** `@weasel-js/prefs` has `object` for one
  compound value with typed `children`, and nothing for an array. labkit's `f.list` holds strings
  only and is not among the package's built-in kinds, so `PrefSchemaEditor` treats it as an unknown
  custom kind and edits its base fields alone. A list of numbers, enums or objects has to be a
  custom kind with a hand-written validator and renderer: astv's timing chains are `number[]`
  declared as `f.custom('phases:<chain>', …)` for that reason. There is no map type either.
  Proposed, not agreed: a built-in `list` leaf carrying `item`, itself an ordinary leaf, the way
  `object` carries `children`, with `minItems`/`maxItems`, so
  `{ kind: 'list', item: { kind: 'number', min: 0 }, minItems: 3, maxItems: 3 }` replaces the
  validator and `f.list` becomes its `item: { kind: 'string' }` case. Touches the schema type,
  `PrefsForm`'s list control (`ListEditor` edits strings), and the editor's kind table
  (`kindSchemas.ts`).

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

- **(P2) A record cache drops a write its adapter rejected.** `flush` in
  `packages/storage/src/records.ts` empties `queued` before the writes resolve, and a write that
  throws is warned about ("keeping it in memory") and never queued again. The page keeps showing
  the new value, storage never gets it, the next `flush()` resolves true, and `writable` stays
  true, so over a server adapter a pref changed while the server restarts reverts at the next
  load. Read from the code here; reproduced against a fake async adapter in review of astv's
  server-backed prefs, whose adapter resends refused writes itself to get around it. Wants the
  failed names put back in `queued`, unless a newer write to the name is already there, and
  flushed again on a backoff.

- **(P2) A record cache takes a remote change over its own write in flight.** `applyRemote`
  skips a name only while it is in `queued`, and `flush` clears `queued` before awaiting the
  adapter. Page A sets `mode=light` and its flush is in flight; page B's `mode=auto` lands and is
  announced; then A's write lands. A shows `auto` while storage holds `light`. Same provenance as
  the entry above. Wants the names of an in-flight batch held alongside `queued`, so a remote
  change to one is ignored until its write settles.

- **(P3) Two callers still treat an unread record cache as final.** A cache whose first read
  failed now reads again and recovers, but labkit's lab store opts out (`retryMs: false` in
  `openLabStore.ts`): `readLab` answers an unwritable cache with an empty lab, so records landing
  later would skip its migrations and its fold of the old storage keys. And draw's
  `importLegacyPrefs` (`apps/draw/src/prefs.ts`) checks `writable` once at boot, so a store that
  recovers mid-session imports its legacy prefs only on the next load. Both want the same thing
  the prefs entry below does: the open-time work rerun when the records arrive.

- **(P3) Prefs migrate only at open, so an older version arriving later is never migrated.**
  `watchPrefsVersion` reacts to another writer's `$version` only when it is above this build's.
  Read from the code, not reproduced: two tabs on different builds opening the same unmigrated
  `localStorage` at once each migrate and flush, and when the older build's writes land second the
  newer tab takes its older-shape records through `applyRemote` and runs on them for the session,
  then writes newer-shape records into a store marked with the older version, which the next open
  migrates a second time. Any adapter that delivers a server's records after open has the same
  gap. Rerun the migrations over a remote batch that leaves `$version` below target.

- **(P3) A Windows 9x theme.** Gray 3D bevels, a navy-to-blue gradient title strip and the
  system's pixel faces, as a full theme beside Interstellar rather than a one-component skin. Its
  titled groups want a titlebar frame motif (a solid title strip across the top), which was left
  out of the first set of frame motifs for this theme to bring.

- **(P3) A classic Mac OS theme.** Which era it follows, System 7's one-bit look or Mac OS 8–9's
  Platinum, is the first decision.

- **(P1.5) `@weasel-js/ui` names colors as raw CSS strings, not `ColorSource`.** `@weasel-js/paint`'s
  `ColorSource` (a literal, a `ColorRef` like `{ ref: 'accent' }`, or a function, resolved by
  `resolvePaletteColor`) is the kit's color type, but only core's renderer uses it. In the ui package
  every color prop is a string passed through as CSS: `StanceProps.tone` (`number | string`, the
  number indexing the theme's tone list), `Plot2D`'s series colors, `CurveField`'s band and line
  colors, `createFunctionLayer`'s `color`, `Badge`'s effect colors. So a palette name has no way into
  any of them, and the UI and the renderer name colors two ways. Adopting it means giving the theme
  context a `Palette` (or an `ExternalColors` resolver onto its ramps; `ThemeProvider` hands out tones
  only as a `ColorList` today) and resolving every one of those props through it.

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

- **(P3) A forge plugin test times out waiting for a file watcher under load.**
  `vite/plugin.test.ts`, "titles a native story by its meta when forge's meta reaches it
  through a helper module, and re-decides when the helper changes", polls 5s for the index
  to follow a rewritten helper file. It timed out once in a full fleet run on teitou
  (2026-10-09) and passed in a labkit-and-forge-only run of the same tree minutes earlier.

- **(P3) The served page is titled "weaselforge" until the shell config loads.**
  `ShellConfig.title` sets `document.title` at runtime, but the HTML the plugin
  serves and builds (`packages/forge/src/vite/html.ts`) hard-codes
  `<title>weaselforge</title>`, so a tab, a crawler or a link preview reads the
  old name. The plugin cannot import the shell config module; either it learns
  to read the title out of it at build time, or the title moves to
  `ForgeOptions` — and then the shell config's copy should go, not stay as a
  second source.

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

- **(P3) windease lays out a node that was registered and never shown.** A
  strip gives a `mounted` node its room and a seam, while `Container` renders
  only `visible` ones, so the pane is an empty gap with a live separator
  (`layout-node-adapter.js` skips `hidden` and `destroyed` only; windease
  2.0.0). `Split` works around it by showing its sidebar node and hiding it
  again (`createSplitStore`). The fix belongs in windease; the workaround goes
  when it lands.

---

## Demos & visual regression

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
  `typedoc.config.mjs`. The rest are `{@link}`s that resolve to nothing (`Field` in labkit,
  `textCommand` in text, `Focusable` and `KEEP` in ui), a README image path in hud, and `xml`
  code fences in svg's README that need `highlightLanguages`.
- **(P3) A symbol core re-exports from a sibling is documented twice.** `ClaimableGesture` has a
  page under `@weasel-js/core` and another under `@weasel-js/gestures`, with the same text.
  TypeDoc's `packages` strategy converts each package on its own, so core's copy is a full
  declaration, not a pointer. Type references do cross: core's pages link into the sibling's.
- **(P3) The front page's palette is undecided.** It ships three behind a toggle (charcoal,
  the project's maroon and lime, paper). Pick one, then delete the toggle and the other two from
  `apps/site/FrontPage/palettes.ts`. The page is deliberately plain; a live canvas beside the
  pitch was drawn and set aside for later.
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
    its noise, about 1.2 us. So what remains is the draw count: a color matrix,
    synthetic bold, and an eighth texture all still break the run.
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
  (`packages/core/src/renderer/draw.ts`). `tests/perf/mesh-batch.spec.ts` times
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
- **(P3) Whether the benchmarks gate CI.** Every benchmark lives in
  `tests/perf/` and writes a result file per run; nothing gates anything. The
  vitest microbenchmarks keep a committed baseline in `tests/perf/bench/`. `tests/perf/README.md` argues a hard
  threshold on shared runners would have to be loose enough to miss real
  regressions. The shape a gate could take instead: a PR job that runs the
  benchmarks on both revisions and posts the `npm run perf:compare` table as a
  comment without failing the build. Mike's call.
