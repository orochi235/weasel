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

- **(P3) Long-press has no feedback.** No haptic, no visual "press is
  registering" affordance during the 500ms hold. Users get no signal that
  holding will do something. Recorded 2026-08-02, alongside the `longPress`
  gesture kind landing.

- **(P3) HUD widgets have no keyboard focus.** The pointer family shipped
  2026-08-12 (spec
  `docs/superpowers/specs/2026-08-12-hud-gesture-dispatch-design.md`): a widget
  declares `claims` over `ClaimableGesture`, an exclusive claim bars only the
  gestures it names, and double-click / right-click / long-press / wheel all
  reach widgets — wheel opt-in so scroll-to-zoom over a panel is unchanged.
  What is left is focus: a focused-widget model on `Hud`, tab order, a key arm
  on the widget protocol, focus-ring painting, and a precedence rule against
  the canvas's window-level key listeners.

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

- **(P3) The slice tool cannot place a cut click by click.** `sliceAction` cuts along a
  drag — straight, or its whole trail with `cut: 'freehand'` — and `splitPathByPolyline`
  / `snipPathByPolyline` take any polyline, but no gesture builds one vertex per click
  the way the pen tool does. Separately, a loop the cut draws inside the fill is
  dropped rather than cutting out the region it encloses.

### Cursor package follow-ups

All four arcs of `docs/superpowers/specs/2026-09-03-cursor-system-design.md`
have shipped. What remains:

- **(P3) The `bucket` glyph is parked.** Three attempts failed to read at 24px —
  a tapered pail with a spout is a pencil silhouette, and the handle that would
  fix it wants a sketch rather than another guess. Nothing is blocked: no fill
  tool consumes it. See the note in `packages/cursor/scripts/glyphs/draw.mjs`.
- **(P3) Only Chrome is measured.** The spec's browser facts come from Chrome
  152 / macOS 26.5. Safari and Firefox could rasterize an SVG cursor at 1× (the
  fix is `image-set`, already documented) or cap at a different size. Both live
  behind `bake.ts`. `packages/cursor/scripts/probe/` is the instrument.

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

- **(P3) The raw `createViewportLayer` path still carries a re-projection
  prototype.** Views are the input answer — `<CanvasView>`, the `views` prop,
  `SceneCanvasApi.addView` — and `<CanvasView interactive={false}>` is the
  paint-only viewport. `layer.reproject` and `viewportsAt` are left over from
  before, and `apps/site/demos/ViewportLayerDemo.tsx` still hand-rolls a click
  probe on them. Retire both and rebuild the demo on views, or keep the raw
  layer as the paint primitive and drop only the prototype.

- **(P3) Views do not nest.** A view paints and routes the surface's own stack,
  never another view, and a loupe magnifies the canvas's camera — aimed over a
  `<CanvasView>` panel it shows and edits the canvas's world, not the panel's.
  Composing would mean a view's camera derived from the view under its aim, and
  a resolver that descends rather than picking one rect.

- **(P3) Two `meanScale` residuals under non-uniform zoom.** The hit-test half
  shipped 2026-08-12: `core/viewport/pxExtent` (`pxExtent` / `withinPxBox` /
  `withinPxRadius`), affordance `point` regions compared in screen space, the
  annulus band floor and paint inset per-axis, the pen close-hit a screen-space
  circle, and every snap-guide tolerance per-axis. Two sites deliberately did
  not move:

  (a) **`useSceneSelectTool`'s pick tolerance** still divides by `meanScale`.
  It is a forgiveness margin around an outline rather than a hit target, and
  per-axis would mean widening `poseContainsRotated`, `poseContains` and
  `shapeCoversPoint` to a `{x,y}` tolerance — for a result that stays
  approximate under rotation anyway, since a screen-axis ellipse pulled back
  through a rotation is not axis-separable in the local frame.

  (b) **Painted chrome placement** — `rotationHandleCommands` in
  `features/selection/overlay.ts`, and the matching positions in
  `slopsDebugLayer` / `createDebugOverlayLayer`. Same rotation coupling, and
  they must move together with each other or the visible handle and the
  grabbable ring diverge. Wants someone looking at the render.

  Grid hairline strokes (`1 / meanScale`) have no per-axis analog at all — the
  renderer takes one width.

---

## Paths & booleans

- **(P3) Conditional at-rules in `@weasel-js/svg` stylesheets.** `<style>` rules, selector matching and `!important` resolve in `packages/svg/src/cascade.ts`, but every at-rule is skipped whole: a rule inside `@media` or `@supports` never applies, even one a static render would match (`@media screen`, `@supports (fill: red)`), and `@import` is not fetched. A `<style media="…">` applies only when its list names `all` or `screen`. Evaluating these needs a stance on which media a parse represents.

### Pathfinder follow-ups (post-v1)

Core five + Crop shipped. Remaining:

