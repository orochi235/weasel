# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@weasel-js/core`). The
kit aims to be a generic 2D scene-graph foundation. Items here are evaluated
for cross-app reuse, not consumer-app value.

For history of completed work, see `git log` and the dated specs under
`docs/superpowers/specs/`. Plans are deleted when their work merges.

When work merges, retire its entry here in the same change. The index below is a
hand-maintained copy of claims made further down; fix both or fix neither.

Priority tags:
- **(P1)** — foundational genericity gap; the kit can't do this today
- **(P2)** — broad reuse, or friction-likely
- **(P3)** — specialized, or resting on a foundation not built yet

---

## High-priority index

### Next up

### P2 — broad reuse / friction-likely

**Text**
- Text cannot say "no fill", so outline-only text is unreachable → [Text](#text)
- Cross-browser overlay alignment → [Text](#text)
- `apps/draw` drops every run's styling on SVG export and copy → [Text](#text)
- Small caps and text-transform have no run spelling → [Text](#text)

**Scene, adapters & layout**
- A stroke with no `paint` still throws outside the painters → [Rendering & paint](#rendering--paint)
- `arrayAdapter` as default Canvas adapter — full unification → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: drop rejection signal → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: multi-select drag into a layout container → [Scene, adapters & layout](#scene-adapters--layout)

**Selection, actions & UI panels**
- Two implementations of an editable curve; the timeline built the second → [Selection, actions & UI panels](#selection-actions--ui-panels)
- labkit's loupe drives itself with plain listeners, not bindings → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Every React Aria overlay inside a lab renders unthemed → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Four drag lifecycles, four different lost-pointer policies → [Tools & gestures](#tools--gestures)
- labkit `registerSerializers` has no callers; instrument serializers never run → [Selection, actions & UI panels](#selection-actions--ui-panels)
- labkit: nested config values — `f.schema` is flat because `setConfig` is → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Reconcile core's `ToolPrefLeaf` with weasel-ui's `PrefLeaf` — the `paint` kind has already drifted → [Selection, actions & UI panels](#selection-actions--ui-panels)
- `ControlPanel` rows: `ColorRow` / `CheckboxRow` take no `layout`, and row spacing is not tokenized → [Selection, actions & UI panels](#selection-actions--ui-panels)

**Lint**
- `eqeqeq` (275) and `no-unused-vars` (131) deferred from the 2026-08-22 baseline → [Lint](#lint)

**Tools & gestures**
- `ToolCtx` hard-codes 2D, blocking tool reuse by another kernel → [Tools & gestures](#tools--gestures)

**Viewport**
- The wheel is answered three times, with inverted modifier meanings → [Viewport](#viewport)

**Plugins & packaging**
- Barrel-hygiene: selection (pending design review) → [Plugins & packaging](#plugins--packaging)
- `labkit` inlines `core`, so a consumer using both holds two registries → [Plugins & packaging](#plugins--packaging)
- `weasel-js` unscoped alias is unpublishable under that name → [Plugins & packaging](#plugins--packaging)

**Performance**
- A clipped group costs ~10 us to enter, half of it the stencil → [Release-gate & build hygiene](#release-gate--build-hygiene)
- A solid boundary costs 2.5 us where every other kind costs under one → [Release-gate & build hygiene](#release-gate--build-hygiene)
- Benchmark HUD text against a transparent DOM overlay → [Release-gate & build hygiene](#release-gate--build-hygiene)
- Decide where benchmarks live and how their results are kept → [Release-gate & build hygiene](#release-gate--build-hygiene)

**Documentation**
- Surface a changelog on the site → [Documentation](#documentation)
- README pitch sweep → [Documentation](#documentation)

---

## Tools & gestures

- **(P2) Four drag lifecycles, four different lost-pointer policies.** The
  dispatcher (`useGestureDispatcher.tsx`), `handleDrag`, `thresholdDrag` and
  `pointerDrag` each own a pointerdown-to-pointerup lifecycle, and each made a
  different call about capture and teardown: the dispatcher captures and
  listens on the element, `handleDrag` does the same but never recovers if
  capture is lost, `thresholdDrag` captures and listens on `document`, and
  `pointerDrag` listens on `document` with no capture at all.

  None of them handles `lostpointercapture` — the string appears nowhere in the
  repo — and none treats a `pointermove` with `buttons === 0` as the release it
  missed. So a drag whose pointer leaves the element, or whose capturing
  element is removed mid-gesture, hangs in flight. The dispatcher's
  `onWindowBlur` releases held keys and leaves the drag running.

  The fix worth making is one drag-session primitive that owns capture, the two
  recovery rules and teardown, with all four built on it — patching them
  one at a time leaves three copies of the same hole. Note the test trap: jsdom
  records `setPointerCapture` and does nothing else, so a test of any of this
  can pass against a broken implementation.

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
  element) if crispness matters; (b) **text box width is estimated** on the
  unpack path — external `<text>` carries `UNBOUNDED_TEXT_WIDTH` rather than a
  measurement, and unpack has no text-measure context, so it guesses from the
  longest line at 0.6 em per glyph (closed 2026-08-16, along with `fontSize`
  joining the fit-clamp); a real measure would want the atlas; (c) weaseldraw's
  file-menu import still uses its own app-local `svgInterop` mapping (richer:
  `wd:` tool metadata, paper size) — fold the shared walk if they drift, and
  note it now *drops* `<image>` nodes, since the app's `Obj` union is path/text
  only. The stroke lowering is already shared: both importers call
  `strokeDataFromSvg`.

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

- **(P2) The wheel is answered three times, with inverted modifier meanings.**
  `viewportZoom` (plain wheel = pan, mod = zoom), `computeWheelAction` (plain =
  zoom, meta = scroll) and `useZoom` disagree; the latter two pan in screen
  pixels, which cannot be fed to `view.set` at all, and all three are public.
  `usePinchZoomTool` is now dead surface — `SceneCanvas` drives pinch through
  the action alone — but is still exported, and it is the only one of the two
  that routes an anchor to the view under the fingers. Found by the 2026-08-29
  cascade audit. The clamp half of this entry is closed: `DEFAULT_MIN_ZOOM` /
  `DEFAULT_MAX_ZOOM` (`core/viewport/zoomBounds.ts`) are now the one source for
  all seven defaults, at `0.1`–`8`.

- **(P3) `useViewAnimation` builds an animator it never uses.** The hook calls
  `useAnimator()` unconditionally so it can fall back to its own animator when
  the caller passes none — hooks cannot be conditional — so `<SceneCanvas>`,
  which always passes `cameraAnimator`, constructs a second idle `Animator` per
  canvas. It registers nothing and its rAF loop never starts, so the cost is one
  object plus a no-op unmount effect, but it is dead weight and it makes
  "SceneCanvas runs the camera on its own animator" untestable by swapping the
  argument: `useViewAnimation(channel, undefined)` behaves identically. Fixing
  it wants either a positional-animator variant or a `useAnimatorOrNull` seam.

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

- **(P3) The raw `createViewportLayer` path has no input wiring.**
  `<CanvasView>` above is the supported answer; the older re-projection
  prototype (`layer.reproject(outer, dims, screen)`, `viewportsAt`) still
  renders without hit-testing, as `apps/site/registry.ts` says in its blurb.
  Either retrofit it onto the resolver or retire it in favor of `<CanvasView>`.

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
  importer in core. `forEachSegment` is written about a dozen times; the two
  wrong copies are fixed (`tessellate.ts` now restores the pen on `PATH_Z`,
  `pathDistance.ts` throws on an unrecognized command instead of leaving `ci`
  unadvanced), and the `PATH_CMD_LENGTHS` copies are gone — `packages/geom`
  holds the only definition and core imports it. Six independent
  `cubicEvalAt`s remain.
  `poseDescriptor.ts`'s hand-rolled `boxToBox` disagrees with geom's on the
  degenerate axis. The unification should carry `pathCrop`,
  `flattenQuadratic` and the arc-length flatteners into geom rather than
  leaving core a rump copy. Full inventory in
  `docs/reviews/2026-08-22-core-geom-dupes.md`.

- **(P3) `<style>`-element and class-selector support for `@weasel-js/svg`.** The presentation-attribute cascade now threads a resolved `StyleContext` through the recursive parse (`packages/svg/src/cascade.ts`, shipped 2026-07-25; spec `docs/superpowers/specs/2026-07-25-svg-cascade-context-design.md`). Inheritance, the `inherit` keyword, `style=""`, text/`<tspan>` cascade, and `currentColor` all resolve without per-attribute DOM walks (`readInheritedAttr` deleted). Still unsupported: `<style>` elements and class/selector matching — the cascade handles inheritance, not selector specificity. `style=""` remains a regex scan, not a full CSS parser (`!important` unsupported). Selector matching is the missing piece; the threaded-context fast path could compute the per-element cascade from `getComputedStyle` against a hidden DOM node in the browser.

### Pathfinder follow-ups (post-v1)

Core five + Crop shipped. Remaining:

- **(P3) Outline.** Stroke-to-fill silhouette — needs proper offsetting with joins/caps/self-intersection cleanup. No lightweight JS lib without major deps.
- **(P3) Trim and Merge.** Remove hidden portions / Trim + same-color reunion — need per-path style awareness, which the kit deliberately doesn't have since `data` is opaque. Wait on a compound-path-with-styles model.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** v1 flattens beziers before clipping; the result is straight-line. Skia/PathKit-style curve-preserving booleans are next-level — substantially harder.
- **(P3) Live preview during the gesture.** Holding the op key while hovering a path to see the result before committing.
- **(P3) Boolean ops on stroked paths.** Treat a stroke as a filled region, then clip. Blocked on stroke-to-fill (round/bevel/miter joins, end caps — its own design problem).
- **(P3) Pathfinder against text glyphs.** Needs glyph-to-path extraction.
- **(P3) "Create Outlines".** The destructive text→path conversion every vector editor has: replace a text node with the path geometry of its glyphs, giving up editability. Shares the glyph-to-path extraction above, but is a command in its own right.

---

## Rendering & paint

- **(P3) A minimap's framing ignores pose overrides.** `<SceneViewCanvas>` and
  `<MinimapCanvas>` paint override poses as of 2026-08-25, but `computeFitView`
  still derives framing from document poses, so a node overridden outside the
  document bounds paints outside the fitted frame. Deliberate — recomputing the
  fit per frame would rescale the whole minimap through a drag or a settle, and
  costs an O(nodes) bounds sweep every frame. Revisit only if a consumer wants
  framing that tracks a simulation.

- **(P2) `createParallaxLayer` bypasses `drawOneLayer`, so a source layer's
  `space` is silently ignored.** `packages/core/src/features/parallax/createParallaxLayer.ts:36`
  calls `layer.draw(...)` directly where `viewportLayer.ts` calls `drawOneLayer(...)`.
  ParallaxDemo's four layers therefore declare `space: 'world'` while their bodies
  pre-project — harmless today because nothing applies the transform, but the
  labels are lies, and changing that one line to `drawOneLayer` converts all four
  into a double-applied view transform (the bug fixed in `6eec0d88`).
  `apps/draw/src/useLoupe.ts:49` has the same shape. Fix the bypass and the
  demos together, or neither.

- **(P1) A second `<SceneCanvas>` under one `ActionsProvider` unregisters the
  first's viewport actions.** In `vertex-widths` and `boolean-ops` — and
  `curve-lab` and `rotated-resize-math` — wheel pan and Cmd+wheel/Cmd+-/Cmd+0 do
  nothing at all; the canvas is pixel-identical after six zoom notches, with no
  `view` or `viewport` prop set, where the documented default is that they stay
  wired. `useViewportActions.ts` registers `viewport.pan` / `viewport.zoom` by
  **action id** into the shared registry and unregisters them on cleanup, so
  sibling canvases collide on those ids and one instance's teardown takes the
  registration out from under the others. Predates the frame-loop arc.

- **(P2) The text-edit overlay does not scale with the canvas.** `#text` at ~2x
  renders the DOM overlay at 1x font size in a 240x80 box while the selection
  frame around it is correctly zoomed — the text sits detached from the glyphs it
  is editing (`fontSize: 16px, transform: none` at both 1x and 2x). The demo
  (`apps/site/demos/TextDemo.tsx:38`) calls `useSceneTextEdit(scene, container)`
  with no `options.view`, so `getScreenPose` resolves `zoom = 1`. Documented hook
  behavior, so this is a demo gap — but the demo enables Cmd+wheel zoom by
  default, putting the broken state one gesture away. The live-view thunk added in
  `99e2f969` is the surface that fixes it: pass the canvas handle's `getView`.

- **(P2) The canvas's repaint tripwire has a blind spot: `helpersForLayersRef`.**
  `Canvas` marks itself dirty from a `useEffect` whose dep array is meant to
  name every input the paint reads. `helpersForLayersRef` — selection, preview
  poses, chrome state, `getIsVisible` — is written during render and appears in
  neither that array nor an imperative redraw of its own. It works today only
  because `SceneCanvas` calls `requestRedraw()` by hand at six sites
  (`SceneCanvas.tsx:936, 946, 952, 1082, 1087, 1622`), which means the primitive
  is trusting its wrapper to remember. A bare `<Canvas>` consumer changing
  selection gets no repaint, and the comment above the dep array claims the
  opposite ("every input the paint reads must appear here"). Either fold the
  helpers into the tripwire or make the comment tell the truth about who owns
  the redraw.

- **(P2) A throwing layer takes down the whole frame, as an uncaught error.**
  Since the paint moved onto the frame loop, a `draw` that throws surfaces as an
  uncaught `requestAnimationFrame` error on the window; before, it ran inside a
  `useEffect` and reached the nearest React error boundary. Neither is the
  behavior worth wanting. `drawLayers` is the place that can do better — it
  already iterates layers holding the layer id, the debug sink and the command
  cache, so a per-layer `try`/`catch` can drop that layer's commands, report
  `{ layerId, error }` to the sink, and paint the rest. A canvas visibly missing
  one layer, with a console error naming it, beats both a blank canvas and a
  silently-vanished layer. Open questions: whether a throwing layer stays
  evicted until its `deps` change, whether the sink grows an error channel, and
  what the headless `renderSceneToPixels` path does with a failure. Do **not**
  put the `catch` in `useFrameLoop` — scheduling has no information about what a
  draw failure means, and the granularity is wrong there.

- **(P1) The hud loupe's pixel mode reads back a stale buffer.** `refreshPixels`
  calls `readbackRegion` — `gl.readPixels` — straight off an aim change
  (`packages/hud/src/loupe/createLoupe.ts:152`), which since the frame loop
  landed is a moment with no paint behind it: the buffer holds the previous
  frame, so the magnifier shows the scene as it was one frame ago while dragging.
  The changeset names the remedy and nothing in `packages/hud/src` implements it
  — no call to `subscribeFrame` exists there. Fix shape: `HudHost`
  (`packages/hud/src/host.ts`) gains `subscribeFrame`, which `attachHud` already
  has on the `api` it shims from (`attach.ts:144`), and the loupe defers the
  readback to the next landed paint instead of taking it inline.

- **(P3) The loupe cannot aim at a detached pane.** `createLoupe` takes `canvas`
  and `input` separately, so a pane's aim is measured against the pane box — but
  `readbackRegion` still reads that aim as an offset into the *whole* drawing
  buffer (`packages/hud/src/loupe/createLoupe.ts`). Over a `paintInto` surface
  the two disagree by the pane's origin, so the lens shows the wrong region.
  Fix shape: carry the target rect into the readback, which means either
  `createLoupe` takes the pane origin or `CanvasExtensionApi` exposes the rect
  it hands `WeaselRenderer.setTarget`. Nothing hits this yet — the
  `tiled-surface` demo mounts no loupe.

- **(P1) `SceneCanvas` re-renders on every scene mutation.** Its own
  `useSyncExternalStore` (`SceneCanvas.tsx:894`) commits the canvas for every
  version bump, whether or not the host passed
  `useScene(..., { subscribe: false })` — the ~100–110 commits/s the scene
  side-scroller still pays. The ephemeral-pose-overrides arc does not close
  this: it only stops *pose overrides* bumping the version, and a demo's own
  `scene.add` / `scene.batch` still notifies. The shape worth trying is that the
  subscription call `requestRedraw()` rather than commit — `Canvas` already
  takes `contentVersion` as a getter, so the paint can sample the version
  without a render. What that costs is real design work: some chrome genuinely
  needs a commit on a scene change (layer panels, counts, anything rendering
  node data as DOM), and deciding which is the whole question.

  Two demos still subscribe while driving poses from an animation tick, and
  should take `subscribe: false` once that lands: `EasingsDemo.tsx:49` (a
  `setPose` per marker per frame) and `TimelineDemo.tsx:43` (`move()` from a
  sampled track's `onTick`). `SceneScrollerDemo.tsx:73` is the one that has.

- **(P3) Sync paints do not coalesce.** `CanvasProps.syncPaint`
  (`Canvas.tsx:234-242`) promises "a synchronous paint per commit", singular,
  but the loop paints per *request*: one commit carrying a sibling
  layout-effect `requestRedraw` produced two full GL paints where the async
  path produced one. Coalescing would mean deferring to a microtask at the end
  of the commit, which gives up the "pixels land before the surrounding layout
  effects read the DOM" ordering that `syncPaint` exists for. Either the
  ordering guarantee or the singular paint — the doc currently claims both.

- **(P3) `paintInputsRef` is written during render.** `Canvas.tsx:1295` assigns
  it in the render body, so a concurrent render React starts and abandons still
  leaves its inputs in the ref, and the next `requestRedraw` from any source —
  a gesture, a HUD, the view — paints inputs that were never committed. This is
  a second `startTransition` hazard, distinct from the documented one (that one
  is about DOM lagging the canvas; this one is about the canvas painting a
  render that does not exist), and it is documented nowhere. Writing the ref
  from a layout effect instead would fix it and cost the sync-paint ordering,
  which is the same trade as the entry above.


- **(P1) A full-screen effects pass.** The renderer can draw over the frame but
  never *transform* it: there is no render-to-texture anywhere in
  `packages/core/src/renderer/` (`createFramebuffer` appears only in the test GL
  recorder), so no pass can sample what has already been drawn. That closes off
  a whole class of effect by construction. `ShaderDrawCommand`'s texture uniform
  only ever comes from `registerTexture(image)`, so a fragment shader can shade
  a rectangle but cannot read the scene under it; `GroupDrawCommand.colorMatrix`
  is a per-pixel colour transform, which covers grading, tinting and desaturation
  but can never express anything needing neighbouring pixels. A consumer wanting
  to blur, bloom, or distort the whole scene has exactly one option today: a CSS
  `filter` on the `<canvas>` element, which is the browser compositing on the
  kit's behalf and is not something a canvas library should be recommending.

  What is missing is a post-processing stage: render the scene into a texture,
  then run one or more fullscreen shader passes over it before presenting. The
  shape worth designing toward is a declarative `effects` list on the canvas —
  each entry a registered program plus uniforms, composed in order, with
  ping-pong buffers handled by the renderer — so a consumer writes
  `effects={[blur({ radius }), vignette({ amount })]}` and never touches GL.

  It unlocks blur, bloom, vignette, chromatic aberration, colour grading, screen
  transitions and damage/state feedback, none of which are reachable now. It also
  wants a decision on cost: the pass is per-frame and the buffers are
  device-resolution, so it should be inert when the list is empty.

  Absorbs the former P3 "Layer effects framework", which described the same
  feature from the layer's side: effects modify pixels rather than choosing a
  colour, and under WebGL each is its own pass — drop-shadow needs a blurred
  render-to-texture beneath, blur a separable kernel, blend modes framebuffer
  compositing. Its open question stands and is the real design decision here:
  per-layer `effects?: Effect[]` versus a wrapper (`withEffects(layer, effects)`)
  versus one list on the canvas. Effects are consumed by the renderer, not the
  layer, so each knows how to set up its own GL state.

  Do not mistake `SceneSlotConfig.postProcess` for this. It is
  `(cmds, view, dims) => DrawCommand[]` — a draw-command-tree transformer that
  never touches a pixel.

  Surfaced 2026-08-23 by the side-scroller demo, which blurs the canvas on a
  head knock and took the CSS-filter route instead. That filter blurs the whole
  canvas including the HUD drawn on it, which a real pass would not. The CSS is
  tagged with a comment pointing here and should be replaced when this lands.


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

- **(P3) Promote `ShaderDrawCommand` past `@experimental`.** Three uses now exercise it (plasma / ripple / voronoi panels), which is enough to have validated the surface. Open questions before stabilization: (a) array uniform binding shape — currently consumers must pass per-slot keys (`u_ripples[0]`, `u_ripples[1]`, …); should the kit accept a flat `Float32Array` and split it? (b) hot-reload story for `registerProgram` re-registration; (c) how to expose the renderer's program registry without leaking internals (`shaders` prop is the seam, but consumers writing custom RenderLayers may want more).

- **(P3) An imported `<marker>` we have no key for warns and drops.**
  `@weasel-js/svg`'s import path (`parse.ts:535`) only round-trips a
  `marker-start` / `marker-mid` / `marker-end` value it recognizes by key; an
  unfamiliar one warns through `onWarn` and its geometry is discarded. The
  entry model (`MarkerEntry`, `packages/core/src/core/strokeMarkers.ts`) is
  already general enough to hold one — geometry, independent paints, an
  anchor, an orientation — so ingesting it later is a parser change, not a
  redesign. See `docs/superpowers/specs/2026-08-30-stroke-markers-design.md`.

- **(P3) No marker icons.** `defaultNodeProperties`'s `markerStart` /
  `markerMid` / `markerEnd` leaves use a labelled `select`, where the sibling
  stroke enums (`cap`, `join`, `align`, `dash`) are icon toggles — authoring
  eight glyphs to this repo's icon standard is its own piece of work and was
  deferred out of the stroke-markers arc.

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

- **(P2) A stroke with no `paint` still throws outside the painters.** The
  producer is fixed (`SelectionPanel`'s object leaf seeds from the leaf's
  `default`, so a field written onto a node with no stroke materializes a
  whole one) and the painters read such a stroke as no stroke. Documents
  saved before that fix can still hold one, and four paths still dereference
  `stroke.paint` unguarded: `packages/core/src/renderer/draw.ts:1066` and
  `:1145` for any `DrawCommand` arriving from a consumer painter or overlay,
  `apps/draw/src/svgExport.ts:103`, `apps/draw/src/svgInterop.ts:172`, and
  `packages/svg/src/serialize.ts:272,294` — so exporting such a document
  throws. Either normalize on load or make `Stroke.paint` optional in the type
  and honest everywhere; a guard per call site is the version that rots.
  Recorded 2026-08-30.

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

- **(P2) Text cannot say "no fill", so outline-only text is unreachable.** Every other node kind reads `data.fill: null` as an explicit no-paint; a text node resolves it to the default black instead, because a `ResolvedRun` must name a concrete `FillStyle` and nothing downstream can skip the fill pass. Making `ResolvedRun.fill` nullable is the change, and it reaches further than the type: `fillKey` / `sameFill` in `atlas/layoutRuns.ts` key the batch groups on it, the glyph batch would have to emit a run's stroke ribbon without its quads, and underline / strikethrough spans inherit the same fill. Stroked-but-unfilled text is the thing this buys, which is what a display-type outline actually is. Recorded 2026-08-27, when paint moved onto `data.fill`.

- **(P2) Cross-browser overlay alignment.** `placeOverlay` uses an empirical `(+1, -1)` CSS-px nudge to compensate for canvas/CSS rasterization disagreement. Works on the dev setup; not universally correct across browsers/fonts/DPRs. A self-correcting probe was attempted and rejected.

- **(P3) `rangeStyle` reports the runs alone; consumers merge the node style.**
  The toggle half of this is resolved: `patchForToggle` in `useTextEdit` reads
  `nodeHasFlag` as well as the range, so Cmd+B inside a `fontWeight: 700` node
  clears bold rather than adding it, and the un-set rewrite is reachable from
  the bar and from a collapsed caret rather than only from the keyboard over a
  range. What remains is the display half: `styleAtRange` still reports the
  runs alone, so every consumer that wants "what is actually rendering" merges
  the node style itself (draw's `effectiveRangeStyle`). Decide whether that
  merge belongs in the kit — and if so, whether `rangeStyle` should carry it
  or a second reader should.

  Unchanged and deliberate: a node at `fontWeight: 900` stays declined
  (`applied: false`) — `run.bold` is exactly 700, so pushing the weight onto
  the runs would lighten the text that was not edited.

- **(P3) Per-character tracking in the DOM overlay is CSS-approximate.**
  `letterSpacing` is applied per code point rather than per grapheme cluster,
  matching CSS rather than the GL path's cluster walk. Visible only on text
  with combining marks or emoji sequences.

- **(P3) Decoration and script metrics are derived, not read from the font.**
  The underline / strikethrough / overline offsets and weight are the fixed
  `0.10` / `-0.30` / `-0.90` / `0.05` em constants in `layoutRuns`, and
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

- **(P3) Small caps and `text-transform` have no run spelling.** The two
  remaining gaps in the run style model after the superscript pass. Both are
  harder than they look and for different reasons. `text-transform` breaks the
  caret: `LaidOutCell.srcIndex` / `srcEnd` are UTF-16 offsets into the runs'
  concatenated text, and `'ß'.toUpperCase()` is `'SS'`, so a transform that
  changes length desynchronizes every offset after it — it needs a source-to-
  transformed index map, not a `.toUpperCase()` in `resolveRuns`. Synthetic
  small caps needs a *per-character* size within one run (lowercase rendered
  as scaled-down uppercase), where the run is the unit that carries a size
  today; the honest version splits the entry walk's size off the run, or
  reads the `smcp` OpenType feature, which needs shaping. Real small caps is
  a face, not a synthesis, and would fall out of the HarfBuzz entry below.

- **(P2) `apps/draw` drops every run's styling on SVG export and copy.**
  `packages/svg` serializes and parses `<tspan>` run styling in full, but the
  app never hands it any: `TextObj` (`apps/draw/src/poseUpdate.ts`) has no
  `runs` field, and neither `leafToObj` (`svgExport.ts`) nor `objToSvgNode` /
  `svgLeafToObj` (`svgInterop.ts`) reads `data.runs`. So "Export SVG" and the
  clipboard's SVG flavor — both routed through `sceneSourceOf` → `leafToObj` —
  flatten bold, italic, per-run size, per-run fill and every decoration to the
  node style. Canvas-to-canvas paste is unaffected: it goes through the
  `application/x-weasel-clipboard+json` flavor, a structural clone with no
  field list to fall behind. Predates the superscript work, which the new run
  fields simply inherit. Recorded 2026-08-30.

- **(P3) `layoutMarkdown` ignores the run fields it cannot paint.**
  `packages/text/src/markdownText.ts` is the 2D-canvas path behind
  `renderLabel` (chrome pills), and it reads `segRun.fontSize` while knowing
  nothing about `fontScale`, `baselineShift` or any of the three decorations.
  Left deliberately: it returns x-offsets with no per-run y, so it could honor
  a superscript's *size* and not its *position*, and half a superscript reads
  as a bug rather than a limitation. Either give `LayoutLine` a per-run y or
  leave it narrow and say so in its header. Recorded 2026-08-30.

- **(P3) `markdownToRuns` → AST.** Consider whether markdown markup (today `*`/`**`/`***` bold/italic toggles, parsed with flat boolean state in `packages/core/src/features/text/runs.ts:64`) should be promoted to a structured AST. The output is a flat `StyledRun[]`, not a tree. Defer to a future "rich text" pass — the current shape is sufficient for label/markdown rendering but limits reformatting / re-styling transforms.

---

## Scene, adapters & layout

- **(P2) `arrayAdapter` as the default Canvas adapter — full unification.** The Canvas-level synthesis tier this entry used to describe is gone — `Canvas.tsx` no longer takes `items`/`setItems`/`createDefault`/`poseBounds`/`intersectsRect`, and only `toPose` survives as a layer-config override. `arrayAdapter`, `useArrayAdapter` and `sceneToAdapter` are still three separate wirings. The deeper move — every scene is a tree rooted at one container — was taken by `useScene` (kit-owned tree with leaf/container) but the inline-props and explicit-adapter tiers still sit alongside rather than collapsed. Full unification (one adapter contract, one default wiring) remains an option for later.

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

### Derived geometry follow-ups

Left open by the derived-path arc (`dependsOn` / `derivePath` / `SceneRegistry.derivePath`;
the seam is documented in `docs/extending.md`). Both P1s closed — a derived node
is picked and clipped where it paints, and it follows a live drag. What is left
here is smaller than the connect gesture that comes next.

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

- **(P3) `createPoseOverrides` is not public, but implementing `Scene` requires
  one.** `Scene` is public and its `overrides: PoseOverrides<TPose>` is
  mandatory — and now genuinely load-bearing, since every ongoing gesture writes
  a frame to it. A consumer building a scene-like object by hand therefore has
  to reimplement the table from the type, which `apps/draw`'s geometry-contract
  test does (`stubOverrides`) precisely because it may only touch the published
  surface. Either export the factory or say in the docs that hand-rolling one is
  expected.

- **(P3) A derived node is unpickable through a bare adapter.** The
  scene-backed half of this landed: `NodeShapeEntry.silhouette` takes a `NodeSilhouetteCtx`
  carrying `derivedPath`, `kit:derived` reports it plus its `ink`, and
  `PickSource.derivedPathOf` / `buildSceneTree`'s optional argument resolve it
  where a scene is in scope. What is left is the other side of that split:
  `adapterPickSource` and `Canvas`'s bare-adapter render path cannot derive —
  it needs the dependencies' poses — so a derived node there still answers from
  its own placeholder pose. Closing it means giving the adapter surface a
  dependency read, which is a bigger decision than picking.

- **(P1) Undo after a Delete loses a node's dependents.** The container half of
  this closed with the subtree snapshot in `createDeleteOp` (covered by
  `defaults/delete.test.ts:190`); the `dependsOn` half did not.
  `captureDescendants` (`core/ops/delete.ts:47`) walks `getChildren` only, and a
  dependent is not a descendant — so deleting an endpoint cascades its edge away
  through `removalClosure`, and `invert()` re-inserts the endpoint alone. The
  rich `kit:remove` snapshot that *would* restore the whole closure never reaches
  history, because `applyBatch` suppresses recording (`scene.ts:1134`) and logs
  the external ops instead. The arc's promise that "undo cannot restore the
  halves separately" rests on this.

  `defaults/delete.test.ts:447` reads like it covers this and does not: it
  destructures only the endpoint from its fixture, so the edge is never asserted
  on. Adding that assertion fails today.

  **Arc 1 ships with this hole.** The fix is two parts and neither is a bugfix:
  make the `insertNode` adapters carry `dependsOn` / `derivePath` (below), then add a
  multi-node delete op carrying the closure snapshot plus an `insertNodes` that
  re-attaches by parent and ascending index. That is a second implementation of
  the detach-root reasoning in `kit:remove`, and the two rotting apart is the
  argument for designing it rather than patching it.

  Routing `deleteAction` through `scene.removeMany` does **not** fix this and was
  rejected: `removeMany` goes through `executeAndLog`, which does not consult
  `getActiveJournal()`, so it would silently move deletes out of a consumer's
  active journal into the scene's own history. `apps/draw` wires that for real
  and no in-tree test would have caught it.

- **(P2) Derived pose.** Arc 1b of
  `docs/superpowers/specs/2026-08-28-diagram-plugin-design.md` — the same
  dependency machinery driving a node's pose rather than its path. Unblocks the
  group-bounds defect (`interactions/actions/defaults/group.ts:68`), where a
  container's union AABB is computed once at creation and never re-derived.
  Reaches much further than derived path did: pose feeds bounds, which feeds
  hit-testing, selection chrome, snapping and layout.

- **(P2) Value-compare the resolved poses in `resolveDerivedPath`.**
  Invalidation is pushed by the scene today, which is closed only under the
  triggers someone enumerated — the arc's reviews found three rounds of misses
  (ancestor moves, removal, a dependency appearing). Comparing the resolved
  poses by *value* is instead closed under whatever `derivePath` actually read, and
  needs no push at all for the existence cases. Not the reference comparison the
  seam rejects: an override mutates its buffer in place, which defeats reference
  equality but not value equality. Deferred because its cost is unmeasured — it
  resolves every dependency's pose on every frame. Measure against a real diagram
  before taking it.

- **(P2) `kit:remove`'s snapshot carries `derivePath` as a live function**, so a
  persisted-then-restored history brings derived nodes back inert: `dependsOn`
  survives the JSON round-trip and repopulates the index, but the node will never
  paint. `kit:add` already solves this with `derivePathKey` plus registry
  re-resolution; `kit:remove` should mirror it.

- **(P2) The `insertNode` adapters drop `dependsOn` and `derivePath`.**
  `canvas/sceneAdapter.ts` forwards `clipFromPose` and neither of these;
  `interactions/actions/defaultCommitAdapter.ts` forwards none of the three. A
  derived node round-tripped through either comes back inert. Gates the undo hole
  above.

- **(P3) `setDependsOn` op.** `dependsOn` is fixed at add time, so retargeting an
  edge is remove plus add. Design it with the connect gesture rather than ahead
  of it.

- **(P3) `scenePoseLookup` does not honor `SceneSlotConfig.toPose`**, which
  `buildSceneLayer` shims onto the live adapter's `getPose`. A consumer using it
  would paint dependencies at poses `derivePath` never saw.

- **(P3) `Scene<TData, TLayer, TPose>` is contravariant in `TPose`** via
  `clipFromPose` and `derivePath`, so no concretely-typed scene satisfies the
  action-facing `Scene<unknown, string, unknown>`. Pre-dates `derivePath` —
  `clipFromPose` has the same shape — and the action layer already reaches its
  scene through a cast everywhere, so nothing is blocked today.

- **(P3) `kit:setData` and `kit:setLayer` do not invalidate dependents.** Matters
  only if a `derivePath` reads a dependency's `data`. `kit:move` and `kit:setLayer`
  also never drop a node's own pose-keyed slots, which is a `nodeMemo` question
  rather than a dependents one.

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

### Timelines and rigging

Design: `docs/superpowers/specs/2026-08-22-animation-timeline-rig-design.md`.
Arc context: `docs/superpowers/specs/2026-08-22-game-audio-animation-decomposition.md`.

- [x] **Timeline primitive and hierarchical rig — landed 2026-08-22.**
  `animator.timeline(opts)` (`packages/core/src/animation/timeline/`) registers
  in the animator's table, with sampled / event / nested tracks. The rig
  (`packages/core/src/animation/rig/`) ships `blendPoses`, `resolveSkeleton` and
  `IDENTITY_JOINT`; animating one is a `SampledTrack<Pose>`. Demos:
  `apps/site/demos/TimelineDemo.tsx`, `RigDemo.tsx`.

  The follow-ups below are what is left.

- **(P2) No dep binds a rig to scene nodes.** The design named a `useRig` dep
  following the `insert` pattern; it was never built, so `RigDemo.tsx` calls
  `resolveSkeleton` directly and draws from the result. Every consumer animating
  a rig into a scene re-does that wiring by hand.
- **(P3) Inverse kinematics** — a solver that writes poses. Composes with the rig
  above and needs nothing here changed.
- **(P3) Skinning** — per-vertex bone weights deforming path geometry. The
  renderer flattens paths to meshes, so weights must reach the vertex shader or
  be applied on the CPU per frame. Needs the hierarchical rig first.
- **(P3) Serializable clips** — follows from tracks being typed callbacks rather
  than data. Revisit with the editor's experience in hand.

### Side-scroller demo — landed

`apps/site/demos/SideScrollerDemo.tsx`, with its game logic in
`apps/site/demos/platformer/`. Built as a load test on the timeline and audio
arcs, not a showcase: it changes animation state every few frames, fires
overlapping one-shots continuously, and never lets the clock idle. Its HUD
carries the instrument readouts — frame time, active voices, footstep count,
steady-state jitter — plus a collision-box overlay and a swarm button that pushes
the voice pool past its limit.

A platformer in `apps/site/demos/` is a deliberate exception to the terse,
single-purpose demo convention — an exception, not a precedent.

What it surfaced:

- **(P3) One actions registry still routes input to one canvas.**
  `<WeaselProvider isolate>` gives each canvas its own scope, which is what both
  demos wanted and what they now use, and a second canvas claiming a shared
  registry says so instead of failing silently. What is still unbuilt is
  canvases genuinely *sharing* a registry: `setDispatcher` holds one dispatcher,
  so a toolbar outside two canvases has nothing to say which one it drives.
  That wants a focused-canvas concept — which canvas an ambient `<ActionBar>`,
  keybinding or palette targets — and the registry keyed per canvas beneath it.
  Worth doing when a consumer wants two canvases under one toolbar; isolation
  covers two canvases that simply coexist.

- **(P2) No key-state poll.** `key-held` gives edges; the dispatcher's held set
  tracks claims rather than physical keys and is not exported. Every character
  controller will rewrite `platformer/useInput.ts`'s reconstruction.

- **No tiled-content layer primitive exists** (the P3 under Tiling) — the run
  cycle and the parallax bands are second sites wanting it.

- **Tune two placeholder constants in the browser.** `DEAD_ZONE_X` in
  `apps/site/demos/platformer/camera.ts` sits at 28 (vs `DEAD_ZONE_Y` at 20),
  and `STEP_SCHEDULE_BUDGET_MS` in `SideScrollerDemo.tsx` at 16 — one frame,
  picked rather than measured. Both want a value chosen on feel: the budget
  trades constant footstep latency against how long a frame has to run before a
  step falls back to playing immediately. A dead-zone camera settles at exactly
  `DEAD_ZONE_X` from a stationary target, so `platformerCamera.test.ts` asserts
  that invariant rather than a fixed distance — changing either constant does
  not break a test.

### Side-scroller (scene graph) — landed

`apps/site/demos/SceneScrollerDemo.tsx` plus `platformer/sceneWorld.ts`. The same
platformer built on the retained tree: 254 leaf nodes drawn by the built-in
painters, the camera as the canvas `view`, and the shared fixed-step loop
extracted to `platformer/world.ts` so both demos run the identical simulation.
The bypass twin keeps its bypass; this one shows the engine.

Measured against it (Chrome, 120 Hz display, DevTools tracing on — the absolute
milliseconds are inflated by the tracing, the ratios are the signal):

| | immediate | scene graph |
|---|---|---|
| frames committed / s | 109 | 76 |
| main-thread busy / s, immediate = 1.00× | 1.00× | **1.27×** |
| main-thread busy / committed frame | 6.31 ms | **11.57 ms** |
| major GC over the window | 57 ms | **549 ms** |

Unloaded, both peg the 120 Hz display and neither drops a frame. The costs only
separate under load — which is the honest read: the retained tree is affordable
here, and it is not free. That load was never written down, so the table below
is a different, recorded measurement rather than a fifth column here.

Re-measured after the frame-loop arc, same machine and browser: both demos with
the run started and no player input, ten-second windows, DevTools tracing on.
"main" is the tree before the arc, "frame loop" after. Busy is the sum of
renderer-main `RunTask`; the scene twin's frame count is its own readout, the
immediate twin's a `requestAnimationFrame` counter. The scene-graph "frame loop"
column shows two runs, which is the run-to-run spread.

| | immediate, main | immediate, frame loop | scene graph, main | scene graph, frame loop |
|---|---|---|---|---|
| frames / s | 120 | 120 | 120 | 120 |
| main-thread busy / s, busy seconds per wall second | 0.19× | **0.11×** | 0.47× | **0.35–0.38×** |
| busy / committed frame | 1.58 ms | **0.89 ms** | 3.94 ms | **2.88–3.21 ms** |
| major GC over 10 s | 0 ms | 2 ms | 10 ms | 4–10 ms |
| `CanvasInner` setState / s | 118 | **0** | 120 | 100–110 |

The last row counts `CanvasInner`'s own state writes, not React commits: both
demos commit at roughly 5 Hz besides, from the readout interval in
`SideScrollerDemo.tsx:110-125`, which is what the React Profiler will show.

Both twins hold 120 Hz at this load, so the frame rate says nothing and busy per
frame is the number that moves. The immediate twin drops 44%, and `118 → 0` is
firm for structural rather than statistical reasons: that twin renders an empty
scene at a constant view and the branch never touched it, so those writes were
`CanvasInner`'s per-paint `setState` and they are gone by construction.

The scene twin drops 18–27% — its two runs spread 2.88–3.21 ms, about 11%, at
n=1 per configuration — and effectively all of that is the demo's own switch to
`setView` on the handle. With the camera left in `useState`, the frame loop alone
measured 3.86 ms/frame against main's 3.94: a 0.08 ms difference inside a 0.33 ms
spread, which is no measurable timing difference at all. Read the mechanism
instead of the number — a consumer calling `setState` every frame pays for that
render whatever the canvas does underneath it, so decoupling paint from render
cannot show up until the consumer stops.

Major GC did not move, as expected — per-frame pose allocation belongs to the
ephemeral-pose-overrides arc.

What it surfaced:

- **(P1) A per-frame camera costs a React render per frame — landed
  2026-08-25.** The canvas paints from its own animation frame
  (`packages/core/src/canvas/useFrameLoop.ts`) and the view lives in a ref with
  `getView` / `setView` / `subscribeView` / `subscribeFrame` on the canvas
  handle, so a camera driven through `setView` costs no render. The second table
  above is what it bought. Design:
  `docs/superpowers/specs/2026-08-24-frame-loop-decoupling-design.md`, Part 1.

- **(P1) `SceneCanvas` commits on every scene mutation, even when the host opted
  out** — those are the ~100–110 commits/s the scene twin still pays above.
  Carried under Rendering & paint, since it is not this demo's problem. The
  ephemeral-pose-overrides arc narrows it but does not close it: an override never bumps the version, while this demo's
  `scene.add` / `scene.batch` still does. Measuring anything else per-frame
  means stopping the scene writes first —
  `apps/site/demos/__tests__/SceneScrollerDemo.test.tsx` freezes `syncScene` to
  isolate the camera at all.

- **(P1) `setPose` demands a fresh pose object per node per frame, and the GC
  bill is visible.** `nodeMemo` keys painter output on pose *reference*
  (`nodeMemo.ts:1-28`), so mutating `node.pose.x` in place silently serves a
  stale cached draw. Correct code therefore allocates one object per moving node
  per frame — ~27 × 120/s here — and major GC went from 57 ms to 549 ms over a
  ten-second window, nearly 10×. A pose-write path that can take scalars, or an
  explicit generation bump that lets a caller mutate in place, would remove the
  churn without giving up the memo.

- **(P2) A 60 Hz loop has no non-recording way to write.** Every mutation is an
  undo entry; `scene.batch` reduces a frame to one entry, which is still 120 per
  second. The only real escape is `getActiveJournal` plus periodic `cancel()`,
  and that journal's inner history is itself unbounded. The demo caps
  `historyLimit` at 60 and calls that a workaround, not an answer.

- **(P2) The scene tree is not a transform hierarchy, so a rig cannot be one.**
  Default composition is `IDENTITY_POSE_COMPOSITION` — "parents are
  grouping-only (no transform)" (`composePose.ts:45`) — and `buildSceneTree.ts:42`
  uses nesting only for the clip chain. The opt-in `composeRectPose` adds
  translation and nothing else. So `resolveSkeleton` is resolved to world
  matrices and flattened onto eleven independent bone nodes every frame. Rotation-
  aware pose composition would let the rig be expressed as parenting, which is
  what it already is everywhere except the scene.

- **(P3) `kit:text` nodes cannot opt into `verticalAlign`.** The painter
  forwards the pose height but not the alignment (`NodeShape.ts:386`), so
  centring a glyph in its box means nudging `pose.y` by hand — see the `?` block
  in `sceneWorld.ts`.

- **(P3) No view-bounds culling.** All 254 nodes paint every frame regardless of
  the viewport; the immediate twin windows tiles to visible rows and columns.
  `renderOrder()` plus the view bounds is enough to close this, and it is the
  one place the immediate version is structurally ahead.

Two predictions the demo **disproved**, recorded so they are not re-raised: the
sprite-sheet gap closed independently (`ImageDrawCommand.source` / `flipX` /
`flipY` / `frameRect`, see
`docs/superpowers/specs/2026-08-22-image-source-rect-flip-design.md`), and the
"public frame tick" the arc expected to need was already shipped as
`Animator.onTick` plus `keepAlive`.

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

- [x] **`@weasel-js/audio` — shipped, published at 1.2.0.** A leaf package with
  no weasel dependencies: lookahead scheduling on its own one-shot timer, voices
  with handles and `cancelKey`, buses with gain/mute/solo, `spatialize()`, and
  analyser taps with `bands(n)`. Registered in `build:leaves` and the `fixed`
  group. Consumed by `AudioDemo`, `SideScrollerDemo` and `platformer/sfx.ts`.

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

- **(P2) Every React Aria overlay inside a lab renders unthemed.** RAC portals a
  `Popover` / `Modal` to `document.body`, which is outside the element labkit
  paints its resolved tokens onto (`.lk-root`, via `applyTheme`). Every
  `--wzl-*` custom property resolves to the empty string there, so the overlay
  falls back to browser defaults — a light panel with unreadable text in a dark
  lab. This hits `Select`'s dropdown, `ComboBox`, `Dialog` and `Callout` alike;
  the annotation Export panel is only the first to have been looked at.

  Its fix — passing the lab root as `UNSTABLE_portalContainer`
  (`annotations/ExportMenu.tsx`) — is per call site, and the prop is deprecated
  upstream in favour of a provider RAC 1.18 does not export. The durable answer
  is probably in `@weasel-js/ui`: an overlay defaults to the nearest themed
  ancestor of its trigger rather than to the body, which fixes every consumer
  with no plumbing. That is a behaviour change for `apps/draw` too, so it wants
  its own look.

- **(P2) labkit's loupe drives itself with plain listeners, not bindings.** The
  gesture grammar already has every gesture it needs — `keyHeld` with a free key
  arg, `wheel` with a direction arg, `click` with a target
  (`packages/gestures/src/grammar/gestures.ts:11-24`) — but a labkit trial does
  not route input through the dispatcher, so `packages/labkit/src/loupe/useLoupe.ts`
  attaches `pointermove`, `keydown`/`keyup` and a capture-phase `wheel` by hand,
  the last of which has to run ahead of `usePanZoom` and stop propagation to do
  it. They are all in that one hook so this is a single rewrite once trial input
  goes through the dispatcher; the loupe is the reason to want that, not a
  reason to build it first.

- **(P2) `layout="inline"` does not cover every control kind, and row spacing is
  still not tokenized.** What remains of the density gap found 2026-09-01;
  `ControlPanel` now takes `pack` and `layout`, and fields size to their content.

  `ColorRow` and `CheckboxRow` take no `layout` at all — `PropertyRow` gates the
  inline class on `variant === 'default'`, and those two render the color and
  checkbox variants — so a panel asking for inline rows still gets block ones for
  two kinds out of six.

  Spacing is four hard-coded numbers in `Properties.module.css` — `.list`
  `row-gap`, `.group` `padding`, `.groupTitle` `margin`, `.panel` `padding` —
  none of which read a custom property, so nothing outside the module can move
  them without selector surgery. The field widths beside them now do
  (`--wzl-prop-number-width`, `--wzl-prop-text-width`); a `density` prop on the
  `@weasel-js/ui` containers, redefining the rest as locals, is the general
  form.

- **(P2) The shared pick walk's view-owned gates are not reachable everywhere.**
  `pickWalk` (2026-08-29) asks a `PickSource` five questions per candidate, two
  of which belong to the asking view rather than the scene: what alpha it paints
  a node at, and whether it paints a layer at all. Neither has a supplier on
  every path, and the two gaps want one decision between them.

  `useSceneSelectTool` takes a `layerIsPainted`, but `<SceneCanvas>` exposes no
  `layerVisibility` / `layerOrder` prop to build one from — only a bare
  `<Canvas>` consumer can pass one, so today the option is consumer-only
  surface. Either `<SceneCanvas>` should forward those props, or the scene's own
  `LayerRecord.visible` is the whole answer at that level and the option should
  say so.

  `adapterPickSource` supplies neither gate: a bare `SelectAdapter` has no layer
  enumeration and no override table, so a consumer without a `Scene` gets the
  clip chain and the paint ordering but not alpha or layer paint. Defensible —
  there is nothing to read them from — but it is now a declared asymmetry
  between the two sources rather than an accident, and it should be either
  documented as permanent or closed by widening `SelectAdapter`.

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

  One that is not settled: stroke align, clip and text layout genuinely cannot
  round-trip through SVG 1.1, but the exporter does not say so out loud, and
  silently dropping them is the part worth fixing.

- **(P2) Nine defects the cascade audit turned up outside its own pattern.** All
  found 2026-08-29 while collapsing, none of them an instance of the duplication
  the audit was hunting, so each wants its own decision.

  `selectAll` has no visibility filter, so Cmd+A then Delete removes nodes the user
  cannot see. SVG export ignores `layer.visible` while pixel export honors it.
  `LayerRecord.locked` is written in five places and read by nothing. User layers
  lose their `name` through `toJSON`. `<image>` flip and source-rect never
  serialize. `packages/{svg,hud,ui,labkit,modes,d3,paint}` never import `geom` at
  all, and three incompatible matrix-singularity policies coexist.
  `useHandTool.ts:81` carries four dead deps (`inertia`, `axis`, `tracker`,
  `decay`) — the same inert-options bug recorded under Tools.

  Text has one left: `measureText` / `measuredWidth` in `@weasel-js/text` now have
  no in-repo caller. They are a legitimate Canvas2D measuring utility for consumers
  drawing to a 2D context, but nothing in the kit measures that way any more, so
  the question is whether they are public API or residue.

- **(P2) The removal closure is computed twice.** Post-dates the 2026-08-29
  audit and is the same pattern it was hunting. `removalClosure` in
  `core/scene/scene.ts` walks down from the roots; `coveredByEmitted` in
  `interactions/actions/defaults/delete.ts` walks up from each candidate,
  because no public surface exposes the reverse `dependsOn` index. It has
  already drifted once, in the arc that created it: adding the dependents
  relation to the scene without adding it to `delete.ts` made the built-in
  Delete key throw mid-batch on a selection holding a node and its edge.
  Exposing the reverse index is what collapses it.

- **(P2) Safari's `gesturestart` / `gesturechange` / `gestureend` are unhandled.** They are the second trackpad pinch channel on macOS Safari, alongside the ctrl+wheel one `viewportZoom` reads. Nothing in the repo listens for them, so Safari trackpad pinch gets whatever the wheel path synthesizes. Worth deciding deliberately rather than by omission. Note before adding a listener: `viewportZoom` now claims bare ctrl+wheel, so a `gesturechange` handler becomes a *second* channel for the same physical gesture — the double-apply `.changeset/mac-trackpad-pinch-zoom.md` just removed. Consolidate it into `makeViewportZoomAction` behind one scale-delta seam, not as a fourth listener.

- **(P3) Alignment guides — v1 follow-ups.** Auto-derived alignment guides shipped 2026-06-19 (`packages/core/src/features/guides/alignment/`: `deriveAlignmentGuides` + `matchAlignment` + `alignMoveBehavior`/`alignInsertBehavior`/`alignResizeBehavior`, rendered via `createGuidesLayer`; demo `apps/site/demos/AlignmentGuidesDemo.tsx`). Spec: `docs/superpowers/specs/2026-06-19-alignment-guides-design.md`. Multi-select drag alignment shipped 2026-06-19 (`alignMoveBehavior` matches the selection's union AABB via `unionBounds`). Remaining deferred: (a) **Figma-style segment rendering** — line spanning only between the aligned objects with end ticks / offset labels, instead of full-canvas lines (needs a span-aware layer, not just axis+offset); (b) **equal-spacing / distribution guides** ("equal gaps" across 3+ objects). Rotated-object alignment is done: both ends read `AlignBoundsProjection.boundsOf`, which returns the rotated AABB.

- **(P3) Reconcile `BandEditor` with `Slider`.** `BandEditor` (bands: a contiguous tiling of an axis, seams draggable, each band carrying a payload) ships alongside `Slider` (a thumb list on an axis, `constraint: 'ordered'`, `onAddThumb`/`onRemoveThumb`, `renderTrack`). Under a contiguous tiling the two are the same control — N seams determine N+1 bands, so seams *are* an ordered thumb list — and they were kept separate deliberately: bridging them means teaching `Slider` about the region *between* thumbs (payload, hit-testing, selection), which is the wider change the reconciliation actually requires. The other trigger is `Slider` needing a non-linear axis. A third option arrived with `windease` 1.0 (2026-08-20): its `LayoutStrategy` is public API — `layout()` returns placements plus affordances, `reduce()` folds a gutter drag into strategy state — so a band control is a strategy you write rather than a control you build, and it brings widened gutter grab targets, `affects` for lock suppression, and — as of 1.2.0 — keyboard-operable gutters with it (`role="separator"` with the value triple, arrows plus Home/End, each keypress synthesized into the same drag event the pointer sends so the strategy clamps once). It ships no band strategy of its own: the two built-ins are `gridStrategy` and `stripStrategy`, and strip is `LayoutStrategy<void>` whose gutters are single-child `resize-x` affordances writing pixel `placement.size`. Mapping domain values onto seams is still the consumer's. Note `Slider` is the former `RangePicker`; its spec carries a banner saying so.

- **(P3) windease follow-ups, now that labkit is on it.** `labkit` depends on `windease ^1.2.1` (`~/src/windease`, `orochi235/windease` — a browser window manager: nodes with capabilities, pure `LayoutStrategy` functions, DnD, JSON snapshots) and `Workspace.tsx` tiles through its `gridStrategy` and `Store`. `gridDims.ts` is gone, as the evaluation predicted: `gridStrategy` auto-balances to `ceil(sqrt(n))` on its own.

  What is left is the one live bug the adoption knowingly took on, in `hints.render: 'flow'` — a pane that reflows without resizing fires no observer, so keyboard navigation reads a stale rect until the child set changes. Flow is the mode where a host keeps its own CSS grid and takes only the gestures; what it gives up is everything downstream of the strategy (placements, affordances, `unplaced`, `overflowMode`, `hints.sizing`, the settle animation).

  Versioning stays a caret range, not lockstep: windease is a separate repo with its own release cadence, and a changesets `fixed` group cannot span repos anyway. The risk a range carries is the one to watch — windease shipping a breaking major that labkit's `^` silently declines to follow.

- **(P2) A mode-varying token referenced from a `:root` primitive freezes at the dark value.**
  CSS substitutes a `var()` inside a *custom property* at the scope where that property is
  declared, so a primitive in `:root` that references a mode semantic inherits the default
  mode's value into every other mode's block. `--wzl-line`, `--wzl-line-subtle`,
  `--wzl-line-strong`, `--wzl-surface-hover` and `--wzl-surface-pressed` are all authored this
  way and all resolve to their dark values in light mode. Arc 4 sidestepped it by not shipping a
  composite `--wzl-shadow-1`; the five existing ones are still wrong.

  It only bites the raw-`tokens.css` + `data-wzl-mode` path — `applyTheme.ts` re-emits every
  resolved token into one rule, so labkit is fine. The broken path is what
  `packages/ui/.storybook/preview.ts` uses, which is why the Foundations page's own light/dark
  comparison is misleading. The fix is in `build-tokens.ts`: emit a primitive that references a
  mode semantic into each mode block rather than into `:root`. The test must switch
  `data-wzl-mode` and read a *computed* value — `generated.test.ts` already asserts the
  `color-mix` mechanism is present, which is exactly what let this pass.

- **(P3) The light accent sits below AA for text drawn on it.** `--wzl-fg-on-accent` against the
  interstellar light accent `#a86f3c` measures 3.85:1, under the 4.5 AA needs for normal text.
  This is every accent-filled control in `@weasel-js/ui`, not one site — a theme-level call
  about the accent, not something to patch with a local literal.

- **(P3) The color literals with no token equivalent.** Arc 4 tokenized what had a token and
  left the rest rather than inventing a mapping — `check-design-tokens` covers size, weight,
  radius and the stray danger reds, but not color generally, for that reason. What remains is
  `Badge`'s tone palette (`#7ab8d4`, `#d4a574`), the `GradientHandles` and `Keycaps` literals,
  and roughly 70 `rgba()` values that are depth geometry (box-shadow insets, gloss gradient
  stops, the dialog scrim) for which the theme ships no shadow, gloss or scrim token. Each needs
  a semantic name before it can become one.

- **(P3) `ZoomControl`'s slider fixes its own width, so the viewport cluster can only wrap.**
  `.lk-root .lk-zoom__slider { width: 108px }` pins the slider's min-content contribution, so no
  flex pressure compresses the zoom row — under about a 168px well it wraps to two rows, and
  below that it will overflow. Fixing it properly means changing how `ZoomControl` sizes its
  slider.

- **(P2) labkit: nested config values.** `f.schema` emits a flat `PrefGroup` —
  every leaf a direct child, so a leaf's path is its config key and both
  `ControlPanel` and weasel-ui's `PrefsForm` address it identically. `.section()`
  buckets leaves under a heading without nesting the value. Real nesting needs
  path writes through `setConfig` / `updateTrialConfig` (both flat today),
  `onConfigChange` diffing over a tree, and a storage migration. `PrefGroup`
  already nests, so the vocabulary is not the blocker.

- **(P2) Reconcile core's `ToolPrefLeaf` with weasel-ui's `PrefLeaf`.**
  `packages/ui/src/components/Prefs/schema.ts` avoids importing
  `@weasel-js/core` on purpose so a `ToolPrefGroup` assigns into `PrefGroup`
  with no cast, and its header says "Keep the two in sync field-for-field."
  They are not: core has `paint` (`ToolPrefPaint`) and ui has no equivalent, so
  `defaultNodeProperties` emits `kind: 'paint'` and `kind: 'font-family'` leaves
  that `PrefsForm` can only render as placeholders. Core carries a compile-time
  exhaustiveness tie (`_BuiltinKindsExact`, `prefs.ts:118`); there is no
  cross-package counterpart and there cannot be one while the contract is
  structural, so the invariant is a comment. labkit now builds on `PrefLeaf`
  (2026-08-26), which stopped a third dialect but did not close this.

- **(P3) `ControlPanel` ignores three `Pref*` presentation fields.** `control:
  'switch'` draws a checkbox and `control: 'radio'` draws a segmented
  `ToggleRow`; both are reasonable renderings, and `PrefsForm` honors the
  distinction. `pair` is not honored at all. Two more were deliberately kept out
  of the builder rather than shipped inert, because ignoring them corrupts a
  value rather than an appearance: `unit` (a number stored in radians and
  displayed in degrees would be edited raw) and `alpha` (`ColorRow` takes alpha
  as a separate 0..1 value, so an `#rrggbbaa` default truncates on first edit).
  Honoring those two means teaching `ControlPanel` a hex-alpha split and a unit
  conversion.

- **(P2) labkit: `registerSerializers` has no callers, so instrument serializers never run.** `LabStore.registerSerializers` exists and nothing in the repo calls it, leaving `serializers` permanently `{}` — `Instrument.serialize` / `deserialize` are dead at flush, at hydrate and around snapshots, and an instrument whose state is not JSON-safe silently loses it. Not a one-liner: `createLabStore` runs before any React provider mounts, so a late registration cannot reach hydration. The fix is probably to take serializers as a `CreateLabStoreOptions` field instead, which also gives the hook a place to be typed. Document migrations are unaffected — they operate on already-serialized JSON.

- **(P3) `<ToggleBar>` polish.** Shipped to `@weasel-js/ui` (spec/plan dated 2026-05-17). Visual still needs polish — literally, polish this.

- **(P2) weasel-ui form fields are `width: 100%` with no intrinsic-width option.** That is why labkit pins a width at all three of its `Select` / `NumberField` call sites. A real affordance on the components — an intrinsic or content-derived width — would retire the convention. Property-row inputs stopped stretching on 2026-09-01 (`--wzl-prop-number-width` / `--wzl-prop-text-width`), which is the shape the components want; `Select` and `NumberField` still fill.

- **(P3) `.lk-shell` is `height: 100vh`.** A lab mounted anywhere but the viewport top overflows by its own offset. Harmless on the dev page, wrong in general.

- **(P3) labkit's mode toggle is three text labels.** `MODES` in `LabHeader.tsx` is Auto / Light / Dark as words. Blocked on a sketch from Mike for the `auto` glyph: a half-filled circle breaks a stroke-only set and a monitor outline reads as "display" rather than "follow the OS". Icons are authored in `packages/ui/scripts/icons/*.mjs` and generated by `node packages/ui/scripts/gen-icons.mjs`; see CLAUDE.md on proofing them.

- **(P2) Two implementations of an editable curve, and the timeline built the
  second one.** `<Timeline>`'s graph mode draws its own sampled polyline, its own
  bezier handles and its own drag, reimplementing what `packages/ui` already
  has. There should be exactly one.

  The reuse is the substrate, not the component. `CurveEditor.tsx` is a
  back-compat shim (it says so at its own line 1) over three layers that are the
  real surface: `Plot2D` (`Plot2D/Plot2D.tsx:84`) draws the SVG plane, grid and
  axes and maps client coords back to the model via `clientToModel` (`:126`);
  `LayeredCurveEditor` (`:99`) owns pointer routing and undo, with layer state
  held by the consumer (`:34`) so one layer's drag can update another's mid-
  gesture (`:89`); and `CurveLayer<S>` (`layerTypes.ts:76`) is the generic
  per-layer contract.

  So the work is **a new keyframe layer**, not a swap. The built-in
  `createFunctionLayer` cannot be reused: it has no tangent-handle concept
  anywhere — tangents are derived from neighbours, and `constrain: 'function'`
  only forces monotone interpolation — so it cannot express per-segment
  cubic-bezier easing; and its `ControlPoint {x, y}` cannot hold a
  `Keyframe<T>` whose value is not a number.

  Worth taking: `Plot2D` as the graph surface (graph mode today is a bare
  percent-space SVG at `Lane.tsx:269` with no grid, axes or value labels);
  `LayeredCurveEditor`'s gesture routing, which has `pointerId` filtering and a
  cancel path that restores the pre-gesture snapshot — adopting it would have
  pre-empted both bezier-drag defects fixed on 2026-09-02; and `hitTestCurve`
  (`hitTest.ts:41`), which would give "click the curve between two keys" a real
  hit radius in place of the full-lane-height invisible `.segment` divs
  (`Lane.tsx:251`) that currently swallow clicks across the whole lane.

  **The dope sheet must stay DOM.** Its keys and segments are focusable and
  aria-labelled (`Lane.tsx:273`); CurveEditor's SVG anchors have no `tabIndex`
  and no ARIA at all, so moving it onto the plot would lose accessibility
  Timeline has and CurveEditor lacks.

  Two things need designing rather than porting: a stack of lanes is N plots,
  not one plot, each with a y domain derived from its own row's data
  (`Lane.tsx:95`); and the x axis is a pannable/zoomable window with tick
  generation and a playhead, where `Plot2D`'s `xRange` is a fixed prop with no
  analogue.

  Do **not** merge the interpolation maths. CurveEditor interpolates
  (Catmull-Rom, Fritsch-Carlson monotone, passing through every anchor); easing
  approximates (CSS cubic-bezier with explicit handles, Newton solve). Different
  problems.

- **(P3) `snapTime` and `BandEditor`'s `snapped` are the same function.**
  `Timeline/keys.ts` and `BandEditor.tsx:134` carry the same algorithm, the same
  `SNAP_PX = 6` and the same alt-to-defeat convention. `BandEditor/scale.ts:1`
  declines to generalize on the grounds that doing so "is a job for a second
  consumer that needs one", which is reasoning this repo bans. Relatedly there
  is no `--wzl-handle-*` token: Timeline's `.key` (9px) and CurveEditor's
  endpoint (10px) are both 45°-rotated squares that arrived there independently.

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

### labkit inlines core, so a consumer using both holds two registries

- **(P2) `@weasel-js/labkit` bundles `core` rather than resolving it at the
  consumer.** Its `tsup` config aliases every `@weasel-js/core` entry point to
  core's built files, so core is inlined and labkit's dist imports it nowhere.
  That is why labkit kept an ordinary dependency when `font` and `core` became
  exact peers everywhere else — a peer names a copy it never resolves. The
  consequence is the failure the peer change just closed, reached by another
  route: a consumer using labkit *and* core registers a face or a paint kind
  into one copy of the registries and reads the other, and gets a blank canvas
  with no diagnostic beyond the `layoutRuns` warning. Either externalize core
  in labkit's build and peer it as `svg` now does, or state that labkit is a
  whole-harness import that must not sit beside a direct core dependency.

### Unscoped alias package name

- **(P2) `weasel-js` is unpublishable under that name.** npm rejects it as too
  similar to an existing package, so `packages/weasel-js` is marked `private`
  and `changeset publish` skips it (2026-07-26). Everything else about it is
  live: it builds in `build:downstream`, the consumer smoke test still audits
  that every dist entry is a shim re-exporting core, and it stays in the
  lockstep `fixed` group so its version tracks the scoped packages. Publishing
  is one `private` flag away once a name is settled. Options: pick a different
  unscoped name, or decide the scoped `@weasel-js/core` is the only entry point
  we want and delete the alias. Its README says so.

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

From `docs/specs/2026-05-03-weasel-den-design.md`. **Read `packages/den/README.md` first** — the spec's `{ registry, alwaysOn, keybindings }` pack shape was superseded by core's `Contribution` + `mergeContributions`, and its convenience layer shipped inside core as `ToolBundle`. The items below are what survives that.

- **(P3) Additional domain bundles.** `useWhiteboardPack` (sticky notes, freeform pen, text), `usePresentationPack` (frame tools, slide nav). Each is its own arc, and each is a `Contribution` bundle rather than a den pack. The diagram one is superseded — it has its own design in `docs/superpowers/specs/2026-08-28-diagram-plugin-design.md`, shipping as `@weasel-js/diagram`.
- **(P3) Migrate `useSelectTool` / `useInsertTool` / `useTextTool` / `useUserPenTool` to weasel-den.** Defer until each is stable post-overlay-channel work and any further Tool API iteration. They're staying in core to keep being canonical examples for primitive design.
- **(P3) Runtime plugin discovery.** Explicit non-goal in v1 — tools register statically via `useTools({ registry })`. Add when external authors want to ship tools without app rebuild.
- **(P3) Public third-party extension SDK.** Deliberate exports happen during the split, but no marketing or stability guarantees yet.
- **(P3) Per-workspace pre-commit narrowing.** Pre-commit hook should run only the workspace whose files changed (lint-staged dispatcher).

### d3 integration plugin

**Shipped.** `useSimulation` + d3-force compat (2026-05-16), then the data-join and transition chain in `@weasel-js/d3`: `d3Bind(scene, data, { key, animator }).pose().data().join()` and `.transition().duration().ease().delay().tween().end()`. Note `join()` takes no arguments — enter/update/exit is a diff it performs, not callbacks you pass. Demos: `ForceGraphDemo`, `D3SortableDemo`.

Open, from `docs/superpowers/specs/2026-05-17-d3-plugin-design.md`:

- **(P3) Exit transitions.** Fade before remove — schedule the tween, emit Delete on tween end.
- **(P3) Chained transitions.** `.transition().transition()`; the animator's loop primitive already sequences, the chain just needs to thread it.
- **(P3) Typed `data` payload.** `.data(fn)` returns `Record<string, unknown>`; the binding could carry the data type through the chain for autocompletion.
- **(P3) Indexed diff.** `join()` walks the scene O(n) per call; a key map is faster on large datasets.
- **(P3) `d3-zoom` / `d3-drag` adapters.** Both duplicate kit systems (`useWheelZoomTool` / `useHandTool` / `useViewAnimation`; `useDragGesture`). A bridge is worth building only for d3 semantics the kit lacks, not for parity.

`d3-scale` needs no bridge — consumers import `scaleLinear` and call it. Axis *rendering* (ticks, labels) is data-visualization surface and belongs to the reserved `chart` package, not to this one; see `docs/superpowers/specs/2026-08-28-diagram-plugin-design.md` for that split.

Simulation primitive open follow-ups (all still open — no built-in forces, pin helper, or seeded RNG in `packages/core/src/features/simulation/`): drag-to-pin helper hook, sugar wrapper that hides the d3-shaped nodes array, built-in forces (center/collide/x/y/drag), history-bypass adapter wrapper, worker offload mode, seedable RNG.

### Parallax follow-ups

- **(P3) Dispatcher-aware hit-testing for interactive parallax planes.** Needs design pass on plane registration, click resolution order, selection-chrome projection.
- **(P3) `useScene` user-layer `parallax` property wiring to `createParallaxLayer`** at the SceneCanvas adapter seam.
- **(P3) Animated parallax** — tween pan/zoom for intro effects; compose `useAnimator` over the opts.

### System-registries pattern

- **(P3) `createReflectable<T>()` utility for the system-registries pattern.** Surfaced 2026-05-12. The kit maintains ≥8 registries with different lifecycles (fonts, tools, ops, actions, easings, shaders, Canvas layers, object-kind). The documentation half shipped — `docs/concepts.md:364` now has a "System registries" section cataloging every registry. Remaining: ship a small `createReflectable<T>()` utility for the cross-cutting reflection concern (debug overlay enumeration, conflict detection). A grand unification is still probably wrong — promote "pick one shape per scope category" only after 3+ registries in the same category exist.

---

## Load cost

Both apps shipped their own source as string literals so a panel could display
it. Read bundle size against module count: the site produced 10.9 MB from 4,047
modules, and that ratio — not dependency bloat — is what points at data-as-code.

Measuring before/after in one tree means `dist-demo/` holds whichever build ran
last, which is not always the one you think. Check the entry chunk's hash
against the build you mean to inspect before believing a grep over it — the
failure is silent and reads as a clean result.

- [x] **Demo site — fixed 2026-08-23.** `apps/site/registry.ts` held 105 eager
  static imports (55 of them `?raw`) and, at the bottom, an eager
  `import.meta.glob` over `apps/site/demos`, `apps/draw/src` and
  `packages/*/src`. That glob alone inlined **1,880 files — about 9.3 MB, 82%
  of the bundle — to produce 11 companion source tabs**, and 642 of them were
  kit test files. Opening one demo downloaded all fifty plus everyone's source.

  **Total emitted JS fell 11.20 MB → 2.20 MB across 148 chunks.** That is the
  number to read first: the 9 MB was not deferred to a later fetch, it was
  deleted, because nothing ever needed it. Deferring it — a non-eager glob —
  would instead have emitted 1,880 one-file chunks to serve 11, which is why
  the resolution moved to build time rather than to a lazy glob.

  Production build, first paint on `#scene`, cold cache over loopback:

  | | JS bytes | JS requests | DOMContentLoaded |
  |---|---|---|---|
  | before | 10,962,344 | 2 | 386 ms |
  | after the registry split | 1,014,631 | 10 | 175 ms |
  | after the four below | 798,308 | 9 | 63 ms |

  The entry chunk went 10,961 kB → 559 kB → 291 kB (2,795 → 178 → 91 kB gzip).

  The registry literal now carries metadata and a `load()` per demo;
  `React.lazy` fetches the component, and the code panel fetches a tab's text
  when it scrolls into view. `scripts/vite-demo-sources.ts` resolves companion
  tabs at build time and serves each file as its own chunk. Test files are
  excluded by construction, not by a filter: the plugin emits a chunk only for
  a file some demo's relative import actually names, so there is no
  all-files-minus-tests rule that can drift. Switching demos fetches two chunks
  (component + its source); clicking a companion tab fetches one.

  Ordering matters if any of this is revisited: `React.lazy` on the demos alone,
  with the glob left in, buys only ~9% — top-level registry code consumes those
  strings and keeps them eager.

  Four smaller wins landed on top of that split, all measured the same way:
  `Releases` is lazy so `virtual:changelogs` leaves the entry bundle (214 kB
  chunk), `prism-react-renderer` moved into a lazy `SourceView` (86 kB chunk),
  the sidebar logo became a 40 kB webp (was a 181,607-byte PNG for a 449×496
  image), and `main.tsx` no longer `await`s `registerFont` before rendering —
  `<SceneCanvas>` subscribes to `subscribeGlyphReady`, which `registerFont`
  fires, so text repaints when the atlas lands instead of first paint waiting
  on it. That last one is latency rather than bytes; it is most of the
  175 ms → 63 ms.

  What is left in the 291 kB entry chunk is `WeaselRenderer` and the kit
  surface the nav itself pulls in. That weight is genuine; see the tree-shaking note below.

- [x] **WeaselDraw — fixed 2026-08-24.** `apps/draw/src/dev/sourceLookup.ts`
  embedded this app's own source as string literals, eager because `main.tsx`
  statically imported the two `#/dev/*` surfaces that read it. Both are now
  `React.lazy`, tests and stories are excluded from the glob, and `main.tsx`
  no longer `await`s `registerFont` (same reasoning as the site).

  Entry chunk **2,116.31 kB → 1,212.36 kB** (623.86 → 382.80 kB gzip), one
  modulepreload, 6 chunks.

  **The trap, if you touch that glob: `import.meta.glob` is resolved by static
  analysis, so both arguments must be inline literals.** Hoisting the patterns
  or the options object into a `const` leaves vite unable to read them — it
  silently drops `eager` and every matched file becomes its own dynamic chunk.
  That turned one modulepreload into 87 and, measured cold on Slow 4G, looked
  exactly like "lazy-loading the dev surfaces caused a 6× FCP regression".
  It did not; the glob did. Bisect before believing a chunk-count regression.

  Measuring this needs care beyond the usual: `python3 -m http.server` handles
  one request at a time, which serializes a many-chunk build and invents a
  regression no real host would show — use a threaded server. Emulated FCP also
  varies enough between runs that only the build-output numbers above are worth
  quoting; treat the timings as directional.

  The reusable piece from the site fix is the per-file source module, not the
  demo-tab plugin wrapped around it. **If you lift it, keep the `.js` suffix on
  the virtual id** (`virtual:demo-source:<path>.js`): a virtual id ending in a
  real extension gets claimed by vite's css/json/jsx transforms, and postcss
  will try to parse the JS module as CSS.

  Still open for draw: it fetches the Inter atlas (`inter.json` + `inter.png`,
  212 kB together) on every load, and now on the critical path for text rather
  than for first paint. On the duplicate-atlas item below — draw's production
  first load fetches each of those two files exactly once, so whatever pulls
  the `@weasel-js/hud` copy is not on that path; scope it before fixing it.

---

Still open, measured 2026-08-23 and not addressed by the two fixes above:

- **(P2) The Inter atlas is downloaded twice, byte-identically.**
  `inter/inter.{png,json}` from the app's publicDir and
  `packages/hud/src/fonts/inter.{png,json}?url` via `registerDefaultFont()` are
  the same files (matching md5s): **211,472 raw, 152,162 wasted transfer bytes,
  2 wasted requests, 1 wasted `createImageBitmap`**. `@weasel-js/hud` should
  accept an atlas URL or reuse an already-registered family rather than shipping
  its own copy.

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

- **(P2) `TEXT_PAINTER` has no pixel coverage.** Every text-bearing visual spec routes around the default text drawer (`NodeShape.ts:349`, registered at `:688`): `text`, `text-aa` and `text-decoration` go through `createTextLayer`, while `text-outlines` and `render-to-pixels` build `textCommand()` by hand. It shipped on unit tests alone. A baseline demo that paints a `data.text` node through the default drawer is the missing check.

- **(P3) No demo exercises non-modal path editing.** `enterPathEdit` / `editAnchors` only run under apps/draw's mode registry — `apps/site/demos/curveLab/RepresentationPanel.tsx:167` disables them and installs its own drag action. The `getActiveMode === undefined` fall-throughs (`SceneCanvas.tsx:1593`, `:1632`) are exercised by tests alone; a small site demo entering anchor editing with no mode registry would give both branches a live home.

- **(P2) Consolidate the paint demos into one "stroke and fill" demo.** `gradients`,
  `pattern-playground`, `vertex-colors` and `vertex-widths` are four cards each
  showing one corner of the same subject. The pieces a combined demo should be
  built on now exist — `PaintInput` edits a whole `FillStyle` and
  `SceneGradientHandles` puts the geometry on the artwork — so this is no
  longer blocked on the kit. Rethink the scope before splitting the work: it is
  a redesign, not a merge of four files.

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

- **(P2) `eqeqeq`** — 275 findings. Real correctness, but a large mechanical
  sweep with no bug attached to it yet.
- **(P2) `@typescript-eslint/no-unused-vars`** — 131 findings. Two
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

- **(P2) View-animation tests flake under a loaded parallel run.** Two full
  `npm test` runs on 2026-08-25 failed with *different* sets — first
  `apps/site/demos/__tests__/SceneScrollerDemo.test.tsx` (1 test, since fixed),
  then `packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx` (9 of its
  14). Each file passes on its own; only the 733-file parallel run trips them.

  The cause is real timers over a real animation. `animatedZoom` starts a 40ms
  rAF glide and then `await waitFor(() => expect(isViewAnimating()).toBe(false))`,
  which polls on `checkRealTimersCallback` with `waitFor`'s default 1s budget.
  Under full load rAF is starved, the glide has not settled inside that budget,
  and the assertion reports `expected true to be false` — a timeout wearing an
  equality message. The file took 10.4s in the failing run.

  The fix is to stop racing wall-clock: drive the glide with fake timers and a
  controllable rAF so completion is deterministic. Raising the `waitFor` timeout
  only widens the window the machine has to beat. `SceneScrollerDemo.test.tsx`
  is the worked example — note that jsdom builds `requestAnimationFrame` on
  `setInterval`, so faking intervals while still awaiting a real frame hangs.

  A third run, on an unrelated branch, hit the same 9 and then passed clean on
  re-run — so it is the harness, not any one change.

  `packages/core/src/core/stylus/usePointerStylus.test.tsx` ("throttles updates
  by maxFps") joined the set on 2026-08-26: it read the post-throttle pressure
  0.9 where it expects the throttle to have held 0.1, then passed alone in
  648ms. Same cause, and the same fix reaches it — the throttle is timed off
  `performance.now()` against real elapsed time.

- **(P2) `test:kit` covers `packages/core` only, and its name says otherwise.**
  The `kit` vitest project globs `packages/core` plus `apps/site`; `svg`,
  `font`, `geom`, `history`, `gestures`, `modes`, `ui` and `hud` all run under
  the `weasel-ui` project, and `labkit` under its own. Default `npm test` does
  reach every package, so this is a naming trap rather than a coverage hole —
  but two separate agents in the 2026-08-22 review pass read a green
  `test:kit` as "the kit passes", and one nearly wrote tests that would never
  have run. Rename the project, or add a check that every package directory is
  reachable by some project's include glob.

- **(P2) Benchmark HUD text against a transparent DOM overlay.** Two ways to
  put text over the canvas: `@weasel-js/hud` draws it as canvas commands, or a
  transparent `@weasel-js/ui` layer sits above the canvas and lets the browser
  lay it out. Nobody has measured which is cheaper, or where the crossover is —
  candidate axes are glyph count, update rate (a per-frame readout versus a
  static label), and whether the text moves with the camera. The answer decides
  what the kit recommends for HUDs, inspectors and labels, so it wants numbers
  rather than an argument.

- **(P2) Decide where benchmarks live and how their results are kept.** There
  are benchmarks in the tree (`tests/perf`, the draw-cost work in
  `docs/superpowers/specs/2026-08-14-batched-dispatch-design.md`) with no shared convention:
  no agreed home, no format for a recorded result, no way to say whether a
  number moved since last time, and nothing that says which ones are expected
  to run in CI. Settle the layout — one directory or per-package, what a run
  emits, where a baseline is stored and how it is compared — before the next
  benchmark adds a fourth shape.

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

  Text took the same ring on 2026-08-27 and went 6.65 -> 3.3 us, level with an
  image draw; a slot's buffer grows to the largest run it has seen, and one
  shared index buffer serves every slot because the quad pattern for N quads
  is a prefix of the pattern for any larger N. The remaining per-command costs
  above are otherwise unchanged.

  The rest of the plan — one program plus atlases — is in
  `docs/superpowers/specs/2026-08-14-batched-dispatch-design.md`, with the traps, and a
  two-phase dispatch split that would make it tractable.

- **(P3) Per-layer GPU dispatch skipping.** `RenderLayer.deps` (shipped
  2026-08-22, `packages/core/src/core/layers/render.ts`) skips rebuilding a
  layer's command tree, not submitting it — every layer is still dispatched
  to the renderer every frame regardless of caching. Skipping submission too
  would need render-to-texture per layer plus compositing, which the
  renderer has no concept of today. Nobody has measured whether dispatch
  alone costs enough to justify that. Measure before building.

- **(P3) A `{px}` stroke width thrashes the stroke mesh cache during a
  zoom.** `strokeMeshCache.ts` clears a path's entire config map once it
  exceeds `STROKE_CONFIGS_PER_PATH` (8) distinct configurations
  (`byConfig.clear()`, around line 70) — the degradation this section
  already documents for a dragged width slider. A `{ px }` width is resolved
  to a world-unit number against the accumulated transform scale before it
  reaches the cache key (`withResolvedStrokeWidth` in
  `packages/core/src/renderer/draw.ts`), so a continuous zoom gesture produces
  a distinct number on nearly every frame: every lookup misses, and every 8
  frames evicts that path's sibling configurations too. Quantizing the
  resolved width before it hits the cache key — `quantizeEmWidth` is the
  existing precedent, used for glyph outline widths in
  `outlineStrokeMeshCache.ts` — would likely fix it. Separately,
  `packages/svg/src/serialize.ts` has no accumulated scale available at
  serialize time, so it emits a `{ px }` width's raw number as `stroke-width`
  rather than resolving it.

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

- **(P3) `docs/audits/2026-05-05-exported-api.csv` has no regeneration script.**
  The two signatures that had drifted (`caretIndexAt` and `fitTextPose`, which
  dropped their `CanvasRenderingContext2D` on 2026-08-29) are corrected, but the
  file is a hand-maintained snapshot and will drift again. Decide whether it is
  meant to be re-runnable; if so the thing to build is the generator.

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
  - **Seventeen typedoc warnings, all barrel decisions.** Thirteen are a type
    referenced by an exported symbol but not itself exported —
    `NON_SHAPE_BUILTIN_TOOLS`, `SHAPE_KINDS`, `ShapeKindsWhere`,
    `KitInsertShape`, `ShaderProgram`, `ToolPrefBase`, `SelectionStore`,
    `Polyline`, `ReorderArgs`, `Scale2`, `WeaselProviderProps`,
    `PinchZoomTarget`, `StyleToggle`. Four are `{@link}`s to symbols in the
    same position (`DEFAULT_INK` twice, `SelectionHandlesLayerOpts.rotationHandle`,
    `useContributions`). Each one asks the same question — export it, or leave
    it internal and accept the warning — and answering them is an API pass, not
    a docs fix. The stale `intentionallyNotExported` entries and the dangling
    `TextStyle.stroke` link are gone. Note that typedoc does not warn about
    missing JSDoc, so its warning count was never a coverage measure.
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
