# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@weasel-js/core`). The
kit aims to be a generic 2D scene-graph foundation. Items here are evaluated
for cross-app reuse, not consumer-app value.

For history of completed work, see `git log` and the dated specs/plans under
`docs/superpowers/specs/` and `docs/superpowers/plans/`.

Priority tags:
- **(P1)** — foundational genericity gap; the kit can't do this today
- **(P2)** — broad reuse, or friction-likely
- **(P3)** — specialized, or resting on a foundation not built yet

---

## High-priority index

### Next up

- **Animation timelines + hierarchical rig** — spec'd, phase 1 next → [Animation](#animation)
- **`@weasel-js/audio`** — spec'd, phase 1 next → [Audio](#audio)
- **Side-scroller demo** — after the two above, as a load test on both → [Animation](#animation)
- **Per-command draw cost** — solid geometry batches; what is left is the flush itself, which stalls on rewriting its own buffer. Plan + traps in `docs/handoffs/2026-08-14-batched-dispatch.md` → [Release-gate & build hygiene](#release-gate--build-hygiene)
- **Undoing a boolean op leaves the wrong selection** — history carries no selection snapshot → [Selection, actions & UI panels](#selection-actions--ui-panels)
- **Audit for duplicated-then-drifted cascades** — two implementations of one lookup, agreeing by coincidence → [Selection, actions & UI panels](#selection-actions--ui-panels)

### P2 — broad reuse / friction-likely

**Text**
- Cross-browser overlay alignment → [Text](#text)

**Scene, adapters & layout**
- `arrayAdapter` as default Canvas adapter — full unification → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: drop rejection signal → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: multi-select drag into a layout container → [Scene, adapters & layout](#scene-adapters--layout)

**Selection, actions & UI panels**
- labkit `registerSerializers` has no callers; instrument serializers never run → [Selection, actions & UI panels](#selection-actions--ui-panels)

**Lint**
- `eqeqeq` (285) and `no-unused-vars` (129) deferred from the 2026-08-22 baseline → [Lint](#lint)

**Tools & gestures**
- `ToolCtx` hard-codes 2D, blocking tool reuse by another kernel → [Tools & gestures](#tools--gestures)

**Viewport**
- Viewports as a first-class canvas concept (input, not just render) → [Viewport](#viewport)

**Plugins & packaging**
- Barrel-hygiene: selection (pending design review) → [Plugins & packaging](#plugins--packaging)
- `weasel-js` unscoped alias is unpublishable under that name → [Plugins & packaging](#plugins--packaging)

**Performance**
- A clipped group costs ~10 us to enter, half of it the stencil → [Release-gate & build hygiene](#release-gate--build-hygiene)
- A solid boundary costs 2.5 us where every other kind costs under one → [Release-gate & build hygiene](#release-gate--build-hygiene)

**Documentation**
- Surface a changelog on the site → [Documentation](#documentation)
- README pitch sweep → [Documentation](#documentation)

---

## Tools & gestures

<!-- The arbitration-layer items below came out of a read-only review of that
     layer against CSS cascade / Flutter's gesture arena / Blender keymaps /
     tldraw's StateNode chart. Reasoning that did not compress into these
     entries — including why specificity-ordered fall-through is survivable at
     all — is in docs/handoffs/2026-07-28-arbitration-followups.md. Reviewed
     2026-07-28, re-verified against main 2026-07-31. -->

- **(P2) No opt-out for individual standard actions.** `useStandardActions`
  registers a fixed descriptor list, so a consumer wanting its own align or
  distribute keybindings cannot suppress the kit's. `useAlign` /
  `useDistribute` each carried an `enableKeyboard` option documenting exactly
  that opt-out, but neither hook registers anything, so the option never did
  anything; both were removed 2026-08-22. The capability is still wanted — it
  belongs on `UseStandardActionsOptions`, which is the only place that can
  honor it.

- **(P2) `useHandTool`'s `inertia` and `axis` options are inert.** The hook
  reads both into locals, calls `useVelocityTracker()` and `useDecayLoop()`,
  and then uses all four only as `useMemo` deps — the memo body builds a tool
  whose sole binding routes `drag` to `viewport.dragPan`, which implements
  neither. An `eslint-disable` on exhaustive-deps sits over the dep array.
  `<SceneCanvas viewport={{ inertia }}>` threads a full config
  (`friction`, `minSpeed`, `boundary`, `bounds`) all the way down to nothing.
  `useDecayLoop` and `useVelocityTracker` are themselves implemented and
  tested, so this is wiring, not new machinery. Same family as
  `useLassoTool`'s `mode` / `behaviors` and `Tool.onActivate`: public,
  documented, silently no-op. Found 2026-08-22.

- **(P3) A second finger still fires `pointerDown`-spec bindings.** Found while
  giving each pointer its own gesture channel (2026-08-01).
  `onPointerDown` dispatches the eager `stage: 'press'` copy
  before the multitouch claim runs, so starting a pinch runs `select.pick` for
  the second finger and can change the selection under the gesture. Pre-existing
  — the press dispatch was always unconditional — and out of scope for the
  gestureId fix, but it's the same family of bug: a pointer that is part of a
  pinch shouldn't be acting on its own. Fix is probably to defer the press
  dispatch by a frame, or to re-dispatch a cancel for claimed pointers.

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

- **(P3) Interacting through a viewport.** `createViewportLayer` has no
  hit-test re-projection, so a press inside a loupe or minimap targets the outer
  view — it would act on whatever sits under the window on the real canvas, not
  on what the user sees magnified. `hud.window()` claims every interior press to
  prevent that. Wiring re-projection would let anchor placement happen *in* the
  magnified view, which is the point of a loupe for precision work.

- **(P2) No render path composes world poses.** Every painter — `buildSceneTree`
  (so `<SceneCanvas>`) and `buildSceneViewCommands` (so the detached surfaces) —
  draws each node at `getPose(id)`, which is documented as **local**, relative to
  the parent. Nesting contributes the clip chain and nothing else;
  `composeWorldPose` is called only by `move`, `duplicate` and `nestedHit`. That
  is consistent under the default `IDENTITY_POSE_COMPOSITION`, where every node
  already stores world coords — but a consumer who supplies a real
  `poseComposition` (say `composeRectPose`) gets children painted at their local
  offsets on **every** surface, main canvas included. Either rendering learns to
  compose, or `PoseComposition` is documented as interaction-only and the render
  path is pinned to absolute poses. Verified 2026-08-13 by diffing the two walks
  against the same nested scene; both placed the child identically.

- **(P3) Unconfirmed: resize grabs the node under the handle, not the selected one.**
  Reported 2026-07-28 against **lbx-editor**, which consumes `@weasel-js/core@0.6.0`
  from npm — published Jul 26 20:03, i.e. 54 commits and one whole dispatch
  architecture behind. The installed dist still ships `createToolsDispatcher` and
  `claimsAll`, so it runs the **phase-table pipeline deleted on main** (`adc17bec`),
  where affordance hits reached actions through `composeAffordanceLayer`'s layer
  `hitTest` rather than through `affordanceAt`. lbx-editor also passes
  `selectTool={{ rotate: false }}`, and that older mechanism needed the rotate tool
  mounted as `ambient` to see selection chrome at all — a plausible mechanism for
  the report, and one that no longer exists.
  **Not reproducible on main.** Five configurations in apps/draw — overlapping node
  above the handle, rotated selection, click-without-drag, multi-select union
  handle, several zooms — all dispatch `resize` against the selected node with the
  selection intact. `select.pick` declines chrome in its *spec*, so a press carrying
  an affordance never reaches it, and the hit radius is scale-corrected.
  Re-test when lbx-editor next takes a kit bump; close if it's gone.

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
  batch per file). weaseldraw runs with `unpack` on. Remaining:
  (a) **embedded SVG blurs under zoom** — `imageCache` rasterizes once at
  natural size; re-rasterize at view scale (or draw from the live `Image`
  element) if crispness matters; (b) **a gradient *stroke* still flattens** to
  a solid fallback in unpack. Fills stopped flattening 2026-08-16 — the
  recorded blocker ("the `kit:path` painter data contract has no gradient
  slot") had not been true for some time; `NodeFill` is `string | FillStyle`.
  `data.stroke` genuinely is a color string, and giving it a paint slot means
  changing the painter, not the importer; (c) **text box width is estimated** on the unpack path — external
  `<text>` carries `UNBOUNDED_TEXT_WIDTH` rather than a measurement, and
  unpack has no text-measure context, so it guesses from the longest line at
  0.6 em per glyph (closed 2026-08-16, along with `fontSize` joining the
  fit-clamp); a real measure would want the atlas; (d) weaseldraw's file-menu import still uses its own
  app-local `svgInterop` mapping (richer: `wd:` tool metadata, paper size)
  — fold the shared walk if they drift, and note it now *drops* `<image>`
  nodes, since the app's `Obj` union is path/text only.

- **(P3) External-content ingestion — follow-ups.** Shipped 2026-07-03 (spec
  `docs/superpowers/specs/2026-07-03-content-ingestion-design.md`, plan
  `docs/superpowers/plans/2026-07-03-content-ingestion.md`): drop/paste
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
  drop/paste-text-to-canvas is an open question (see the discussion that
  spawned this — it's a marginal convenience with no consumer asking).
  Closed 2026-08-16: (d) `drop` and `paste` are route-grammar gesture names,
  targetless, carrying the MIME-glob filter as their arg (`drop(image/*)`);
  (e) paste now dispatches first and `preventDefault`s only on `'handled'`,
  wheel's shape — clipboard items materialize synchronously, so unlike drop the
  result is known while the default can still be suppressed, and a paste no
  binding wanted stays the page's.

- **(P3) Reshape `selectionOverlay` into a thin override hook.** The chrome-affordances spec shipped (2026-06-13): the multi-resize union now has a single owner — `ChromeState.unionBounds` — which both the affordance hit-tester (`affordanceAt` / `composeAffordanceLayer`) and the overlay layer read at draw time. The inline `poseById` re-derivations in `Canvas`/`SceneCanvas` are deleted, `createSelectionOverlayLayer` resolves the synthetic union from the draw-time chromeState envelope, and `MULTI_RESIZE_TARGET_ID` moved to `core/selection/` (fixing the backwards `affordances→tools` import). Residual: the synthetic-id plumbing (`getSelection` → `[MULTI_RESIZE_TARGET_ID]`, `getOutlineIds` → real members) still lives in the Canvas/SceneCanvas wiring rather than inside `createSelectionOverlayLayer`. Fold it into the layer so the slot is purely a consumer override hook.

- **(P3) The ambient rotate-tool mount is near-vestigial.** Left standing when
  the two affordance hit-test mechanisms were consolidated onto
  `hitAffordanceRegions` (2026-08-01): the rotate tool now has no bindings, and
  its overlay paints nothing unless a consumer opts into a visible ring.
  Removing it means dropping `'rotate'` from `BuiltinToolId` / `BUNDLE_TOOLS`
  and unexporting `useRotateTool` — a public-API change, so it wants its own
  decision. **Now decidable by inspection** (2026-08-10): one registry holds
  every entry with its declared eligibility, so "contributes no bindings and no
  overlay" is a property you can read off the assembled set rather than infer.

- **(P3) `EligibilityState.heldTriggers` is unexercised in production.**
  `Eligibility.offhand` names a trigger key and `liveScope` resolves it, but
  nothing populates `heldTriggers` — `tool.offhand`'s invoker still reports
  engagement by pushing a tool *id* onto the hotkey stack, which
  `engagedIds` reads. So the declaration registers the binding while the id
  keeps carrying the tier. Retiring `engagedIds` means changing
  `tool.offhand`'s contract. Recorded 2026-08-10.

- **(P3) Other drag-insert tools.** Deferred from `docs/specs/2026-05-05-drag-insert-primitive-design.md`. The consolidated `useDragRect` + `useInsert` + `defineDragInsertTool` stack makes a new drag-insert tool a thin Tool veneer. Polygon, star, ellipse, line, and image tools have landed (`packages/core/src/tools/builtin/{polygon,star,ellipse,line,image}/`); each further type is its own task.

- **(P3) Promote `hitExistingGate` to gate select-tool's move/resize paths.** Deferred from `docs/specs/2026-05-05-drag-insert-primitive-design.md`. Different responsibility (gating mutation gestures rather than insertion), different gesture surface, so it wants its own design pass rather than an extension of this one.

- **(P3) Evaluate `useResize`/`useRotate` against `useDragGesture`.** Deferred from `docs/specs/2026-05-05-drag-gesture-base-design.md`. After the dragRect/move migration landed, evaluate whether resize and rotate fit cleanly on the new base. Their state shapes (per-id pose map keyed by handle/center, multi-target union AABB) are different from move's flat pose map and may not benefit. Revisit only if/when their scaffolding diverges from the base in a way that costs maintenance.

- **(P2) `ToolCtx` hard-codes 2D, so tool authoring can't be reused by another
  kernel.** `worldX: number` / `worldY: number` are flat scalars rather than a
  point type, and `view: View` / `setView` are the 2D affine camera — so there
  is no seam to swap. Everything else on the interface is already
  dimension-neutral: `adapter: unknown` is opaque by design, `applyOps` takes
  `Op` from `@weasel-js/history`, `selection` is id-based, and `canvasRect` /
  `screenPoint` are screen space, which stays 2D in any kernel. Making
  `ToolCtx` generic over its point and view types would make the tool
  authoring model portable — a tool declares bindings and an action, and the
  spatial types come from the kernel it is mounted in. `Scene<TData, TLayer,
  TPose>` is already generic over pose, so the precedent exists. This is a
  type-level change with no runtime behavior change for 2D; the payoff is
  contingent on a second kernel existing, which is why it is P2 and not P1.
  Scope is wider than `ToolCtx` alone: `pickBest`/`pickEvery` repeat the same
  flat-scalar shape, and `Bounds` (`{x, y, width, height, rotation?}`, in 92
  non-test files) is the type every injected pose function must return — it is
  the widest of the three and decides whether the rest is worth doing. 23 hard
  casts to `RectPose` across `interactions/actions/defaults/move.ts`,
  `defaults/group.ts`, `canvas/NodeShape.ts`, `canvas/deps/editAnchors.ts` and
  `canvas/SceneCanvas/useSceneSelectTool.ts` bypass the generic seam and would
  retire with it. Audit findings and phasing in
  `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`.

### Pen tool follow-ups

From `docs/specs/2026-05-03-pen-tool-design.md`:

- **(P3) Snap-to-existing-anchors** (cross-path anchor snapping). Clicking near an existing path's anchor would coalesce. Useful for stitching paths. (Only a generic grid `snapPoint` exists today, not anchor magnetism.)
- **(P3) Continue an existing path's open endpoint.** Click an existing open path's first/last anchor to pick it up and append. No extend-from-endpoint path exists today.

### Tool overlay channel deferrals

From `docs/specs/2026-05-03-tool-overlay-channel-design.md`:

- **(P3) Subscription / push model.** Today the channel is pull (Canvas asks each frame, scratch is read via React closure). If a tool needs to push state changes outside the React render cycle, add an imperative `tools.publishOverlay(toolId, layer)` channel.

### Slice tool follow-ups

From `docs/superpowers/specs/2026-06-17-slice-tool-design.md` (shipped 2026-06-17):

- **(P3) Bézier-preserving + concave finite-cut (Approach B).** v1 flattens béziers on cut pieces and an infinite-line half-plane clip can over-cut concave shapes the finite stroke only partly crosses (pinned in `splitByLine.test.ts`). `splitPathByLine` is the single swap point for a chord-split Approach B + `schneiderFit` curve re-fitting.

---

## Viewport

- **(P2) Viewports as a first-class canvas concept.** `createViewportLayer`
  re-projects on request (`layer.reproject(outer, dims, screen)`, `viewportsAt`
  for the topmost of several, shipped 2026-08-15), but the dispatcher knows
  nothing about viewport rects, so tools still target the outer view — you
  cannot drag a node inside a PiP. Making that work wants a `viewports` prop on
  `<SceneCanvas>` feeding both render and input.

  The mechanical parts are small, and the input seam already exists:
  `SceneCanvas.tsx:2220` wraps `affordanceAt` / `classifyTarget` to convert
  client → world, which is exactly where "use the inner view when the point is
  inside a viewport" belongs. The cost is the semantics, and they are open
  questions rather than work items:

  - Which view does a gesture inside a viewport act on? A two-finger pinch in a
    PiP could zoom the inner view or the outer one; both are defensible.
  - What does a drag that starts inside the rect and leaves it do?
  - Which viewport wins when two overlap — paint order, or an explicit z?
  - Does selection chrome render inside a viewport? Screen-space source layers
    do not today (noted in `features/viewports/README.md`).

  Answer these from the shape of the viewport model rather than guessing; the
  re-projection primitive above is the piece this would call once it knows
  which viewport owns the point. `<MinimapCanvas>` / `<SceneViewCanvas>` remain
  the supported answers for the two common cases.

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

- **(P3) Typed discriminated union for multi-type insert.** Deferred from `docs/specs/2026-05-07-viewport-followups-design.md`. Current shape splits into `posefromBounds(bounds) → TPose` + `pointInsert(point) → TNode` (`packages/core/src/interactions/actions/insert/options.ts`); multi-type canvases (rect vs image vs ellipse from one `<SceneCanvas>`) wire their own `tools` array (one `useInsertTool` per type) rather than folding a variant switch into the insert options. The single-canvas multi-type ergonomic is the open design question.

---

## Paths & booleans

- **(P2) `pathHitTest`'s rect/polygon kernel throws on curves and treats a
  donut as solid.** `extractVertices` walks only `M`/`L` and `throw`s on any
  bezier command, and it stops at the first `Z`, so only the first subpath is
  ever considered. `pathContainsRect` / `pathIntersectsRect` /
  `pathContainsPolygon` / `pathIntersectsPolygon` all inherit both. The throw
  is reachable in ordinary use: `sceneAdapter`'s `nodeBoundsPassClips` calls
  `pathIntersectsRect` on every ancestor clip, so a container with a curved
  `clipFromPose` crashes the hit-test walk. Separately,
  `polygonHitTestRect.ts` always answers even-odd while documenting that it
  matches `pointInPath`, so `pathContainsPoint` and `pathContainsRect`
  disagree on the same `nonzero` path. Fixing this wants a decision about the
  kernel's contract — flatten curves and honor `fillRule`, or narrow the
  functions to polygons and make callers promote — not a patch. Found by the
  2026-08-22 review; see `docs/reviews/2026-08-22-core-geom-dupes.md`.

- **(P2) `packages/core` re-implements much of `@weasel-js/geom`, and the
  copies have drifted.** Roughly two thirds of geom's public surface has no
  importer in core. `forEachSegment` is written about a dozen times, two
  copies wrong: `tessellate.ts` treats `PATH_Z` as a no-op instead of
  returning the pen to the subpath start, and `pathDistance.ts` dispatches
  through an `if`/`else if` chain with no `else`, so an unrecognized command
  leaves `ci` unadvanced and every later coordinate read is misaligned.
  `PATH_CMD_LENGTHS` has three further private copies whose `undefined`
  lookup makes `ci += undefined` a `NaN` index — every later typed-array
  write is then a silent no-op. Six independent `cubicEvalAt`s.
  `poseDescriptor.ts`'s hand-rolled `boxToBox` disagrees with geom's on the
  degenerate axis. The unification should carry `pathCrop`,
  `flattenQuadratic` and the arc-length flatteners into geom rather than
  leaving core a rump copy. Full inventory in
  `docs/reviews/2026-08-22-core-geom-dupes.md`.

- **(P3) `<style>`-element and class-selector support for `@weasel-js/svg`.** The presentation-attribute cascade now threads a resolved `StyleContext` through the recursive parse (`packages/svg/src/cascade.ts`, shipped 2026-07-25; spec `docs/superpowers/specs/2026-07-25-svg-cascade-context-design.md`, plan `docs/superpowers/plans/2026-07-25-svg-cascade-context.md`). Inheritance, the `inherit` keyword, `style=""`, text/`<tspan>` cascade, and `currentColor` all resolve without per-attribute DOM walks (`readInheritedAttr` deleted). Still unsupported: `<style>` elements and class/selector matching — the cascade handles inheritance, not selector specificity. `style=""` remains a regex scan, not a full CSS parser (`!important` unsupported). Selector matching is the missing piece; the threaded-context fast path could compute the per-element cascade from `getComputedStyle` against a hidden DOM node in the browser.

### Pathfinder follow-ups (post-v1)

Core five + Crop shipped. Remaining:

- **(P3) Outline.** Stroke-to-fill silhouette — needs proper offsetting with joins/caps/self-intersection cleanup. No lightweight JS lib without major deps.
- **(P3) Trim and Merge.** Remove hidden portions / Trim + same-color reunion — need per-path style awareness, which the kit deliberately doesn't have since `data` is opaque. Wait on a compound-path-with-styles model.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** v1 flattens beziers before clipping; the result is straight-line. Skia/PathKit-style curve-preserving booleans are next-level — substantially harder.
- **(P3) Live preview during the gesture.** Holding the op key while hovering a path to see the result before committing.
- **(P3) Boolean ops on stroked paths.** Treat a stroke as a filled region, then clip. Blocked on stroke-to-fill (round/bevel/miter joins, end caps — its own design problem).
- **(P3) Pathfinder against text glyphs.** Needs glyph-to-path extraction.

---

## Rendering & paint

- **(P3) Pattern fills: what the tile picker left open.** The texture half of
  fill-mode expansion shipped 2026-08-12 — patterns tile, carry a serializable
  `TilePatternSpec`, round-trip through SVG `<pattern>`, and have a picker in
  WeaselDraw. Three things it deliberately did not do:

  - **Image-upload patterns.** The picker covers the four built-in tiles only.
    A user-supplied bitmap needs a payload variant that persists the image
    itself (data URI, or a document-scoped asset table), which is a storage
    question rather than a paint one.
  - **Patterns on text.** `data.style.fill` takes a `FillStyle`, and above the
    outline-tier threshold a glyph is a `PolygonPath` drawn through
    `drawPathFillByKind`, so this already renders. What's missing is the panel
    routing: the fill-kind switch edits `data.fill`, so reaching text means
    the switch has to write the text branch instead.
  - **Tile rotation / skew.** SVG has `patternTransform`; the paint has only an
    origin. Rotating a hatch is the obvious first ask.

  Also unresolved from the gradient half: `gradientXml` returns `''` for conic,
  which SVG cannot express at all. It now warns through
  `SerializeOptions.onWarn` rather than vanishing silently, but still exports
  as nothing rather than as an approximation.

- **(P3) Layer effects framework.** Distinct from `FillStyle` — effects modify pixels rather than choosing color. Under WebGL each effect is its own pass: drop-shadow needs a blurred render-to-texture beneath, blur needs a separable kernel, blend modes need framebuffer compositing, clipping needs stencil. Likely shape: `type Effect = { kind: 'shadow' | 'blur' | 'composite' | 'clip' | 'transform'; ... }` consumed by the renderer (not the layer) so each effect knows how to set up its own GL state. Open question on composition model: per-layer `effects?: Effect[]` option vs a wrapper layer (`withEffects(layer, effects)`).

- **(P3) Promote `ShaderDrawCommand` past `@experimental`.** Three uses now exercise it (plasma / ripple / voronoi panels), which is enough to have validated the surface. Open questions before stabilization: (a) array uniform binding shape — currently consumers must pass per-slot keys (`u_ripples[0]`, `u_ripples[1]`, …); should the kit accept a flat `Float32Array` and split it? (b) hot-reload story for `registerProgram` re-registration; (c) how to expose the renderer's program registry without leaking internals (`shaders` prop is the seam, but consumers writing custom RenderLayers may want more).

- **(P3) `extractUniformNames` regex coverage.** Two of the three gaps this
  entry used to claim were never real: matrix arrays (`mat3 u_xforms[4];`) and
  layout qualifiers both already worked — `\S+` takes any type name, and
  `\buniform` skips whatever precedes it. What *was* broken and is now fixed
  (2026-08-16): a precision or interpolation qualifier (`uniform highp float
  u_t;` — the common spelling in hand-written GLSL) matched nothing at all, so
  the uniform got no location and every write to it was dropped silently.
  Comma-separated declarator lists (`uniform float a, b;`) read too.

  Still a regex scan, not a parser, and still blind to GLSL preprocessor
  branches, struct uniforms and interface blocks. Those want the bite-the-bullet
  GLSL-prelude parser. **Check the claim before
  planning around it** — this entry was wrong for months because nobody ran the
  regex against the case it described.

---

## Text

- **(P3) `.dfont` machine faces still can't reach the outline tier.** The
  *silence* closed 2026-08-16 — `isDataForkFont` recognizes a Macintosh
  resource fork by its header offsets and `sfntFromCollection` throws by name,
  so the face degrades to the SDF tier saying why. Actually reading the `sfnt`
  resources out of the map is unwritten and unreachable on current macOS (204
  `.ttf` / 128 `.ttc` / 38 `.otf`, no `.dfont`). Design record for the whole
  tier: `docs/concepts.md` ("Font outlines") and
  `docs/handoffs/2026-07-31-dynamic-font-tier.md`; the settled argument for
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

- **(P2) Cross-browser overlay alignment.** `placeOverlay` uses an empirical `(+1, -1)` CSS-px nudge to compensate for canvas/CSS rasterization disagreement. Works on the dev setup; not universally correct across browsers/fonts/DPRs. A self-correcting probe was attempted and rejected.

- **(P3) `rangeStyle` and the un-set toggle disagree about the node's flags.**
  Surfaced 2026-08-16 while wiring `setStyle` through `useSceneTextEdit` (the
  scene wrapper now supplies it by default, so a scene-wired consumer no longer
  has to, and `apps/draw`'s bar works). `styleAtRange` reads the *runs* alone,
  so over a plain run inside a `fontWeight: 700` node it reports `bold: false`
  — and `useTextEdit`'s Cmd+B reads the same value, so the keystroke *adds*
  bold rather than clearing the node flag. The `setStyle` path is reachable
  only when the runs are themselves bold. Consumers paper over the display half
  by merging the node style in (draw's `effectiveRangeStyle`), which means the
  bar shows bold while the toggle believes otherwise. Decide whether
  `rangeStyle` should fold in the node style — and if so, `current` in the
  toggle has to fold it too, or the two drift the other way.

  Unchanged and deliberate: a node at `fontWeight: 900` stays declined
  (`applied: false`) — `run.bold` is exactly 700, so pushing the weight onto
  the runs would lighten the text that was not edited.

- **(P3) Per-character tracking in the DOM overlay is CSS-approximate.**
  `letterSpacing` is applied per code point rather than per grapheme cluster,
  matching CSS rather than the GL path's cluster walk. Visible only on text
  with combining marks or emoji sequences.

- **(P3) Decoration thickness is derived, not read from font metrics.** The
  underline / strikethrough offsets and weight are the fixed `0.10` / `-0.30`
  / `0.05` em constants in `layoutRuns`. Real fonts ship
  `underlinePosition` / `underlineThickness`; the BmFont atlas format does
  not carry them, so honoring them means extending the atlas metrics.

- **(P3) `ToolOptionsBar` is not driven by tool prefs.** Its first tenant
  (draw's `CharacterOptions`) is hand-assembled. A tool declaring a
  `ToolPrefGroup` for its options and having the bar render it the way
  `SelectionPanel` renders node properties is the obvious next step. Once its
  children are bar-owned rather than arbitrary consumer controls, it can adopt
  `useRovingTabIndex` — the opt-out documented on that hook is exactly this
  case.

- **(P3) `ToggleBar.module.css` is a near-copy of the segmented-control
  styles.** The `ActionsBar` / `OptionsBar` duplication closed 2026-08-15 —
  both now import `components/segmentedControl.module.css`. `ToggleBar` was the
  third copy nobody had counted: 216 lines carrying all 188 shared ones plus a
  `.segmentMixed` third state (`aria-pressed="mixed"`) and a `.variant_minimal`
  that genuinely diverges — bordered box, square corners, inner dividers,
  `gap: 0` — where the shared one uses rounded gapped segments.

  Left alone deliberately: those divergences read as design, not drift, and
  folding them in means the shared module becomes a base that `ToggleBar`
  overrides through descendant selectors (`.variant_minimal .segment`), which
  `composes` handles badly. Worth doing only alongside a decision about whether
  the three bars are one component with different affordances.

  Note the dedup was a source win, not a payload one: the merged stylesheet is
  the same size either way (52933 → 52934 bytes), since identical content
  already collapsed to one scoped hash.

- **(P3) Complex-script text shaping (HarfBuzz).** `packages/core/src/features/text/atlas/layoutRuns.ts` walks codepoints linearly and applies BmFont kerning pairs — sufficient for Latin / Cyrillic / Greek / CJK ideographs, wrong for Arabic / Devanagari / Thai / any script needing contextual shaping or reordering. Real fix is wiring a HarfBuzz WASM build (harfbuzzjs ~1MB) behind a feature flag so consumers who only need Latin can stay slim. Touches the layout pipeline only; the renderer already takes pre-laid glyphs.

- **(P3) eric `labelHelpers.ts` deletion check.** Investigate whether eric (`~/src/eric`) can delete its local `labelHelpers.ts` after the text world-unit pass landed. If consumer-side world-unit helpers still cover gaps the primitives don't (e.g. world↔screen pad conversion at the call site), capture the remaining gap as a follow-up primitive proposal.

- **(P3) `markdownToRuns` → AST.** Consider whether markdown markup (today `*`/`**`/`***` bold/italic toggles, parsed with flat boolean state in `packages/core/src/features/text/runs.ts:64`) should be promoted to a structured AST. The output is a flat `StyledRun[]`, not a tree. Defer to a future "rich text" pass — the current shape is sufficient for label/markdown rendering but limits reformatting / re-styling transforms.

---

## Scene, adapters & layout

- **(P2) `arrayAdapter` as the default Canvas adapter — full unification.** Partial work shipped: Canvas synthesizes an adapter from `items`/`setItems`/`toPose`/`fromPose`/`createDefault`/`poseBounds`/`intersectsRect` when no explicit `adapter` is passed. It collapses the flat-list boilerplate but is array-shape specific. The deeper move — every scene is a tree rooted at one container — was taken by `useScene` (kit-owned tree with leaf/container) but the inline-props and explicit-adapter tiers still sit alongside rather than collapsed. Full unification (one adapter contract, one default wiring) remains an option for later.

- **(P3) The group's union box ignores child rotation.** Per-leaf scaling
  landed 2026-08-12 (`remapRotatedLeaf`): a rotated leaf in a group now scales
  along its own axes. What is still unrotated is the *box*. `aabbOfPose`
  returns a rect pose's own `x/y/width/height` rather than its rotated
  footprint, so both the drawn multi-selection union (`ChromeState.unionBounds`
  in `SceneCanvas`, which reads `boundsOf` and ignores the `rotation` it
  carries) and the resize origin (`unionBounds` over `geometry.getBounds`)
  exclude the corners a rotated child actually covers. The two agree with each
  other, so nothing looks broken mid-drag — the group box is just smaller than
  its contents. Fixing it changes what is painted, so it wants eyes on the
  render, and both sites must move together or the visible box and the
  grabbable one diverge.

- **(P3) SceneCanvas → useSceneAdapter for adapter construction.** Surfaced 2026-05-21 during the node-kind registry landing. Today `SceneCanvas` constructs its synthesized adapter inside `useSceneSelectTool` (the select-tool hook), which means every new `SceneToAdapterOptions` field (`layouts`, `cascadeContainerPose`, `kindOf`, …) has to be drilled through the hook's surface. `useSceneAdapter` already exposes the full options shape; lifting adapter construction to `SceneCanvas` and handing the result down would stop the drill-through and shrink `useSceneSelectTool`'s API. Out of scope for the registry work; file when next refactoring the SceneCanvas internals.

### `useScene` follow-ups

- **(P3) Container layout strategies in `useScene`** (today: absolute-positioning only).
- **(P3) Selection-in-Scene vs external.**
- **(P3) Full tier unification** (collapse inline-props/explicit-adapter onto Scene). Same effort as the P2 "`arrayAdapter` as the default Canvas adapter — full unification" above — track there.
- **(P3) Container-pose cascade as a scene-primitive semantic.** Today opt-in via `sceneToAdapter({ cascadeContainerPose: 'rect' })` shipped 2026-05-11 to absorb NestingDemo boilerplate — the deeper move is letting `scene.setPose` on a container cascade natively, which would require a `translatePose` plumbing decision on the `useScene` constructor.

### Container layout strategies (deferred from `docs/specs/2026-05-03-container-layout-strategies-design.md`)

- **(P3) Reparent-on-layout-drop lives in `moveAction`, not the strategies' `commitDrop`** (which are pose-only). If a strategy ever needs container-specific reparent semantics, revisit whether `commitDrop` should own it.
- **(P2) Drop rejection signal.** v1 layout commits a free-space `setPose` when no container accepted a drag. Needs a cleaner semantic — candidates: a dedicated cancel op, a snap-back-to-source-pose path, or having the source layout's `commitDrop` re-place the child at its origin slot.
- **(P2) Multi-select drag into a layout container.** Currently falls through to the per-id transform batch (no `commitDrop` invocation, no sibling reflow). Layout-aware reflow + commit only fire when `scratch.ids.length === 1` in `moveAction`. Decide multi-select-into-layout semantics (sequential commitDrops? grouped layout API?) before lifting the guard.
- **(P3) Z-order walk doesn't cross non-container ancestors.** Open question: when a deep layout container is BELOW (in z) a shallow layout container that shares the dragged point, today the deepest wins — debate whether real z-order across the whole tree (flat painter's order) should win instead.
- **(P3) Tile-grid overflow policy.** Children beyond `cols * rows` are skipped from `childPoses`. Scroll, grow-grid, and rejection are the three policies worth designing between.
- **(P3) Strategy-aware drop regions.** A layout could expose `dropRegion(container) → Bounds` extending beyond visible bounds for forgiveness (e.g. row layouts catching pointers slightly past the row's end).
- **(P3) Stateful layout strategy factories.** All v1 strategies are pure. If profiling shows recompute pain (likely only quadtree-class), promote to a factory returning `(container) → { ... }` with cached state.
- **(P3) Animated reflow transitions.** Sibling reflow is snap-to-target in v1. Smooth interpolation likely needs a `useAnimatedReflow` hook over the animation primitive.
- **(P3) Quadtree / packing layouts.** Niche enough not to belong in the generic kit; stays in eric or a future plugin.
- **(P3) Slot-based layout strategy** (rows / grid / ring arrangements à la eric's `@/model/arrangement`). Worth lifting once the v1 three settle.
- **(P3) Configurable layout hit-test order.** v1 uses top-most container under the dragged center. Innermost-regardless-of-z and explicit-drop-region are the other two modes worth having.

### Tiling

- **(P3) Tiled-content layer primitive.** Surfaced 2026-05-17 by the ParallaxDemo loop work (`4c0e98ef`). The demo's local `tiledProject` helper walks every visible copy of a shape along a periodic x axis, giving seamless infinite-pan looping for free. Generalized shape: a `createTiledLayer<TData>({ source, period, axis? })` wrapper that takes any RenderLayer and produces a periodic version, with `tiledProject(visStart, visEnd, period)` as a public helper. Composes cleanly with `createParallaxLayer`. Open questions: 2D wrap (`period: number | { x, y }`); period as a function of view/dims vs constant; per-shape vs per-layer period. Demo today: `apps/site/demos/ParallaxDemo.tsx`. Likely lives at `packages/core/src/features/tiling/` or alongside `createParallaxLayer` in `packages/core/src/features/parallax/`.

### Units

- **(P3) Per-subobject scale.** Today the unit system is global per consumer. Real apps want a child object (a sub-assembly in a CAD scene) to declare its own unit/scale, with conversion at the parent boundary. Likely lives on the parent/group node.
- **(P3) Mixed-unit arithmetic** (`50% + 2ft`) — needs a context to resolve percentages against. Separate design problem.
- **(P3) Per-axis units** — x and y carrying different units (timeline charts where x is time and y is value).

---

## Animation

### Timelines and rigging (active)

Design: `docs/superpowers/specs/2026-08-22-animation-timeline-rig-design.md`.
Arc context: `docs/superpowers/specs/2026-08-22-game-audio-animation-decomposition.md`.

- **(P1) Timeline primitive** — `animator.timeline(opts)`, registered in the
  animator's table so its playhead is the entry's `virtualNow` and pause /
  time-scale / `cancelKey` apply unchanged. Three track kinds: sampled (pure
  function of `t`, reuses the tween interpolation contract), event (edge
  crossings, silent under seek), and nested timelines. A public frame tick falls
  out of the same mechanism.
- **(P1) Hierarchical rig** — skeleton of named joints with their own TRS, poses
  as local deltas, `blendPoses`, `resolveSkeleton`. Binding to scene nodes is a
  dep following the `insert` pattern. Animating a rig is a `SampledTrack<Pose>`
  whose `interpolate` is `blendPoses` — no rig-specific timeline integration.
- **(P2) `loop` cannot be changed after a timeline is created.** `loopsLeft` is
  seeded from `opts.loop` and `TimelineHandle` has no setter, so a transport
  with a loop toggle has to cancel and rebuild the timeline — and hold its track
  array outside the rebuild so `edit()`-added keys survive it. That rebuild is
  the bulk of `apps/site/demos/TimelineDemo.tsx`. A `setLoop` needs one decision
  first: whether enabling looping on a timeline sitting at `duration` restarts
  it, or takes effect on the next pass.
- **(P2) `<Timeline>` editor** — transport, lanes, draggable keyframes,
  per-segment easing. Goes in `@weasel-js/ui` next to `BandEditor`, `Slider` and
  `CurveEditor`; `labkit` has none of those and doesn't depend on `ui`.
- **(P3) Inverse kinematics** — a solver that writes poses. Composes with the rig
  above and needs nothing here changed.
- **(P3) Skinning** — per-vertex bone weights deforming path geometry. The
  renderer flattens paths to meshes, so weights must reach the vertex shader or
  be applied on the CPU per frame. Needs the hierarchical rig first.
- **(P3) Serializable clips** — follows from tracks being typed callbacks rather
  than data. Revisit with the editor's experience in hand.

### Side-scroller demo

Runs after the timeline and audio arcs land, as a load test on both — a
platformer drives them harder and more continuously than any editor interaction
does. Demo-local: frame loop, collision, tile map. Kit changes it is expected to
surface: a source rect and flip on `ImageDrawCommand` (sprite sheets currently
need a custom shader via `ShaderDrawCommand`), and a key-state poll over the
public `key-held` edges.

A platformer in `apps/site/demos/` is a deliberate exception to the terse,
single-purpose demo convention — an exception, not a precedent.

- **Tune the camera dead zone in the browser.** `DEAD_ZONE_X` in
  `apps/site/demos/platformer/camera.ts` is a placeholder at 28 (vs
  `DEAD_ZONE_Y` at 20); pick the real value on feel once the demo is playable,
  at the plan's Task 12. A dead-zone camera settles at exactly `DEAD_ZONE_X`
  from a stationary target, so `platformerCamera.test.ts` asserts that
  invariant rather than a fixed distance — changing the constant does not
  break the test.

### Earlier deferrals

All from `docs/specs/2026-05-04-animation-primitive-design.md`. The first two are
absorbed by the timeline arc above:

- **(P3) Animation events / observability** — global subscribe API for debug overlays / analytics.
- **(P3) Animation-aware undo** — "rewind the animation" instead of cancel + jump.
- **(P3) GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts.
- **(P3) Scroll-driven / pointer-driven progress** — animation progress as a function of an external value, not time.
- **(P3) Layout-strategy reflow integration** — explicit hookup; today consumers compose `animateOnSetPose` over a layout-driven adapter.

---

## Audio

Design: `docs/superpowers/specs/2026-08-22-audio-engine-design.md`.

- **(P1) `@weasel-js/audio`** — a leaf package with no weasel dependencies.
  Lookahead scheduling on its own one-shot timer (the audio clock cannot be
  paused or time-scaled by the animator, and rAF stops when nothing is
  animating), voices with handles and `cancelKey`, buses with gain/mute/solo, 2D
  spatialization as a pure `spatialize()` function, and analyser taps with
  `bands(n)` for audio-reactive rendering. Registration: `build:leaves` and the
  `fixed` group in `.changeset/config.json`.
- **(P2) Move the scheduler tick off the main thread.** Browsers clamp
  `setTimeout` to at least 1000 ms in a hidden tab — Chrome harder still for
  timers it judges intensive — so with a 100 ms lookahead a backgrounded tab
  books nothing on time and everything scheduled during it arrives late. The
  audio clock keeps running, which is why the events survive at all. A
  `MessageChannel` or a dedicated Worker driving the pass is not clamped the
  same way; the pass itself is unchanged, only what wakes it. This is the
  smaller half of the AudioWorklet item below, and worth doing first.
- **(P2) Pool the voice node chain.** `createVoicePool` is slot accounting and
  nothing more: the engine builds a `GainNode` and a `StereoPannerNode` per
  `play()` and disconnects them in teardown. Holding a chain per slot and
  reusing it — minting only the `AudioBufferSourceNode`, which is single-use by
  specification — is the optimization the design assumed was already there.
  Worth measuring before building: node construction may not be the cost.
- **(P2) Timeline audio bridge** — an `EventTrack` firing `engine.play()` with
  `when: engine.now() + (event.t - playhead)`, so the sound lands at its true
  sub-frame time instead of inheriting frame jitter. Neither package imports the
  other; they meet at a number.
- **(P3) AudioWorklet scheduling** — immune to main-thread jank; costs a worklet
  module, cross-thread messaging and a bundling story. Revisit if jank proves
  audible.
- **(P3) Insert effects** — per-bus effect slot (convolution reverb, filters).
  Nothing in the v1 graph forecloses it.
- **(P3) Streaming sources** — `MediaElementAudioSourceNode` for long music.
  Everything in v1 decodes fully into an `AudioBuffer`.

---

## Selection, actions & UI panels

- **(P1) Undoing a boolean op leaves the wrong selection.** In WeaselDraw, running a boolean op on a multi-selection and then undoing it restores the operand nodes but not the selection that produced them. History tracks scene ops only — selection is deliberately outside it, and nothing restores what was selected when an entry was recorded.

  The fix is probably to snapshot the selection *onto* history entries without letting selection changes create them: an entry records the selection before and after its ops, undo/redo restores the matching one, and a bare selection change stays invisible to history. Selection is transient state (`docs/taxonomy.md`), so it must not become an undoable step of its own — a user pressing Cmd-Z after clicking around expects the last *edit* back, not the last click.

- **(P1) Audit the engine for cascades that were duplicated and then drifted.** Selection chrome resolved a node's bounds through two independent cascades — the overlay layer's `getPose` chain and `useViewHelpers`' `boundsWithPreview` — that were supposed to give the same answer and did not: they consulted the same two preview sources in opposite priority, and only one of them carried rotation. Nothing caught it, because with one camera and one selection the two rarely disagreed on a value anyone could see. Virtual viewports collapsed that pair (the layer now reads bounds off the draw envelope, one cascade, the one the chrome state was built with).

  The pattern is what to go looking for: a lookup implemented once for the renderer and once for the hit-tester, or once in `<Canvas>` and once in `<SceneCanvas>`, agreeing by coincidence rather than by construction. Two more of the same kind turned up in the same arc and were collapsed with it: the affordance hit-tester built its own `ChromeState` beside the painted one (so mid-drag, handles painted at the ghost and hit-tested at the committed pose), and a view read gesture previews from the surface's dispatcher while owning one of its own.

  Known suspects still standing — there are two pinch-zoom implementations, `usePinchZoomTool`'s direct `usePinchGesture` listener on the canvas and `pinchZoomAction` through the dispatcher's multitouch synthesis, reached by two different `viewport` sub-flags (`pinchZoom` and `zoom`), so a consumer enabling both zooms twice; and `previewIdsExtra` / `previewPoseExtra` walk in-flight handles in a shape `usePreviewGhostLayer` also walks. The output is a list of pairs with a verdict each: collapse, or state why two are correct.

- **(P2) Loupe: sample on click, and show something when empty.** Two gaps in `packages/hud/src/loupe/`, both about the lens being a live surface rather than a readout. The window already samples the framebuffer under its aim point and publishes it (`LoupeHandle.color`, `onColorChange`), and WeaselDraw already renders a vector/pixel toggle, a 2–16× magnification field and a hex readout with Copy (`apps/draw/src/LoupeControls.tsx`) — so neither of these is a control problem.

  (a) **Clicking the loupe interior should pick the color under the point**, the way an eyedropper does, rather than doing nothing while a Copy button in a side panel holds the only way to take the value. The interior currently doubles as the window's move handle when `titlebar: false`, so a click and a drag have to be told apart before this can land. Where the picked color *goes* is the consumer's — the kit surfaces the pick, draw binds it to the active fill or stroke.

  (b) **An empty loupe should read as empty, not as a hole.** `background` paints an opaque backdrop behind vector content so the outer canvas does not show through; with none set, a lens over blank canvas is indistinguishable from a broken one. Default to a semitransparent fill so the window always reads as a window.

- **(P3) Alignment guides — v1 follow-ups.** Auto-derived alignment guides shipped 2026-06-19 (`packages/core/src/features/guides/alignment/`: `deriveAlignmentGuides` + `matchAlignment` + `alignMoveBehavior`/`alignInsertBehavior`/`alignResizeBehavior`, rendered via `createGuidesLayer`; demo `apps/site/demos/AlignmentGuidesDemo.tsx`). Spec: `docs/superpowers/specs/2026-06-19-alignment-guides-design.md`. Multi-select drag alignment shipped 2026-06-19 (`alignMoveBehavior` matches the selection's union AABB via `unionBounds`). Remaining deferred: (a) **Figma-style segment rendering** — line spanning only between the aligned objects with end ticks / offset labels, instead of full-canvas lines (needs a span-aware layer, not just axis+offset); (b) **equal-spacing / distribution guides** ("equal gaps" across 3+ objects); (c) **rotated-object alignment** — derivation/matching use AABBs, so a rotated object aligns by its bounding box.

- **(P3) Reconcile `BandEditor` with `Slider`.** `BandEditor` (bands: a contiguous tiling of an axis, seams draggable, each band carrying a payload) ships alongside `Slider` (a thumb list on an axis, `constraint: 'ordered'`, `onAddThumb`/`onRemoveThumb`, `renderTrack`). Under a contiguous tiling the two are the same control — N seams determine N+1 bands, so seams *are* an ordered thumb list — and they were kept separate deliberately: bridging them means teaching `Slider` about the region *between* thumbs (payload, hit-testing, selection), which is the wider change the reconciliation actually requires. The other trigger is `Slider` needing a non-linear axis. A third option arrived with `windease` 1.0 (2026-08-20): its `LayoutStrategy` is public API — `layout()` returns placements plus affordances, `reduce()` folds a gutter drag into strategy state — so a band control is a strategy you write rather than a control you build, and it brings widened gutter grab targets, `affects` for lock suppression, and — as of 1.2.0 — keyboard-operable gutters with it (`role="separator"` with the value triple, arrows plus Home/End, each keypress synthesized into the same drag event the pointer sends so the strategy clamps once). It ships no band strategy of its own: the two built-ins are `gridStrategy` and `stripStrategy`, and strip is `LayoutStrategy<void>` whose gutters are single-child `resize-x` affordances writing pixel `placement.size`. Mapping domain values onto seams is still the consumer's. Note `Slider` is the former `RangePicker` (renamed in `9e934725`); `docs/specs/2026-05-09-range-picker-design.md` still uses the old name, and `RangeSlider`'s doc comment calling `Slider` "canvas-scrub" is stale from the same rename.

- **(P3) windease as a layout dependency — every blocker is closed; this is now an integration decision, not an evaluation.** Two cases were checked on 2026-08-21 against `windease` (`~/src/windease`, `orochi235/windease` — a browser window manager: nodes with capabilities, pure `LayoutStrategy` functions, DnD, JSON snapshots): a labkit sidebar of resizable tool palettes, and labkit's trial tiling. Nine gaps were found; 1.2.0 closed seven that night and 1.2.1 (2026-08-22) closed the last two — `overflowMode` (`squeeze` / `scroll` / `unplace`) on both `stripStrategy` and `gridStrategy`, turning the overflow signal into a policy, and `hints.render: 'flow'`, a per-container mode that skips the strategy pass and lets the host's CSS arrange the children. Flow answers the question that decided the whole adoption: a host keeps its working CSS grid and takes the gestures, and a mixed tree is the expected shape, so auto-balance stays available on the containers that want it. What flow gives up is everything downstream of the strategy — placements, affordances, `unplaced`, `overflowMode`, `hints.sizing`, the settle animation — and it has one live bug: a pane that reflows without resizing fires no observer, so keyboard navigation reads a stale rect until the child set changes. Two findings survive unchanged: `gridStrategy` already auto-balances to `ceil(sqrt(n))`, so `packages/labkit/src/lab/gridDims.ts` and `Workspace` (labkit's tiling grid) would be deletions rather than ports; and nothing in weasel depends on windease today, so this is a fresh integration whenever it happens. Both gap lists, with everything marked shipped, are in `~/src/windease/TODO.md` under "Wishlist: docked tool palettes" and "Wishlist: hosting an app that already has a workspace store".

- **(P2) labkit: `registerSerializers` has no callers, so instrument serializers never run.** `LabStore.registerSerializers` exists and nothing in the repo calls it, leaving `serializers` permanently `{}` — `Instrument.serialize` / `deserialize` are dead at flush, at hydrate and around snapshots, and an instrument whose state is not JSON-safe silently loses it. Not a one-liner: `createLabStore` runs before any React provider mounts, so a late registration cannot reach hydration. The fix is probably to take serializers as a `CreateLabStoreOptions` field instead, which also gives the hook a place to be typed. Document migrations are unaffected — they operate on already-serialized JSON.

- **(P3) `<ToggleBar>` polish.** Shipped to `@weasel-js/ui` (spec/plan dated 2026-05-17). Visual still needs polish — literally, polish this.

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
- **(P3) Richer text style controls** (font, size, weight pickers).

---

## Plugins & packaging

### Unscoped alias package name

- **(P2) `weasel-js` is unpublishable under that name.** npm rejects it as too
  similar to an existing package, so `packages/weasel-js` is marked `private`
  and `changeset publish` skips it (2026-07-26). Everything else about it is
  live: it builds in `build:downstream`, the consumer smoke test still audits
  that every dist entry is a shim re-exporting core, and it stays in the
  lockstep `fixed` group so its version tracks the scoped packages. Publishing
  is one `private` flag away once a name is settled. Options: pick a different
  unscoped name, or decide the scoped `@weasel-js/core` is the only entry point
  we want and delete the alias. Until then `npm install weasel-js` doesn't work
  and no docs should claim it does.

### Plugin/bundling convention

**v1 shipped 2026-08-10** as `Contribution[]` + `mergeContributions(...)`: a feature returns entries a consumer spreads in, instead of wiring three or four separate exports. `@weasel-js/hud`'s `useHudContribution()` is the worked example. What remains is the heavier tier.

- **(P3) Heavier v2** (only if needed for true third-party plugins): Canvas lifecycle hooks (mount/unmount/pre-render/post-render), capability/version negotiation against kit semver, sub-package layout (`@weasel-js/pen`?). Don't pursue without a real third-party consumer asking.


### Feature-roles taxonomy — risks to monitor

The `api`/`attrs`/`layers` taxonomy is documented; provider and wrapper roles are deliberately collapsed under `layers`. Watch for:

1. **Wrapper-vs-provider intent invisible at the type level.** A reader can't tell from a feature's `layers` field alone whether the feature owns the slot or just decorates it. If this becomes a recurring confusion in code review, split into `layers` (provider) + `wrappers` (transformer).
2. **Order becomes load-bearing.** "Later contributions wrap earlier ones" is convention, not enforcement. If a consumer accidentally orders a wrapper before the provider it expected to wrap, the wrapper sees an empty layer and emits nothing.
3. **Wrapper accidentally replaces.** `(current) => freshLayer` is a valid wrapper signature that ignores `current` — the type system can't enforce "modify, don't replace."

Rollback path is small: split `layers` into `layers: FooLayers` (provider) + `wrappers: FooWrappers` (slot-keyed transformers). The other field names (`api`, `attrs`) stay.

### Barrel-hygiene rollout

- **(P2) selection** — *Pending design review.* Protocol-shaped; no `index.ts`; ambient `SelectionContextProvider` is `@experimental` with open questions about its barrel placement. Don't migrate mechanically.

### weasel-den deferrals

From `docs/specs/2026-05-03-weasel-den-design.md`:

- **(P3) Additional packs.** `useDiagramPack` (connectors, snap-to-grid), `useWhiteboardPack` (sticky notes, freeform pen, text), `usePresentationPack` (frame tools, slide nav). Each is its own arc.
- **(P3) Migrate `useSelectTool` / `useInsertTool` / `useTextTool` / `useUserPenTool` to weasel-den.** Defer until each is stable post-overlay-channel work and any further Tool API iteration. They're staying in core to keep being canonical examples for primitive design.
- **(P3) Runtime plugin discovery.** Explicit non-goal in v1 — tools register statically via `useTools({ registry })`. Add when external authors want to ship tools without app rebuild.
- **(P3) Public third-party extension SDK.** Deliberate exports happen during the split, but no marketing or stability guarantees yet.
- **(P3) Per-workspace pre-commit narrowing.** Pre-commit hook should run only the workspace whose files changed (lint-staged dispatcher).

### d3 integration plugin

**Force-direction half shipped 2026-05-16** (`useSimulation` + d3-force compat). Remaining:

- **(P3) Data-join surface.** `d3Bind(adapter, data, { key }).join({ enter, update, exit })` emitting batched ops.
- **(P3) Transition bridge.** Mapping `d3-transition`'s duration/easing/end-promise onto `useAnimator` + pulling `d3-interpolate` in as the animator's color/path/object interpolator.

Simulation primitive itself open follow-ups: drag-to-pin helper hook, sugar wrapper that hides the d3-shaped nodes array, built-in forces (center/collide/x/y/drag), history-bypass adapter wrapper, worker offload mode, seedable RNG.

### Parallax follow-ups

- **(P3) Dispatcher-aware hit-testing for interactive parallax planes.** Needs design pass on plane registration, click resolution order, selection-chrome projection.
- **(P3) `useScene` user-layer `parallax` property wiring to `createParallaxLayer`** at the SceneCanvas adapter seam.
- **(P3) Animated parallax** — tween pan/zoom for intro effects; compose `useAnimator` over the opts.

### System-registries pattern

- **(P3) `createReflectable<T>()` utility for the system-registries pattern.** Surfaced 2026-05-12. The kit maintains ≥8 registries with different lifecycles (fonts, tools, ops, actions, easings, shaders, Canvas layers, object-kind). The documentation half shipped — `docs/concepts.md:364` now has a "System registries" section cataloging every registry. Remaining: ship a small `createReflectable<T>()` utility for the cross-cutting reflection concern (debug overlay enumeration, conflict detection). A grand unification is still probably wrong — promote "pick one shape per scope category" only after 3+ registries in the same category exist.

---

## Demos & visual regression

- **(P3) Demo coverage gap: HUD widget gallery.** `@weasel-js/hud` ships five widgets (`button`, `rect`, `text`, `image`, `label`) but only `button` is demo'd (`apps/site/demos/HudDemo.tsx`) — a single "HUD widget gallery" demo card would cover the other four. Brainstorm scope before writing it. (The former `@weasel-js/ui` `CommandPalette`/`PropertiesPanel` half of this item was dropped — those are app-local components in `apps/draw/src/ui/`, not `@weasel-js/ui` exports, so there's no kit-export demo gap.)

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

- **(P2) `eqeqeq`** — 285 findings. Real correctness, but a large mechanical
  sweep with no bug attached to it yet.
- **(P2) `@typescript-eslint/no-unused-vars`** — 129 findings. Two
  `eslint-disable` directives in the tree already name it and go live with it.
- **(P3) eslint-plugin-react-hooks v7 compiler rules** — `refs` (387 findings
  across 103 files), `immutability` (18), `set-state-in-effect` (21),
  `use-memo` (7), `globals` (6), `static-components` (3),
  `preserve-manual-memoization` (2). `refs` dominates because reading a ref
  during render is how a canvas library reaches mutable frame state, so a large
  share are expected false positives. Worth evaluating rule by rule; not worth
  adopting as a block.
- **(P3) `reportUnusedDisableDirectives`** — still `off`. It can't be turned on
  while `no-unused-vars` is deferred and `no-explicit-any` is scoped out of
  tests, because directives naming those would all report as unused. Flip it
  with the two P2 rules above.

## Release-gate & build hygiene

- **(P2) `test:kit` covers `packages/core` only, and its name says otherwise.**
  The `kit` vitest project globs `packages/core` plus `apps/site`; `svg`,
  `font`, `geom`, `history`, `gestures`, `modes`, `ui` and `hud` all run under
  the `weasel-ui` project, and `labkit` under its own. Default `npm test` does
  reach every package, so this is a naming trap rather than a coverage hole —
  but two separate agents in the 2026-08-22 review pass read a green
  `test:kit` as "the kit passes", and one nearly wrote tests that would never
  have run. Rename the project, or add a check that every package directory is
  reachable by some project's include glob.

- **(P3) Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one is desired. Today's barrel test asserts ops/shape-kinds/bundles parity; public exports remain uncovered.

- **(P3) Last 4 React `act()` warnings in CI vitest.** The June 2026 sweep took the `ci.yml` "not wrapped in act(...)" count 200 → 4 (and killed the ~91 jsdom `getContext` stack dumps); see `vitest.setup.ts` (global `getContext` stub) and the test-side `act()` wrapping. The remaining 4 all come from `packages/core/src/canvas/SceneCanvas.tools.test.tsx`'s *"omitted defaultTools: resize is registered"* test — a SceneCanvas-internal deferred update from the resize-gesture commit that resists every test-side `act()` strategy tried (async microtask flush, `setTimeout(0)` macrotask flush, dispatching the whole down→move→up gesture inside one `act()`). A real fix has to live in SceneCanvas's update scheduling, not the test. Note: these warnings only reproduce under CI (ubuntu/worker timing), not locally — verify via the `ci.yml` log. Low value; defer.

- **(P2) Per-command draw cost, for everything that is not batched solid
  geometry.** `tests/perf/draw-loop.spec.ts` sweeps commands per frame under
  real GL (`npm run test:perf`; gates nothing, prints the unmasked GL renderer
  so a software backend is obvious).

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

  **Text still mints a vertex array and two buffers per draw**, in
  `drawTextGroup` and `drawTextDecorations` — the thing `drawImage` stopped
  doing, and worth ~5 us a draw there. The same ring would fit, with one extra
  problem: a text group's geometry is variable-length, so the ring's buffers
  have to grow rather than being fixed at four vertices.

  The rest of the plan — one program plus atlases — is in
  `docs/handoffs/2026-08-14-batched-dispatch.md`, with the traps, and a
  two-phase dispatch split that would make it tractable.

- **(P3) Whether the benchmarks gate CI.** `tests/bench/` holds 62 vitest
  benchmarks with a committed baseline (`tests/bench/results/`); nothing gates
  anything. `tests/bench/README.md` argues a hard threshold on shared runners
  would have to be loose enough to miss real regressions, and sketches the
  shape it thinks a gate should take instead — a PR job that posts the
  `--compare` delta as a comment and does not fail the build. Mike's call.

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
  so adjacent rows differ by that call's cost: 3.87 us for the whole sequence
  against 0.34 for bind-and-draw alone. Per flush — vertex `bufferSubData` 1.84
  us, index `bufferSubData` 0.89, `u_color` + `u_alpha` 0.75,
  `bindVertexArray(null)` 0.19, `useProgram` 0.03, the stencil disable below
  resolution. So about 1.6 us of the 3.87 is removable in principle, and the
  vertex upload — the one thing a flush exists to do — is the largest single
  item. See the flush-slimming entry below for what it would take.

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

- **(P2) [x] A flush's redundant uploads are gone; what remains is the vertex
  upload.** `flush-anatomy.spec.ts` priced a flush's calls against a 0.34 us
  bind-and-draw floor and found two re-sending bytes the GPU already had. Both
  landed. Measured as one A/B, the two halves back to back: a flush 5.39 ->
  3.22 us, entering a clip 12.47 -> 9.53 (`clip-cost.spec.ts`). Read the
  difference and not the absolutes — the same spec measured a 4.35 us flush an
  hour earlier on a cooler machine, which is the drift these specs' headers
  warn about.

  A ring slot now remembers the rect count whose index pattern it holds, and a
  flush matching it skips the upload. The win needs slots to come round, so a
  frame with fewer flushes than the ring is wide sees none of it. `u_color` and
  `u_alpha` joined `UploadedUniforms`, which required routing all eleven writes
  through `setColorUniform` / `setAlphaUniform`; that is what makes the cache
  right per program instead of dependent on knowing which caller uses which.

  What is left is the vertex upload, 1.84 us and the one thing a flush exists
  to do. Text is the larger target now — see the boundary entry above.

- **(P3) opentype.js is typed a major version behind what it runs.**
  `packages/font` depends on `opentype.js@2.0.0`, which ships no typings, so TS
  walks past `packages/font/node_modules` and resolves the module to the root
  `@types/opentype.js@1.3.10` — the DefinitelyTyped package for the 1.x API.
  (Confirmed with `tsc --traceResolution`. The other `opentype.js` in the tree,
  1.3.4, is unrelated: `dev: true`, pulled in by `msdf-bmfont-xml`, and that is
  plausibly what the `@types` pin was added for.)

  **Not broken, and deliberately left alone.** All six points
  `outline/opentypeParser.ts` touches — `parse`, `unitsPerEm`,
  `charToGlyphIndex`, `glyphs.get`, `getPath`, `toPathData` — exist in both
  majors; the narrow surface that file keeps is what makes the mismatch
  harmless.

  What to watch for, since the failure would be silent: the 1.x typings declare
  `load()` and `loadSync()` as working, and in 2.0.0 they are deprecation stubs
  that `console.error` and return `undefined`. A call to either typechecks
  clean and fails at runtime. In the other direction 2.0.0's additions
  (`PaletteManager`, `font.palettes`, `font.metas`) are invisible, so reaching
  for them fails to compile. DefinitelyTyped has no 2.x package; the fix, if
  the surface ever widens, is a hand-written local `.d.ts` covering only what
  the kit calls — which would make that surface explicit and enforced.

---

## Documentation

- **(P2) README pitch sweep.** Initial draft landed; the `docs/` long-form sweep was completed (all hook names and import paths match the post-extraction surface). A re-pass before 0.1.0.

- **(P2) Surface a changelog on the site.** `changeset publish` writes a
  `CHANGELOG.md` per package on every release and nothing reads them — thirteen
  files in the repo, none reachable from `apps/site`. A reader who wants to know
  what moved between two versions has to read git log. Wants a decision on shape
  before it is built: one merged view across the lockstep group (they all bump
  together, so thirteen separate lists would repeat the same version numbers
  thirteen times) versus per-package pages, and whether it is generated at build
  time from the markdown or rendered by a route.

- **(P3) JSDoc audit at definition sites — done; two follow-ups open.** Every
  public export of every package, `@weasel-js/ui` included, now has a JSDoc
  string at its definition site. `npm run audit:jsdoc` re-derives the claim: it
  walks each package's published entry points, resolves every reachable export
  to where it is declared, and reports what is missing. It also reports any
  export whose own JSDoc says `@internal` yet reaches a consumer entry point;
  that count is currently zero. Run it before adding an export, not as a
  periodic sweep.

  What the sweep turned up. The first two are resolved; the last two are open:

  - **`@weasel-js/font`'s reset seams moved off the package barrel** to a
    `@weasel-js/font/test-seams` entry point. Six of them, not the four the
    audit first reported — `_resetFontRegistryForTests` and
    `_resetFallbackForTests` are the same kind of thing without the `@internal`
    marker that made the others visible to the script. They exist because font
    registration, the fallback policy, the dynamic atlas and the outline
    registry are global module state, so a test in another workspace that sets
    one has to put it back; that need is unchanged, and the seams are still
    published — an application importing the barrel just no longer sees them.
    `packages/font/src/barrel.test.ts` pins both halves. `@weasel-js/core` is
    not affected: its barrel never exported a test helper, and its own tests
    reach them relatively.
  - **`evaluateEnabled` is public, and its detached `@internal` marker was the
    stale part.** `@weasel-js/ui`'s `ActionBar` and weaseldraw's command palette
    both call it through core's barrel, so marking it internal would have
    described two existing consumers out of existence. It is now `@experimental`
    at its own definition, matching `ActionEnabledResult` and the rest of the
    `enabled` predicate surface.
  - **Six typedoc warnings, all the same shape and all pre-existing** (the count
    did not move across the sweep). Each is a type referenced by an exported
    symbol but not itself exported — `Scale2`, `DEFAULT_INK`,
    `useContributions` in core; `LongPressSpec` and `LongPressEvent` in
    gestures — plus eleven stale entries in `typedoc.json`'s
    `intentionallyNotExported` list. These are barrel decisions, not docs bugs.
    Note that typedoc does not warn about missing JSDoc, so its warning count
    was never a coverage measure.
  - **`@weasel-js/ui`'s live/committed callback pair is now spelled one way:
    `onInput` live, `onChange` committed.** It used to be four ways, two of
    which disagreed about what `onChange` meant. `Slider`, `ResizeHandle`,
    `CurveEditor` and `PointPlotter` renamed toward the sense `ColorField`,
    `GradientEditor` and `GradientHandles` already used, which is also the
    DOM's — `input` fires continuously, `change` on commit.

    Which of the two is *required* still differs, and that is deliberate:
    `Slider`, `ResizeHandle`, `CurveEditor` and `PointPlotter` are fully
    controlled, so without `onInput` the control freezes mid-drag and it is the
    required one. `ColorField` and `GradientEditor` buffer internally, so
    `onChange` is theirs. Required-ness follows the control's state model, not
    the naming.

    Untouched on purpose, all different concepts that merely share a word:
    `CurveEditor`'s layer-gesture `onCommit(state, ctx)` in `layerTypes.ts`,
    core's `thresholdDrag` `onCommit(e)`, and `SelectionPanel`'s
    commit-on-blur text edit, which has no live counterpart to pair with.