- **(P3) Outline.** Stroke-to-fill silhouette — needs proper offsetting with joins/caps/self-intersection cleanup. No lightweight JS lib without major deps.
- **(P3) Trim and Merge.** Remove hidden portions / Trim + same-color reunion — need per-path style awareness, which the kit deliberately doesn't have since `data` is opaque. Wait on a compound-path-with-styles model.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** v1 flattens beziers before clipping; the result is straight-line. Skia/PathKit-style curve-preserving booleans are next-level — substantially harder.
- **(P3) Live preview during the gesture.** Holding the op key while hovering a path to see the result before committing.
- **(P3) Boolean ops on stroked paths.** Treat a stroke as a filled region, then clip. Blocked on stroke-to-fill (round/bevel/miter joins, end caps — its own design problem).
- **(P3) Pathfinder against text glyphs.** The boolean ops take a `Path`, and
  `layoutRuns` (`packages/text/src/layout/layoutRuns.ts`) already does the run
  walk for the outline tier: each `LaidOutOutlineGlyph` carries the glyph's
  em-space `d` from `glyphOutline`, its pen `x`, `baselineY` and `scale`, so
  `pathFromD` covers the extraction. What is left is getting that geometry for
  any text node — layout emits it only for a face with registered outlines,
  above `outlineMinSize` or for a stroked run, and never for synthetic bold —
  then placing each glyph in world space through the node's transform and
  unioning the result before the op.
- **(P3) "Create Outlines".** The destructive text→path conversion every
  vector editor has: replace a text node with the path geometry of its
  glyphs, giving up editability. Same glyph extraction as the pathfinder
  entry above, plus the scene surgery — one undoable batch that deletes the
  text node and inserts a path node carrying the union.

---

## Rendering & paint

- **(P3) A minimap's framing ignores pose overrides.** `<SceneViewCanvas>` and
  `<MinimapCanvas>` paint override poses as of 2026-08-25, but `computeFitView`
  still derives framing from document poses, so a node overridden outside the
  document bounds paints outside the fitted frame. Deliberate — recomputing the
  fit per frame would rescale the whole minimap through a drag or a settle, and
  costs an O(nodes) bounds sweep every frame. Revisit only if a consumer wants
  framing that tracks a simulation.

- **(P3) `paintInputsRef` is written during render.** `Canvas.tsx` assigns
  it in the render body, so a concurrent render React starts and abandons still
  leaves its inputs in the ref, and the next `requestRedraw` from any source —
  a gesture, a HUD, the view — paints inputs that were never committed. This is
  a second `startTransition` hazard, distinct from the one `docs/concepts.md`
  documents (that one is about DOM lagging the canvas; this one is about the
  canvas painting a render that does not exist), and only the comment above
  the assignment records it. Writing the ref from a layout effect instead would
  fix it and cost the ordering `syncPaint` exists for — pixels landing before
  the surrounding layout effects read the DOM.


- **(P3) Mesh gradients have no on-canvas handles.** `MeshEditor` edits corner
  colors and the blend space; a patch's twelve control points are only reachable
  by writing the paint by hand, which is where gradients were before
  `GradientHandles`. `SceneGradientHandles` is the shape to copy — it already
  resolves the bounds frame and commits through the `setFill` action.

- **(P3) A mesh paint bakes at a fixed 256 texels.** Enough for a smooth field at
  shape size, but a mesh filling a poster is resolution-bound in a way the three
  gradients are not (their ramp is 1-D, so 256 covers any size). The bake is
  keyed by paint identity in a `WeakMap` (`BAKES` in
  `packages/core/src/features/meshPaint/meshPaint.ts`), so a size-aware bake
  would need the draw scale in the key; the size itself is `MESH_BAKE_SIZE` in
  `bake.ts`.

- **(P3) Pattern fills: what the tile picker left open.** The texture half of
  fill-mode expansion shipped 2026-08-12 — patterns tile, carry a serializable
  `TilePatternSpec`, round-trip through SVG `<pattern>`, and have a picker in
  WeaselDraw. What it deliberately did not do:

  - **Image-upload patterns.** The picker covers the four built-in tiles only.
    A user-supplied bitmap needs a payload variant that persists the image
    itself (data URI, or a document-scoped asset table), which is a storage
    question rather than a paint one.
  - **Patterns on small text.** A text node's paint is its `data.fill`, so the
    panel already sets a pattern on one, and above the outline-tier threshold
    a glyph is geometry drawn through `drawPathFillByKind`, so it paints. Below
    the threshold `drawTextGroup` samples an SDF atlas with one color — the
    paint's `color`, or black — so the same text shows the pattern flat.
  - **Tile rotation / skew.** SVG has `patternTransform`; the paint has only an
    origin. Rotating a hatch is the obvious first ask.

  The gradient half's own gap is closed: a conic gradient serializes as a
  `<wzl:conicGradient>` def in `urn:weasel-js:svg` and reads back losslessly,
  and every reference to a paint SVG cannot express carries SVG's own paint
  fallback color so an unresolvable one paints flat. See
  `docs/proposals/2026-09-17-paint-kinds-beyond-svg.md` for what a richer kind
  writes inside that envelope.

- **(P3) Promote `ShaderDrawCommand` past `@experimental`.** Three uses now exercise it (plasma / ripple / voronoi panels), which is enough to have validated the surface. Open questions before stabilization: (a) array uniform binding shape — currently consumers must pass per-slot keys (`u_ripples[0]`, `u_ripples[1]`, …); should the kit accept a flat `Float32Array` and split it? (b) hot-reload story for `registerProgram` re-registration; (c) how to expose the renderer's program registry without leaking internals (`shaders` prop is the seam, but consumers writing custom RenderLayers may want more).

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

- **(P3) The two tiers still read different ascender tables.** Untouched by
  the outline work and unchanged in urgency. Chrome reports Inter at 0.896 em
  (`sTypoAscender`) where `msdf-bmfont-xml` baked 0.969 em (`hhea.ascender`),
  and `emHeightAscent` is undefined in Chrome, so no browser API recovers the
  hhea value — a DOM baseline probe returns exactly
  `fontBoundingBoxAscent`. Measured at a 48px em: Inter 43/43 (0.896), Impact
  48/48.5 (1.01), Georgia 44/44 (0.917), Comic Sans MS 53/53 (1.104), Papyrus
  45 with descent 29 (0.938). Decide one convention and normalize both tiers
  onto it. Papyrus's ascent+descent of 1.54 em cannot fit the default 1.2 line
  box under any convention and needs a rule of its own. The outline tier makes
  this *easier*: reading font bytes gives access to both tables directly
  instead of to whichever one Chrome chose to expose. Recorded 2026-07-31.

- **(P3) The character strip has no "no fill" chip.** WeaselDraw's text
  objects carry `fill: null` through its SVG export and import, and the
  sidebar's Fill leaf already offers None for a text node. What is missing is
  a None chip beside the strip's Color field, and it needs a decision first:
  the strip is range-scoped, but a run cannot be unfilled (`StyledRun.fill`
  is `FillStyle`, no `null`). Either the chip unfills the whole node (and has
  to clear run fills, which reach text outside the selection), or runs gain
  `fill: null` through `resolveRuns`, the DOM overlay, the range algebra and
  `@weasel-js/svg`'s `<tspan>` output.

- **(P2) Cross-browser overlay alignment.** `placeOverlay` uses an empirical `(+1, -1)` CSS-px nudge to compensate for canvas/CSS rasterization disagreement. Works on the dev setup; not universally correct across browsers/fonts/DPRs. A self-correcting probe was attempted and rejected. A node-level `TextStyle.script` adds a second, known offset: the overlay sets the whole node at the scripted size on a line pinned to the unscripted height and raises it by the preset's shift, but CSS centers the smaller glyphs in that line where the canvas hangs them from the unscripted ascent — about `(F − f)(ascent − descent) / 2`, roughly 2px at a 16px node. Correcting it needs the face's ascent and descent in the overlay.

- **(P3) No justified alignment.** `TextAlign` is left / center / right / start / end; layout has no mode that spreads a wrapped line's slack across its word gaps (every line but a paragraph's last). The panel's Align bar offers the three absolute edges and reads `start` / `end` as the edge they paint at, so a justify segment is one option away once `layoutRuns` can do it — the SVG writer would also need `text-align-last` or per-word placement, since `text-anchor` has no justify.

- **(P3) Letter-spacing counts characters three different ways.**
  The DOM overlay sets CSS `letter-spacing`, which the browser applies per
  grapheme cluster; `layoutRuns` adds tracking per code point
  (`packages/text/src/layout/layoutRuns.ts`); and the 2D `measuredWidth`
  adds `text.length * letterSpacing` — per UTF-16 unit
  (`packages/text/src/measure/measureText.ts`). Visible only on text with
  combining marks (the GL and 2D paths over-track against the overlay) or
  astral characters such as emoji (2D over-tracks against GL, so the two can
  wrap a line differently).

- **(P3) Decoration and script metrics are derived, not read from the font.**
  The underline / strikethrough / overline offsets and weight are the fixed
  `0.10` / `-0.30` / `-0.90` / `0.05` em constants in
  `packages/text/src/layout/decorationMetrics.ts` (shared by the GL tier and
  `createMarkdownRenderer`'s 2D path), and
  `SCRIPT_METRICS` (58.3% size, ±33.3% position) is Adobe's default rather
  than the font's. Real fonts ship `post.underlinePosition` /
  `underlineThickness` and `OS/2.ySuperscript*` / `ySubscript*`, and
  `opentype.js` already parses both — `faceFor()` in
  `packages/font/src/outline/opentypeParser.ts` reads only `unitsPerEm` and
  `ascender` and discards the rest, so extending `OutlineFace` is the whole
  change on that tier. The BmFont atlas format has no slot for any of it, so
  the outline tier would honor the font and the SDF tiers would not — and a
  metric that applied on one tier and not the other would reflow text as it
  crossed the size threshold, which the tier is built never to do. Fixing this
  properly means baking the metrics into the atlas JSON in
  `packages/font/scripts/gen-font.ts`, not just reading them at runtime.

- **(P3) `ToggleBar.module.css` is a drifted copy of the segmented-control
  styles.** The `ButtonBar` / `OptionsBar` duplication closed 2026-08-15 —
  both now import `components/segmentedControl.module.css`. `ToggleBar` was the
  third copy nobody had counted: the shared rules plus a `.segmentMixed` third
  state (`aria-pressed="mixed"`), a `.variant_minimal` that genuinely diverges —
  bordered box, square corners, inner dividers, `gap: 0` — and a
  `.variant_flat`, where the shared one uses rounded gapped segments.

  It has since drifted: fixes landed on `ToggleBar` alone — `min-width:
  max-content` so segments don't collapse in a squeezed row (the shared
  `.segment` still has `min-width: 0`), `:first-of-type` / `:last-of-type` so
  tooltip markers don't break the end caps, and icon-segment padding. Check
  whether `ButtonBar` and `OptionsBar` need the same fixes.

  Folding them in means the shared module becomes a base that `ToggleBar`
  overrides through descendant selectors (`.variant_minimal .segment`), which
  `composes` handles badly. Do it alongside a decision about whether the three
  bars are one component with different affordances.

  Note the dedup was a source win, not a payload one: the merged stylesheet is
  the same size either way (52933 → 52934 bytes), since identical content
  already collapsed to one scoped hash.

- **(P3) Complex-script text shaping (HarfBuzz).** `packages/text/src/layout/layoutRuns.ts` walks codepoints linearly and applies BmFont kerning pairs — sufficient for Latin / Cyrillic / Greek / CJK ideographs, wrong for Arabic / Devanagari / Thai / any script needing contextual shaping or reordering. Real fix is wiring a HarfBuzz WASM build (harfbuzzjs ~1MB) behind a feature flag so consumers who only need Latin can stay slim. Touches the layout pipeline only; the renderer already takes pre-laid glyphs.

- **(P3) Small caps has no run spelling.** The last gap in the run style
  model. Synthetic small caps needs a *per-character* size within one run
  (lowercase rendered as scaled-down uppercase), where the run is the unit
  that carries a size today; the honest version splits the entry walk's size
  off the run, or reads the `smcp` OpenType feature, which needs shaping. Real
  small caps is a face, not a synthesis, and would fall out of the HarfBuzz
  entry above. The case half is there to build on: `textTransform` already
  maps drawn characters back to source ones through `ResolvedRun.srcMap`, so
  the uppercase glyphs a synthesis draws need no new caret bookkeeping.

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

- **(P3) Container layout as a scene semantic.** Layout strategies exist
  (`freeform` / `snapPoint` / `tileGrid`, wired per container through
  `sceneToAdapter({ layouts })`), but only `move` applies them — the resting
  arrangement (`childPoses`) runs during a drag's reflow and nowhere else, so an
  insert, delete or resize inside a laid-out container leaves its children where
  they were. The deeper move is the scene holding a container's layout and
  applying it on any change to its children.
- **(P3) Full tier unification** (collapse inline-props/explicit-adapter onto Scene). Same effort as the P2 "`arrayAdapter` as the default Canvas adapter — full unification" above — track there.
- **(P3) Container-pose cascade as a scene-primitive semantic.** Today it is
  adapter-level configuration, two mutually exclusive ways:
  `sceneToAdapter({ cascadeContainerPose: true })` translates every descendant
  by a container's delta through the pose descriptor, and `poseComposition`
  makes a container's pose a frame its children are relative to. `Scene.setPose`
  itself still stores absolute poses. The deeper move is the scene owning one
  of these natively, which needs a decision on where the descriptor or
  composition is supplied to the `useScene` constructor.

### Container layout strategies (deferred from `docs/specs/2026-05-03-container-layout-strategies-design.md`)

- **(P3) Reparent-on-layout-drop lives in `moveAction`, not the strategies' `commitDrop`** (which are pose-only), as does choosing the destination container (`<SceneCanvas layoutDropTarget>`, `LayoutStrategy.dropRegion`). If a strategy ever needs container-specific reparent semantics, revisit whether `commitDrop` should own it.
- **(P3) Tile-grid overflow policy.** A drop into a full `tileGrid` is rejected, but a child that arrives any other way (an insert or reparent op) past `cols * rows` is skipped from `childPoses` and left unplaced. Scroll, grow-grid, and rejection-at-the-op are the policies worth designing between.
- **(P3) Stateful layout strategy factories.** All v1 strategies are pure. If profiling shows recompute pain (likely only quadtree-class), promote to a factory returning `(container) → { ... }` with cached state.
- **(P3) Animated reflow transitions.** Sibling reflow is snap-to-target in v1. Smooth interpolation likely needs a `useAnimatedReflow` hook over the animation primitive.
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

- **(P3) Inverse kinematics** — a solver that writes poses. Composes with the rig
  above and needs nothing here changed.
- **(P3) Skinning** — per-vertex bone weights deforming path geometry. The
  renderer flattens paths to meshes, so weights must reach the vertex shader or
  be applied on the CPU per frame. Needs the hierarchical rig first.
- **(P3) Serializable clips** — follows from tracks being typed callbacks rather
  than data. Revisit with the editor's experience in hand.

### Side-scroller demo — landed

`apps/site/demos/SceneScrollerDemo.tsx`, with its game logic in
`apps/site/demos/platformer/`. A load test on the timeline, audio and scene-graph
arcs rather than a showcase: 254 leaf nodes drawn by the built-in painters, the
camera as the canvas `view`, animation state changing every few frames and
one-shots overlapping continuously. Its HUD carries the instrument readouts, a
collision-box overlay, and a swarm button that pushes the voice pool past its
limit. A platformer in `apps/site/demos/` is a deliberate exception to the
terse, single-purpose demo convention: an exception, not a precedent.

What it surfaced:

- **Measure the frame time culling buys, in a browser.** Culling now skips
  the painter for off-screen nodes, and `platformerCull.test.ts` counts the
  painter calls it saves headlessly; what that is worth in milliseconds per
  frame has not been read off a real GPU.

- **No tiled-content layer primitive exists** (the P3 under Tiling) — the run
  cycle and the parallax bands are second sites wanting it.

- **Tune `DEAD_ZONE_X` in the browser.** It sits at 28 in
  `apps/site/demos/platformer/camera.ts` (vs `DEAD_ZONE_Y` at 20), picked
  rather than chosen on feel. A dead-zone camera settles at exactly
  `DEAD_ZONE_X` from a stationary target, so `platformerCamera.test.ts` asserts
  that invariant rather than a fixed distance — changing it does not break a
  test.

Two predictions the demo **disproved**, recorded so they are not re-raised: the
sprite-sheet gap closed independently (`ImageDrawCommand.source` / `flipX` /
`flipY` / `frameRect`, see
`docs/superpowers/specs/2026-08-22-image-source-rect-flip-design.md`), and the
"public frame tick" the arc expected to need was already shipped as
`Animator.onTick` plus `keepAlive`.

### Earlier deferrals

All from `docs/specs/2026-05-04-animation-primitive-design.md`. The timeline arc's
decomposition meant to absorb the first two; neither has landed:

- **(P3) Animation events / observability** — global subscribe API for debug overlays / analytics.
- **(P3) Animation-aware undo** — "rewind the animation" instead of cancel + jump.
- **(P3) GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts.
- **(P3) Layout-strategy reflow integration** — explicit hookup; today consumers compose `animateOnSetPose` over a layout-driven adapter.

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
- **(P2) Synth voices and a pattern player.** Today the engine plays
  `AudioBuffer`s: everything must be recorded or pre-rendered, so the
  side-scroller hand-writes PCM into a buffer for every sound it makes. The
  missing layer is a *note* — pitch, duration, envelope, a cheap waveform with
  harmonics — plus a pattern player that books notes through the existing
  lookahead scheduler instead of the caller booking each `play()`. The
  scheduling, buses, voice pooling and stealing all already exist and are the
  hard part; this sits on top of them. Wanted independently by anything that
  needs music it did not ship as an asset.

- **(P3) Trope-aware generative scoring.** Builds on the synth voices above.
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
- **(P3) Insert effects** — per-bus effect slot (convolution reverb, filters).
  Nothing in the v1 graph forecloses it.
- **(P3) Streaming sources** — `MediaElementAudioSourceNode` for long music.
  Everything in v1 decodes fully into an `AudioBuffer`.

---

## Selection, actions & UI panels

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

- **(P3) A mark can be selected in two targets at once.** Each of
  `AnnotationOverlay`'s canvases builds its own single-mode selection and clears
  only its own scene, so clicking in one target does not clear a selection
  standing in another. `selection()` reports both. A host can enforce exclusivity
  from `subscribe`, awkwardly.

- **(P3) Overlays still set React Aria's deprecated `UNSTABLE_portalContainer`.**
  Its replacement, `UNSAFE_PortalProvider`, is exported by `react-aria` but not
  re-exported by `react-aria-components` 1.18, and depending on `react-aria`
  directly risks a second copy whose context the overlays never read — which
  fails silently, as an unthemed overlay. Switch `useOverlayPortal`
  (`packages/ui/src/overlays/portalHost.tsx`) to the provider once RAC exports it.
  Still absent from RAC's index at 1.21.1, checked 2026-09-08.

- **(P3) The grammar names no hover gesture.** The loupe now routes its peek key
  and its wheel through the dispatcher, but aiming the lens is still a plain
  `pointermove` listener in `packages/labkit/src/loupe/useLoupe.ts`, because
  `GESTURE_DESCRIPTORS` has no continuous-motion entry. Every other consumer that
  wants to follow the pointer without a press — a coordinate readout, an
  eyedropper preview, a hover ruler, `CustomShaderDemo`'s cursor-following
  panels — hand-attaches the same listener. Adding one
  is an input-taxonomy change: it has no press to own, so it cannot be an ongoing
  action, and `docs/taxonomy.md` would need to say what a hover binding claims.

- **(P3) labkit's loupe ships in the main bundle.** `<Trial>` imports
  `TrialLoupe` statically, so every lab pays for the magnifier whether or not
  an instrument declares one. The overview shows the other shape: its own
  entry (`@weasel-js/labkit/overview`), mounted by the instrument and reading
  the trial through `CameraContext`. Moving the loupe onto it means the
  instrument mounts the lens, and the trial's toolbar toggle finds it through
  context rather than the capability.

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

- **(P2) Some packages never import `geom`.** Found 2026-08-29 by the cascade
  audit, outside the duplication it was hunting: `packages/{labkit,modes,d3,paint}`
  never import `@weasel-js/geom` at all, and `ui` only from a story
  (`Badge.stories.tsx`). An observation, not yet a decision — whether any of them
  hand-roll geometry `geom` already has is the open question.

- **(P3) Confirm Safari's trackpad pinch in real Safari.** `useGestureDispatcher`
  dispatches WebKit `gesturechange` as a `pinch` gesture, which `viewport.zoom`
  binds, and swallows ctrl+wheel while a claimed gesture is live. All of it is
  tested in jsdom against a stand-in event. Unverified: that Safari fires
  `gesturestart` before the first ctrl+wheel copy (if it does not, that first
  sample zooms once through the wheel binding), and that preventing
  `gesturestart` / `gesturechange` stops the page zoom in the Safari versions
  that send both channels.

- **(P3) Alignment guides — v1 follow-ups.** Auto-derived alignment guides shipped 2026-06-19 (`packages/core/src/features/guides/alignment/`: `deriveAlignmentGuides` + `matchAlignment` + `alignMoveBehavior`/`alignInsertBehavior`/`alignResizeBehavior`, rendered via `createGuidesLayer`; demo `apps/site/demos/AlignmentGuidesDemo.tsx`). Spec: `docs/superpowers/specs/2026-06-19-alignment-guides-design.md`. Multi-select drag alignment shipped 2026-06-19 (`alignMoveBehavior` matches the selection's union AABB via `unionBounds`). Remaining deferred: (a) **Figma-style segment rendering** — line spanning only between the aligned objects with end ticks / offset labels, instead of full-canvas lines (needs a span-aware layer, not just axis+offset); (b) **equal-spacing / distribution guides** ("equal gaps" across 3+ objects). Rotated-object alignment is done: both ends measure through the pose descriptor (`visualBoundsViaDescriptor`), which returns the rotated shape's ink AABB.

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

### Align/distribute/flip follow-ups

- **(P3) Cursor-relative align** (e.g. align to mouse position rather than union).
- **(P3) Selection-handles-locked alignment** (align relative to the dragged corner during a resize gesture).

### Debug overlay follow-ups

- **(P3) Debug overlay for hand/zoom tools.**
- **(P3) Printable snapshot mode** — rasterize debug + scene to a single image for bug reports. Should compose with `renderSceneToPixels` (`packages/core/src/canvas/renderSceneToPixels.ts`) as the underlying primitive.
- **(P3) FPS panel extensions** — ms-per-frame readout alongside FPS, draw-call count per frame, per-layer draw-cost breakdown (needs renderer-side instrumentation seams).

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


### Feature-roles taxonomy — risks to monitor

The `api`/`attrs`/`layers` taxonomy is documented; provider and wrapper roles are deliberately collapsed under `layers`. Watch for:

1. **Wrapper-vs-provider intent invisible at the type level.** A reader can't tell from a feature's `layers` field alone whether the feature owns the slot or just decorates it. If this becomes a recurring confusion in code review, split into `layers` (provider) + `wrappers` (transformer).
2. **Order becomes load-bearing.** "Later contributions wrap earlier ones" is convention, not enforcement. If a consumer accidentally orders a wrapper before the provider it expected to wrap, the wrapper sees an empty layer and emits nothing.
3. **Wrapper accidentally replaces.** `(current) => freshLayer` is a valid wrapper signature that ignores `current` — the type system can't enforce "modify, don't replace."

Rollback path is small: split `layers` into `layers: FooLayers` (provider) + `wrappers: FooWrappers` (slot-keyed transformers). The other field names (`api`, `attrs`) stay.

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

Open, from `docs/superpowers/specs/2026-05-17-d3-plugin-design.md`:

- **(P3) A d3 transition cannot tell a node removed and re-added between two frames.**
  `transition.ts` checks once per frame that each node still exists, so a node removed and
  re-added under the same id before the next frame keeps being tweened as though it were the
  old one. Telling them apart needs a per-node identity the scene does not expose today.

- **(P3) `d3-zoom` / `d3-drag` adapters — parked.** Both duplicate kit systems
  (the `viewport.zoom` / `viewport.pan` actions, `useHandTool`, `useViewAnimation`;
  `useDragGesture`).
  Worth building only for d3 semantics the kit genuinely lacks, not for parity —
  none identified yet.

### Parallax follow-ups

- **(P3) Dispatcher-aware hit-testing for interactive parallax planes.** Needs design pass on plane registration, click resolution order, selection-chrome projection.
- **(P3) `useScene` user-layer `parallax` property wiring to `createParallaxLayer`** at the SceneCanvas adapter seam.
- **(P3) Animated parallax** — tween pan/zoom for intro effects; compose `useAnimator` over the opts.

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

- **(P3) `ToastRegion` portals to `document.body` and cannot be told otherwise.**
  React Aria's `UNSTABLE_ToastRegion` takes its container from
  `UNSAFE_PortalProvider` only, which `@weasel-js/ui` avoids
  (`packages/ui/src/overlays/portalHost.tsx` says why), so a toast raised inside
  a forge trial lands on the page's corner. The Toast story is the one isolated
  story for it. Either give `ToastRegion` a `portalContainer` through a
  provider import that is proven to share React Aria's instance, or render the
  region inline with `position: absolute` under the nearest portal host.

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

## Load cost

Both apps shipped their own source as string literals so a panel could display
it. Read bundle size against module count: the site produced 10.9 MB from 4,047
modules, and that ratio — not dependency bloat — is what points at data-as-code.

Measuring before/after in one tree means `dist-demo/` holds whichever build ran
last, which is not always the one you think. Check the entry chunk's hash
against the build you mean to inspect before believing a grep over it — the
failure is silent and reads as a clean result.

---

Still open, measured 2026-08-23. The two big load-cost fixes it sat beside —
the demo site's eager `import.meta.glob` and `apps/draw`'s embedded source —
shipped 2026-08-23/24; `git log` has their numbers, and their traps are in
`CLAUDE.md`.

- **(P3) `apps/draw` fetches the Inter atlas on the critical path for text.**
  `inter.json` + `inter.png`, 212 kB together, on every load. It is fetched once, not
  twice: production's first load fetches each file once, and so does the dev server
  (headless Chromium, 2026-09-28) — the `packages/hud/src/fonts/inter.*?import&url`
  requests beside it are ~600-byte modules exporting a URL, not a second download. What
  is left is only whether text should wait on 212 kB at all.

- **(P3) Re-measure cold dev startup for `apps/draw`.** The two inspector-only
  Vite plugins that dominated it — together, **6,852 ms to 3,556 ms (−48%)** when
  removed — have both moved since. `callbackSourcePlugin` is now opt-in behind
  `WEASEL_CALLBACK_SOURCE`, and `weasel:trait-schemas` computes lazily in
  `load()` behind a `React.lazy` dev surface, so its 6,305 ms of ts-morph should
  no longer be on first paint. Neither claim is measured. Dev-only either way:
  production cold load is 8 requests / 939,885 bytes / FCP 216 ms, against dev's
  974 requests / 15,684,571 bytes / FCP 6,852 ms.

**Tree-shaking is exonerated for both apps** — a single-symbol build of
`@weasel-js/core` is 1.04 kB, and barrel versus deep-path imports of
`SceneCanvas` agree within 0.04%. Its ~596 kB is genuinely the renderer,
dispatcher and tools. Nobody should spend time there.

Other hypotheses tested and **false**, recorded so nobody re-tests them: no font is
base64-embedded and there are no `@font-face` rules; startup does no meaningful
work beyond bundle parse and first render (shader compile 0.3 ms, `linkProgram`
0.0 ms, `JSON.parse` 0.1 ms over 508 bytes, localStorage 1.1 ms, no schema
validation, no migrations); barrel over-inclusion is real but trivial — features
WeaselDraw never calls total ~17 KB unminified, about 2 KB gzipped. The kit's
702,393 minified bytes are features the app genuinely uses.


---

## Demos & visual regression

- **(P3) A minimal public stage for package demos.** A demo of a scene-free package that only
  draws still has to mount a whole `SceneCanvas`: `TextScriptDemo` (`text`) does, with no
  features. (`GeomDemo` and `AudioDemo` use it for pick/move dragging, and `QuantityDemo` and
  `BidiDemo` draw nothing on a canvas.) Not the primitive `<Canvas>`, which was unexported on purpose. Enforce its reach in
  `packageDemos.test.ts` so it cannot spread: only a Packages-section demo of a scene-free
  package may import it.
- **(P3) The edit overlay can break a wrapped line where the canvas does not.** Under `TextStyle.wrap`, `layoutRuns` breaks only at spaces, while the overlay's `white-space: pre-wrap` follows the browser's line-breaking rules — after a hyphen, between CJK characters. Such a line reflows when an edit opens. Nothing in CSS limits break opportunities to spaces, so this is a layout change (UAX #14 in `layoutRuns`) or a DOM one (each word in a `nowrap` span).

- **(P3) SVG export writes wrapped text as one line.** `data-weasel-wrap` round-trips `TextStyle.wrap` for weasel's own reader, but SVG `<text>` never wraps, so any other reader draws a wrapped node as its unbroken lines. Exporting the laid-out lines needs fonts at serialize time, which `@weasel-js/svg` does not have.

---

## Backends (WebGL future)

From the WebGL transition spec — all deferred:

- **(P3) WebGPU backend.** Separate future spec.
- **(P3) Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win, significant API complexity. Defer until measured pain on the single-thread pipeline. (Note: `OffscreenCanvas` is already used on the main thread for pattern-tile rasterization in `packages/core/src/features/patterns/` — that's not worker offload; the worker move is the open item.)
- **(P3) Exotic composite operations** (xor, custom Porter-Duff) via framebuffer pingpong — deferred from v1 GL.
- **(P3) Headless server-side rendering in Node.** The browser/worker headless path landed 2026-07-19 as `renderSceneToPixels` (`packages/core/src/canvas/renderSceneToPixels.ts`, public) — it accepts a caller-supplied `gl`, so it already works with an `OffscreenCanvas` in a worker. Remaining P3 scope is specifically Node: verify against a caller-supplied `gl` from `headless-gl` (untested there), or wire up a worker + `OffscreenCanvas` path for a Node-hosted consumer.
- **(P3) Raster session API** — amortize per-call shader compilation when a consumer renders many thumbnails/pages against one context. `renderSceneToPixels` currently constructs + disposes a `WeaselRenderer` per call; on a caller-owned context the WeakMap-keyed image/mesh caches also accumulate across calls until the context is recycled — a session would own both.
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
  across 103 files), `immutability` (18), `set-state-in-effect` (21),
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

- **(P2) Benchmark HUD text against a transparent DOM overlay.** Two ways to
  put text over the canvas: `@weasel-js/hud` draws it as canvas commands, or a
  transparent `@weasel-js/ui` layer sits above the canvas and lets the browser
  lay it out. Nobody has measured which is cheaper, or where the crossover is —
  candidate axes are glyph count, update rate (a per-frame readout versus a
  static label), and whether the text moves with the camera. The answer decides
  what the kit recommends for HUDs, inspectors and labels, so it wants numbers
  rather than an argument.

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

- **(P3) Two microbenchmarks time their own setup, and vitest 5 no longer
  forces them to.** `tessellate.bench.ts`'s `getMesh miss` resets the cache
  inside the timed body, and `scene-ops.bench.ts`'s cold `renderOrder` walk is
  recovered by subtracting a separately-timed layer reorder. vitest 4 gave
  `bench()` no per-iteration hook; vitest 5 passes tinybench's `beforeEach`
  through the options argument, and it runs untimed before every iteration.
  Moving both setups into it measures the thing directly, but renames or drops
  benchmarks, so it goes with a re-record of `tests/perf/bench/baseline.json`
  on an idle machine — which also moves that file off vitest 4's shape.

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

---

## Documentation

- **(P3) Public API surface: what the JSDoc audit and typedoc still report.**
  `npm run audit:jsdoc` resolves every export reachable from each package's
  published entry points to its definition site and reports what is missing;
  `npx typedoc` reports types a documented export references but the barrel
  does not export. Run both before adding an export. Test-only reset hooks go
  on a package's `test-seams` entry (`@weasel-js/font`, `@weasel-js/text`,
  `@weasel-js/core`), never its barrel.

  - **One undocumented export: labkit's `rectsEqual`.** `@weasel-js/labkit/surface`
    exports it, but only `useTiledSurface` and its own test call it, so it reads as
    internal: document it or take it off the entry. (2026-09-28: 404 → 1.)
  - **`forceRelaxation` exposes an unexported type.** `@weasel-js/diagram` exports it and
    `ForceRelaxation` from both its barrel and `/layout`, but the type's `Body[]` is not
    exported: export `Body`, or take the function off both entries (its only callers are
    `force` in `force.ts` and `live.ts`).
  - **Four stray `@experimental` tags in core's icon files.** The align, distribute, boolean
    and edit icon files (`packages/core/src/interactions/actions/defaults/icons/`) carry the
    tag in a file header, where it attaches to a private constant and marks nothing. Move it
    onto the icons or drop it.
  - **Three `@internal` exports still reach a consumer entry**, all in
    `@weasel-js/routing`. `KeyBinding` is the parameter of `matchesKeyBinding`,
    which core's barrel exports, so either the marker is stale (as
    `evaluateEnabled`'s was) or `matchesKeyBinding` comes off core's barrel.
    `DispatcherViewTarget` and `ViewIdResolver` type the `@internal`
    `UseGestureDispatcherOptions.views` option, which core's view registry
    fills from across the package boundary; routing has no non-public entry
    to put them on, so this is a question of whether it should get one.
  - **typedoc's one remaining warning is `ReorderArgs`.** Every other op's
    `*Args` shape is listed in `typedoc.json`'s `intentionallyNotExported`
    as an internal composition detail, yet each is the parameter type of a
    public `create*Op` factory, so a consumer calling one cannot name what it
    passes. Export the `*Args` family or keep it off the barrel; `ReorderArgs`
    follows whichever is decided.
