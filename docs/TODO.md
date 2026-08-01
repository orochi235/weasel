# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@weasel-js/core`). The
kit aims to be a generic 2D scene-graph foundation. Items here are evaluated
for cross-app reuse, not consumer-app value.

For history of completed work, see `git log` and the dated specs/plans under
`docs/superpowers/specs/` and `docs/superpowers/plans/`.

Priority tags:
- **(P1)** — foundational genericity gap; the kit can't do this today
- **(P2)** — broad reuse, friction-likely, or surfaced by a real consumer
- **(P3)** — specialized; defer until a real consumer asks

---

## High-priority index

### Next up

- **Loupe tool** → [Tools & gestures](#tools--gestures)
- **Fill-mode expansion: gradients + textures in the app** → [Rendering & paint](#rendering--paint)
- **Stroked text** (cheaper now that glyphs are paths) → [Text](#text)
- **Geometry-accurate picking — stroke width remainder** → [Tools & gestures](#tools--gestures)

### P1 — foundational genericity gaps

**Plugins & packaging**
- Resilient theming that "just works" across implementations → [Plugins & packaging](#plugins--packaging)

### P2 — broad reuse / friction-likely

**Viewport**
- Axis-aware elliptical hit shapes under non-uniform zoom → [Viewport](#viewport)

**Text**
- Cross-browser overlay alignment → [Text](#text)
- Un-setting a flag a text node sets → [Text](#text)
- Route Cmd+U / Cmd+Shift+X through the run algebra → [Text](#text)

**Scene, adapters & layout**
- `arrayAdapter` as default Canvas adapter — full unification → [Scene, adapters & layout](#scene-adapters--layout)
- Group resize with rotated children → [Scene, adapters & layout](#scene-adapters--layout)
- SceneCanvas → useSceneAdapter for adapter construction → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: drop rejection signal → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: multi-select drag into a layout container → [Scene, adapters & layout](#scene-adapters--layout)

**Selection, actions & UI panels**
- Op coalescing in `useScene` — done 2026-07-25; serialization follow-up shipped 2026-07-25 → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Clipboard: OS clipboard / cross-reload serialization — done 2026-07-25 → [Selection, actions & UI panels](#selection-actions--ui-panels)

**Plugins & packaging**
- Plugin/bundling convention v1 (`WeaselPlugin` shape) → [Plugins & packaging](#plugins--packaging)
- Barrel-hygiene: selection (pending design review) → [Plugins & packaging](#plugins--packaging)

**Documentation**
- README pitch sweep → [Documentation](#documentation)

---

## Tools & gestures

<!-- The four items below came out of a read-only review of the arbitration
     layer against CSS cascade / Flutter's gesture arena / Blender keymaps /
     tldraw's StateNode chart. Reasoning that did not compress into these
     entries — including why specificity-ordered fall-through is survivable at
     all — is in docs/handoffs/2026-07-28-arbitration-followups.md. Reviewed
     2026-07-28, re-verified against main 2026-07-31. -->

- **(P2) ~~`findConflicts` is written, tested, and never called.~~ Done
  2026-08-01.** `useTools` runs `reportRouteConflicts` at registry assembly
  under a `NODE_ENV !== 'production'` guard and warns each conflict through
  `formatRoute`. Runtime warns, never throws; kit-vs-kit conflicts fail in
  `canvas/SceneCanvas.routeConflicts.test.tsx` instead, over all three tool
  bundles.

  Wiring it up found the raw detector over-reports twice over, both fixed:
  `{ kindOf }` predicate targets all render as one grammar token (so select's
  resize / rotate / move drags looked like a three-way collision) and now
  bucket by function identity; and `matchSorted` resolves *cross-scope* ties by
  scope priority, so only same-scope overlaps are reachable —
  `findScopedConflicts` reports a tool colliding with itself, two ambient
  tools, or two hotkey-capable tools, and stays quiet about two registry tools
  that can never hold the active slot at once.

  Not covered: the actions registry's `defaultBinding`s, which the dispatcher
  also folds into ambient/hotkey scope but which are assembled in
  `ActionsRegistry`, not `useTools`. Catching tool-vs-action collisions needs
  a second input `findScopedConflicts` doesn't have yet.

- **(P3) The `phase` dimension of the specificity tuple is binary.**
  `specificity()` scores dimension `[2]` as `phase !== undefined ? 1 : 0`, so
  `{ channel: '*', phase: 'initial' }` — which narrows almost nothing, and is
  what the kit's own ambient actions use (`escape`, `delete`, `anchorEditing`,
  `cancelGesture`) — ties with a precise `&:engaged`. This is CSS's `:where()`
  problem in miniature. Grade it the way `targetRank` already grades targets:
  2 for a named channel or `&` with a concrete phase, 1 for one wildcard axis,
  **0 for `*:*`** (which is exactly equivalent to declaring no phase, and
  scoring it 1 is the bug in its purest form). Pre-emptive, not a live bug —
  dimension `[0]` dominates and phase-bearing specs are rare. Any change owes
  the same compat argument `targetRank`'s doc comment makes: enumerate the
  existing phase-bearing specs and show the ordering is unchanged.

- **(P2) ~~`gestureIdFor` collapses every pointer onto one channel.~~ Done
  2026-08-01.** Pointer `InputEvent` variants carry `pointerId` (via
  `PointerIdentity` in `@weasel-js/gestures`) and `gestureIdFor` interpolates
  it through the exported `pointerGestureId`. Events without one — synthetic
  probes, programmatic drags, most tests — still key to `pointer-mouse`.

  Intent decided: **explicit multitouch ownership, with honest ids.** When a
  second pointer lands, the multitouch channel claims every pointer that hasn't
  already committed to a gesture (by dropping its buffered press), which
  suppresses both drags and taps from those pointers; a drag already in flight
  survives, so resting a palm mid-drag doesn't cancel it. That behavior used to
  hold only by accident, because every pointer aliased to one slot.

  All three checks from the original entry: the one hardcoded literal
  (`inFlight().has('pointer-mouse')` in `onPointerUp`) now goes through
  `pointerGestureId`; the two-finger case is covered by the claim above and
  pinned in `useGestureDispatcher.test.tsx`; `getActiveAction()`'s
  most-recently-started rule still holds, and its doc now says when it's
  actually load-bearing.

- **(P3) A second finger still fires `pointerDown`-spec bindings.** Found while
  doing the above. `onPointerDown` dispatches the eager `stage: 'press'` copy
  before the multitouch claim runs, so starting a pinch runs `select.pick` for
  the second finger and can change the selection under the gesture. Pre-existing
  — the press dispatch was always unconditional — and out of scope for the
  gestureId fix, but it's the same family of bug: a pointer that is part of a
  pinch shouldn't be acting on its own. Fix is probably to defer the press
  dispatch by a frame, or to re-dispatch a cancel for claimed pointers.

- **(P3) Sibling z-order is unresolved in hit-picking.** `pickTopMostHit.ts`
  collapses parent/child (the valuable half, and done) then falls back to "last
  in the array wins" — a convention the adapter contract doesn't enforce, as
  its own doc admits by telling z-sorted callers to pre-resolve. Give the
  adapter an optional `getZIndex(id)` / `compareZ(a, b)`, same shape as the
  existing optional `getParent`, so it composes with the collapse rather than
  replacing it. Worth doing for the principle as much as the correctness:
  **score the target, order the rules** — z-order, distance to pointer and
  target size are *physical* weights, unlike the hand-assigned ones in
  `specificity()`, and anything the hit-test can decide shouldn't be pushed
  into binding precedence.

- **Loupe tool.** A magnifier that follows the pointer and paints a
  zoomed inset of the scene under it — for placing anchors, checking seams,
  and picking colors at pixel accuracy without disturbing the view. Open
  questions: whether it re-renders the scene at a higher zoom into an offscreen
  target or samples the existing backing store (sampling is cheap but blurs on
  a HiDPI display); whether it's a tool that takes over the pointer, an
  always-available modifier-held overlay, or a HUD widget; and whether it
  belongs in `@weasel-js/hud` (it's chrome, not scene content) or ships as a
  built-in tool. Requested 2026-07-31.

- **Geometry-accurate picking — mostly landed 2026-07-31; stroke width is
  the remainder.** A click inside a shape's *hole* — the counter of a donut,
  the gap between the arms of a compound path, the empty middle of a U — used
  to pick the shape, because picking resolved against the pose box rather than
  the filled region.

  Shipped: `shapeCoversPoint` (`canvas/NodeShape.ts`) refines a pose-rect hit
  with the painter's `findShapeSilhouette` + `pathContainsPoint`, which is
  already fill-rule-correct. Opt in with `<SceneCanvas geometry={{ picking:
  'shape' }}>`, or `useSelectTool({ leafPicking: 'silhouette' })` off the
  SceneCanvas path; `apps/draw` opts in. Off by default because it changes
  what a click selects. Painters with no silhouette keep the AABB answer, so
  it can only tighten a pick. `kit:text` gained a silhouette (union of its
  line boxes) as part of the same change.

  Stroke width: **done 2026-08-01.** `NodeShapeEntry.ink` declares how a
  painter inks its silhouette (`{ filled, strokeWidth }`, cheap field reads —
  deliberately not read back off `paint`, which may lay out glyphs and runs on
  every pointer move). `shapeCoversPoint` fills only when the painter fills,
  and ORs in `strokeHitTest` at `strokeWidth / 2 + tolerance`. So an outlined
  rect is grabbed by its outline and *not* through its empty middle, and a
  bare line — zero area, previously unpickable by any fill test — is grabbed
  along its length. `tolerance` comes from `geometry.pickTolerancePx`
  (screen px, default 4, converted against the live view), because a 1px
  hairline is a half-world-unit target that no pointing device can hit. The
  pose-rect pre-filter grows by the same tolerance, or it would reject outline
  hits before the refinement ever ran.

  The other half of this entry was stale: the **hand tool does no picking** —
  it pans, and never resolves a node. The real second pick path was
  `useSelectTool`'s own default `pickEvery` (what non-`SceneCanvas` consumers
  get), which had its own copy of the coverage test; it now takes the same
  `shapeCoversPoint` refinement and a world-unit `pickTolerance`. Both scene
  pick paths agree.

  Still open: **`picking: 'shape'` is opt-in.** The default is still the pose
  rect, which is the wrong answer for anything non-rectangular. Flipping it
  changes what a click selects for every consumer, so it wants a deliberate
  call rather than riding along with the machinery. Requested 2026-07-31.

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
  element) if crispness matters; (b) **gradient paints flatten** to a solid
  fallback in unpack (the `kit:path` painter data contract has no gradient
  slot); (c) **text `fontSize` doesn't participate** in the unpack
  fit-clamp scale; (d) weaseldraw's file-menu import still uses its own
  app-local `svgInterop` mapping (richer: `wd:` tool metadata, paper size)
  — fold the shared walk if they drift. Cross-ref: embedded-image residual
  (a) below (`<image>` elements dropped on parse) bites only the unpack
  path — the single-node embed keeps them.

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
  spawned this — it's a marginal convenience with no consumer asking);
  (d) route-grammar names for drop/paste (registry probe shows them
  as `undefined`); (e) paste could mirror wheel's dispatch-then-preventDefault
  instead of preventDefaulting on content.

- **(P3) Reshape `selectionOverlay` into a thin override hook.** The chrome-affordances spec shipped (2026-06-13): the multi-resize union now has a single owner — `ChromeState.unionBounds` — which both the affordance hit-tester (`affordanceAt` / `composeAffordanceLayer`) and the overlay layer read at draw time. The inline `poseById` re-derivations in `Canvas`/`SceneCanvas` are deleted, `createSelectionOverlayLayer` resolves the synthetic union from the draw-time chromeState envelope, and `MULTI_RESIZE_TARGET_ID` moved to `core/selection/` (fixing the backwards `affordances→tools` import). Residual: the synthetic-id plumbing (`getSelection` → `[MULTI_RESIZE_TARGET_ID]`, `getOutlineIds` → real members) still lives in the Canvas/SceneCanvas wiring rather than inside `createSelectionOverlayLayer`. Fold it into the layer so the slot is purely a consumer override hook.

- **(P3) ~~Consolidate the two affordance hit-test mechanisms.~~ Done
  2026-08-01.** Picked the declarative one. `hitAffordanceRegions` is now the
  single walk; `composeAffordanceLayer.hitTest` and `buildAffordanceAt` both
  delegate to it, so an `Affordance`'s `regions()` is the one source of truth
  for where kit chrome is and what a press on it means. `affordanceAt.ts` lost
  its corner table, its rotate-ring ellipse and its anchor walk (~200 lines) and
  is now assembly plus a region-hit → `AffordanceHit` mapping. Anchors and
  control handles became real affordances (`affordances/pathAnchors.ts`);
  `cornerResize.ts` stopped being dead code.

  The premise in the original entry was half stale and worth recording: the
  `composeAffordanceLayer.hitTest` side was **not** a live competing mechanism.
  `tools.getActiveOverlays()` feeds Canvas's *draw* stack only — the sole caller
  of `RenderLayer.hitTest` is `hitTestExtras`, which walks layers a consumer
  attached via `registerLayer` (that's the HUD path, hand-rolled, still live and
  still legitimate). So the rotate tool's overlay `hitTest` was unreachable and
  is deleted, and `RenderLayer.hitTest`'s doc no longer claims every layer is
  consulted.

  `AffordanceRegion.cursor` is folded in, as the entry asked: hits carry the
  region's declared cursor, so `RotationHandleOptions.cursor` finally does
  something. Three picking bugs fell out of having one implementation:
  corner handles hit-tested as a circle (dead corners on a square handle) now
  hit as a square; overlapping regions resolved by declaration order (all four
  corners of a small selection answered "top-left") now resolve nearest-first;
  and the rotate band's `bandPx` floor was applied in world units, so it thinned
  on screen as you zoomed — it's now `minBandPx`, resolved against the live view
  for both paint and hit.

  Left standing: the ambient rotate-tool mount, now near-vestigial (no bindings,
  and its overlay paints nothing unless a consumer opts into a visible ring).
  Removing it means removing `'rotate'` from `BuiltinToolId` / `BUNDLE_TOOLS`
  and unexporting `useRotateTool` — a public-API change, so it wants its own
  decision rather than riding along here.

- **(P3) Embedded image support — follow-ups.** Shipped 2026-06-27: serializable `data.image.src` contract (URL / blob: / `data:` URI), kit-owned `imageCache` (`packages/core/src/features/images/`, sync read + lazy de-duped async load + `subscribeImageReady`→`requestRedraw`), the `kit:image` shape painter (`NodeShape.ts`, emits `ImageDrawCommand`, faint placeholder while loading), and the `useImageTool` drag-insert tool (`packages/core/src/tools/builtin/image/`, routes through `useInsertDepSource`'s `'image'` case). Demo: `apps/site/demos/ImageDemo.tsx`. Remaining: (a) **SVG `<image>` interop** — `packages/svg` parse/emit of `<image>` (href + embedded base64) is still unsupported (`<image>` elements are dropped on import); (b) **live drag-preview for image inserts** — `insertAction`'s ghost only previews `KIT_INSERT_KINDS` (rect/ellipse/line/polygon/star/pencil), so an image commits on release with no preview; extend that set to include `image`.

- **(P3) Other drag-insert tools.** Deferred from `docs/specs/2026-05-05-drag-insert-primitive-design.md`. The consolidated `useDragRect` + `useInsert` + `defineDragInsertTool` stack makes a new drag-insert tool a thin Tool veneer. Polygon, star, ellipse, line, and image tools have landed (`packages/core/src/tools/builtin/{polygon,star,ellipse,line,image}/`); each further type is its own task.

- **(P3) Promote `hitExistingGate` to gate select-tool's move/resize paths.** Deferred from `docs/specs/2026-05-05-drag-insert-primitive-design.md`. Different responsibility (gating mutation gestures rather than insertion), different gesture surface — punt until a real consumer wants it.

- **(P3) Evaluate `useResize`/`useRotate` against `useDragGesture`.** Deferred from `docs/specs/2026-05-05-drag-gesture-base-design.md`. After the dragRect/move migration landed, evaluate whether resize and rotate fit cleanly on the new base. Their state shapes (per-id pose map keyed by handle/center, multi-target union AABB) are different from move's flat pose map and may not benefit. Revisit only if/when their scaffolding diverges from the base in a way that costs maintenance.

### Pen tool follow-ups

From `docs/specs/2026-05-03-pen-tool-design.md`:

- **(P3) Snap-to-existing-anchors** (cross-path anchor snapping). Clicking near an existing path's anchor would coalesce. Useful for stitching paths. (Only a generic grid `snapPoint` exists today, not anchor magnetism.)
- **(P3) Continue an existing path's open endpoint.** Click an existing open path's first/last anchor to pick it up and append. No extend-from-endpoint path exists today.

> Shipped since this list was written (verified 2026-06-19): mid-creation editing of placed anchors (`penEdit/actions.ts` dragAnchor/addAnchorOnSegment/deleteAnchors), click/dblclick/shift-click-to-edit during creation (`usePenTool.ts`), and compound-path subpaths with open/closed mixing (`finishedSubpaths`/`PenSubpath`, `scissorsAtAnchor`).

### Tool overlay channel deferrals

From `docs/specs/2026-05-03-tool-overlay-channel-design.md`:

- **(P3) Per-overlay z-positioning.** v1 always renders tool overlays on top. Add `overlayPosition?: 'top' | 'before-selection' | 'after-selection'` field to the Tool record when a real consumer wants overlay chrome below selection handles (e.g. a snap-target highlight that should sit behind handles).
- **(P3) Multiple overlays per Tool.** Today `Tool.overlay` is a single `RenderLayer`. If composing multiple visually distinct layers into one `draw` becomes painful, promote to `overlay?: RenderLayer | RenderLayer[]`.
- **(P3) Subscription / push model.** Today the channel is pull (Canvas asks each frame, scratch is read via React closure). If a tool needs to push state changes outside the React render cycle, add an imperative `tools.publishOverlay(toolId, layer)` channel.

### Slice tool follow-ups

From `docs/superpowers/specs/2026-06-17-slice-tool-design.md` (shipped 2026-06-17):

- **(P3) Bézier-preserving + concave finite-cut (Approach B).** v1 flattens béziers on cut pieces and an infinite-line half-plane clip can over-cut concave shapes the finite stroke only partly crosses (pinned in `splitByLine.test.ts`). `splitPathByLine` is the single swap point for a chord-split Approach B + `schneiderFit` curve re-fitting.

---

## Viewport

- **(P2) Axis-aware elliptical hit shapes under non-uniform zoom.** Surfaced 2026-05-16 by the per-axis zoom landing. ~50 chrome hit-test sites today use `pxRadius / meanScale(view.scale)` (geometric-mean fallback). At non-uniform zoom this projects a circular screen-pixel hit region to an ellipse in world space — visually accurate handles but the pickable region is slightly too large along one axis and slightly too small along the other. Fix: refactor `composeAffordanceLayer` and the per-tool ad-hoc hit-tests (`penEdit/hitOverride`, `usePenTool` close-hit, `useSelectTool` multi-resize, snap-guide trigger zones) to either compare against an ellipse `(dx/rx)² + (dy/ry)² < 1` or transform the hit-test into screen space. Grid hairline strokes (`1 / meanScale(view.scale)`) have no obvious axis-aware analog — separate judgment call. Worth ~1 day; deferred from per-axis-zoom v1 spec to keep the migration atomic.

- **(P3) Typed discriminated union for multi-type insert.** Deferred from `docs/specs/2026-05-07-viewport-followups-design.md`. Current shape splits into `posefromBounds(bounds) → TPose` + `pointInsert(point) → TNode` (`packages/core/src/interactions/actions/insert/options.ts`); multi-type canvases (rect vs image vs ellipse from one `<SceneCanvas>`) wire their own `tools` array (one `useInsertTool` per type) rather than folding a variant switch into the insert options. Revisit if a real consumer wants the single-canvas multi-type ergonomic.

---

## Paths & booleans

- **(P3) `<style>`-element and class-selector support for `@weasel-js/svg`.** The presentation-attribute cascade now threads a resolved `StyleContext` through the recursive parse (`packages/svg/src/cascade.ts`, shipped 2026-07-25; spec `docs/superpowers/specs/2026-07-25-svg-cascade-context-design.md`, plan `docs/superpowers/plans/2026-07-25-svg-cascade-context.md`). Inheritance, the `inherit` keyword, `style=""`, text/`<tspan>` cascade, and `currentColor` all resolve without per-attribute DOM walks (`readInheritedAttr` deleted). Still unsupported: `<style>` elements and class/selector matching — the cascade handles inheritance, not selector specificity. `style=""` remains a regex scan, not a full CSS parser (`!important` unsupported). Add when a real consumer imports an SVG that styles via `<style>`/classes; the threaded-context fast path could compute the per-element cascade from `getComputedStyle` against a hidden DOM node in the browser.

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

- **Fill-mode expansion in WeaselDraw — gradients and textures.** The engine
  already has the paint model: `FillStyle` (`packages/core/src/core/paint-types.ts`)
  is a tagged union covering solid, pattern, and linear / radial / conic
  gradients, with `GradientRampCache` + `gradFill.ts` behind them and
  `createTilePattern` / the `patterns-builtin` catalog producing texture
  handles. What's missing is entirely app-side: WeaselDraw's data shape carries
  `fill` as a color string, its swatches set colors, and nothing can express a
  paint that isn't solid. Needs, roughly in order: widen `WeaselDrawData.fill`
  to a `FillStyle` (with a string treated as solid for back-compat, since
  persisted docs carry strings); a fill-kind switch in the Properties panel; a
  gradient editor (stop list + angle/center handles — `paintGradientTrack` and
  `CurveEditor` in weasel-ui are the starting pieces); on-canvas gradient
  handles; and a texture picker over the builtin patterns before any
  image-upload story. SVG export needs matching `<linearGradient>` /
  `<pattern>` emission. Requested 2026-07-31.

  Note on **text**: non-solid fills on text used to be a shader problem — the
  MSDF program takes a single colour uniform. Since the outline tier landed
  (2026-07-31) it is not: above the size threshold a glyph is a `PolygonPath`
  drawn through `drawPathFillByKind`, so gradient- and pattern-filled text
  already renders with nothing further to build. Below the threshold it still
  falls back to solid. So this item is app-side for text too — widen the data
  shape and the UI, and large text simply works.

- **(P3) Layer effects framework.** Distinct from `FillStyle` — effects modify pixels rather than choosing color. Under WebGL each effect is its own pass: drop-shadow needs a blurred render-to-texture beneath, blur needs a separable kernel, blend modes need framebuffer compositing, clipping needs stencil. Likely shape: `type Effect = { kind: 'shadow' | 'blur' | 'composite' | 'clip' | 'transform'; ... }` consumed by the renderer (not the layer) so each effect knows how to set up its own GL state. Open question on composition model: per-layer `effects?: Effect[]` option vs a wrapper layer (`withEffects(layer, effects)`). Defer until a real use case lands.

- **(P3) Promote `ShaderDrawCommand` past `@experimental`.** Three real consumers now exist (plasma / ripple / voronoi panels), enough to validate the surface. Open questions before stabilization: (a) array uniform binding shape — currently consumers must pass per-slot keys (`u_ripples[0]`, `u_ripples[1]`, …); should the kit accept a flat `Float32Array` and split it? (b) hot-reload story for `registerProgram` re-registration; (c) how to expose the renderer's program registry without leaking internals (`shaders` prop is the seam, but consumers writing custom RenderLayers may want more).

- **(P3) `extractUniformNames` regex coverage.** Currently handles scalar uniforms and `T name[N];` arrays. Doesn't handle: matrix arrays (`mat3 u_xforms[4];`), GLSL preprocessor branches, nested struct uniforms, or layout qualifiers on the LHS. Bite-the-bullet rewrite probably wants a small GLSL-prelude parser. Defer until a consumer hits a gap.

---

## Text

- **(RESOLVED 2026-07-31) Outline text tier — glyph contours no longer wobble
  under magnification.** Above `OUTLINE_MIN_SCREEN_PX` (48 on-screen px) a
  registered face renders as tessellated glyph geometry rather than a sampled
  distance field. `registerFontOutlines(family, variant, source)` supplies the
  bytes (a URL, a buffer, or a thunk); `enableLocalFontOutlines()` indexes
  installed fonts through `queryLocalFonts` for machine families, behind a
  permission and a user gesture. WeaselDraw ships a 27 kB subset Inter beside
  the atlas so the default face is covered, and exposes the machine-font half
  as Preferences → Text → "Sharp text from installed fonts".

  The tier is **metric-neutral by construction**: advances, kerning, wrapping
  and baselines still come from whichever SDF tier resolved the run, so
  crossing the threshold changes what a glyph looks like and never where it
  sits — which is what lets the threshold depend on zoom without text
  reflowing. Tessellation is cached per `(face, codepoint)` in em space and
  transformed per instance into one shared buffer, so a group is still one
  draw call, and it goes through `drawPathFillByKind`, so gradient- and
  pattern-filled text came along for free.

  Known limits, all deliberate: synthetic **bold** declines the tier and stays
  on the SDF (emboldening geometry means offsetting the outline, the same
  unsolved problem as stroke-to-fill); synthetic italic does not, because a
  shear is exact. Small text stays on the atlas on purpose — outlines carry no
  hinting or stem darkening, so 12–16px from outlines looks *worse* than a
  platform rasterizer (see `glyphRasterizer.ts`'s measurements). And `.dfont`
  (Datafork TrueType) machine faces are not parsed — they degrade to the SDF
  tier, which is the right failure but a silent one. Unreachable on current
  macOS (204 `.ttf` / 128 `.ttc` / 38 `.otf`, no `.dfont`), so it is recorded
  rather than fixed; `sfnt.ts`'s header says where it would go.

  Settled, so it does not get relitigated: the `.ttc` unpacking stays in
  `packages/font/src/outline/sfnt.ts` rather than becoming an opentype.js PR
  or a switch to fontkit. The upstream fix is ~10 lines but that library was
  dormant 2021–2026, so we would carry this file until a release anyway;
  fontkit handles collections natively but is ~5.6 MB across nine
  dependencies, which is a shaping engine to buy a glyph outline. Ours runs
  before any parse, so it also survives swapping the parser.

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

- **Stroked text.** WeaselDraw exposes stroke color + width on text nodes and
  neither renders — the control lies. **The outline tier (shipped 2026-07-31)
  changed which fix is right.** The old plan was an SDF shader trick: threshold
  a second time at `0.5 - outlineWidth` and composite, cheap but bounded by the
  atlas's distance range, with rounded corners past it and no real joins or
  caps. Above `OUTLINE_MIN_SCREEN_PX` a glyph is now an ordinary `PolygonPath`,
  so `tessellateStroke` gives real joins, caps, miters and any paint, at any
  width — which is the answer for exactly the sizes anyone strokes text at.
  Shape of the work: carry `stroke` on `LaidOutGroup` (it is already per-run
  state), stroke the group's merged mesh in `drawTextOutlineGroup`, and decide
  what small text does — either the SDF second-threshold as a lower tier, or
  nothing until the text is big enough to qualify, which is defensible since a
  1px outline on 12px text is not a design anyone asked for. Requested
  2026-07-31.

- **(P2) Cross-browser overlay alignment.** `placeOverlay` uses an empirical `(+1, -1)` CSS-px nudge to compensate for canvas/CSS rasterization disagreement. Works on the dev setup; not universally correct across browsers/fonts/DPRs. A self-correcting probe was attempted and rejected.

- **(P2) Un-setting a flag a text node sets.** Run-level flags are additive:
  a run turns `bold` / `italic` / `underline` / `strikethrough` on, never off
  (setting `false` deletes the key, and resolution is `run.flag ||
  style.flag`). So "select a word inside an underlined node and turn
  underline off" is unrepresentable, and the character bar's toggle visibly
  refuses. Two ways out, both model changes: go tri-state (`true` / `false` /
  inherit) across `valueAt` / `patchRun` / the resolvers and the SVG mapping,
  or normalize on write — clear the node flag and add it to every run outside
  the range, which preserves the rendered result and makes the edit
  expressible without widening the model. Decide before the flags are relied
  on by a persisted document format.

- **(P2) Route Cmd+U / Cmd+Shift+X through the run algebra.** `useTextEdit`'s
  `StyleFlag` is `'bold' | 'italic'`, so the decoration shortcuts are never
  intercepted and the browser's native `formatUnderline` runs instead.
  `domToRuns`' `<u>` flattening then makes it *look* like it worked while
  bypassing `toggleFlagInRange` entirely — no toggle-off, no mixed-range
  rule, no pending style for a collapsed caret. `rangeStyle.ts` already lists
  both flags; the flattening should stay regardless (it is what makes pasted
  decoration survive) but it is defense in depth, not the fix.

- **(P3) Per-character tracking in the DOM overlay is CSS-approximate.**
  `letterSpacing` is applied per code point rather than per grapheme cluster,
  matching CSS rather than the GL path's cluster walk. Visible only on text
  with combining marks or emoji sequences.

- **(RESOLVED 2026-07-29) The dynamic tier's bake size is right where it is.**
  Recorded because the 48px single-channel bake looks like something to
  improve and isn't. Measured against a direct `fillText` at each display
  size, registration searched out: coverage error bottoms out *at* the bake
  size (.024) and rises both ways — .049 at 128px, .096 at 12px. So raising
  `BAKE_SIZE` moves the sweet spot away from the 12–32px range UI text lives
  in. The 12–16px end is also not undersampling: 3×3 supersampling halves the
  error at 24–48px and recovers almost nothing at 12–16px, because what
  remains is a hinted rasterizer putting stems on the pixel grid, which no
  size-independent field encodes. Numbers live in `glyphRasterizer.ts`.
  Mipmaps stay out regardless — mip levels blend across packed glyph rects.

- **(P3) Decoration thickness is derived, not read from font metrics.** The
  underline / strikethrough offsets and weight are the fixed `0.10` / `-0.30`
  / `0.05` em constants in `layoutRuns`. Real fonts ship
  `underlinePosition` / `underlineThickness`; the BmFont atlas format does
  not carry them, so honoring them means extending the atlas metrics.

- **(P3) The visual suite can't pin decoration geometry.** `text.spec.ts`
  runs at a 5% diff tolerance (MSDF AA differs from Canvas 2D AA), and the
  whole decorated `t6` node is well under 5% of a 600×360 canvas — it was
  added and the spec passed against the *old* baseline without noticing. So
  the committed baseline documents the current rendering but would not catch
  a rule drifting a pixel or two. Pinning it wants a structural assertion in
  the `render-to-pixels.spec.ts` style (a decoration rule is a gap-free
  horizontal run; glyph rows never are) rather than a tighter tolerance,
  which the AA difference won't survive.

  The same blind spot let a real defect through: the text shaders' AA band was
  a constant, so glyph edges were hard-quantized at 16px, and `text.spec.ts`
  passed anyway. Fixed 2026-07-29. `tests/visual/text-aa.spec.ts` is now the
  worked example of the structural assertion this entry asks for — it samples
  one known-color node and asserts a coverage-histogram property, no golden
  image — so pinning the decoration rules is a matter of copying its shape.

- **(P3) `ToolOptionsBar` is not driven by tool prefs.** Its first tenant
  (draw's `CharacterOptions`) is hand-assembled. A tool declaring a
  `ToolPrefGroup` for its options and having the bar render it the way
  `SelectionPanel` renders node properties is the obvious next step, and is
  also where the roving-tabindex contract below would plug in.

- **(P3) One `useRovingTabIndex` for the three bars.** `ActionsBar`,
  `ActionBar`, and `OptionsBar` each reimplement `firstEnabledIndex` /
  `nextEnabledIndex` / `prevEnabledIndex` verbatim — three near-identical
  copies. `ToolOptionsBar` deliberately has none (its children are arbitrary
  compound controls that use arrow keys for their own values), so the shared
  hook is also where that contract would get designed once.

- **(P3) Complex-script text shaping (HarfBuzz).** `packages/core/src/features/text/atlas/layoutRuns.ts` walks codepoints linearly and applies BmFont kerning pairs — sufficient for Latin / Cyrillic / Greek / CJK ideographs, wrong for Arabic / Devanagari / Thai / any script needing contextual shaping or reordering. Real fix is wiring a HarfBuzz WASM build (harfbuzzjs ~1MB) behind a feature flag so consumers who only need Latin can stay slim. Touches the layout pipeline only; the renderer already takes pre-laid glyphs. Defer until a real consumer hits a non-Latin language requirement.

- **(P3) eric `labelHelpers.ts` deletion check.** Investigate whether eric (`~/src/eric`) can delete its local `labelHelpers.ts` after the text world-unit pass landed. If consumer-side world-unit helpers still cover gaps the primitives don't (e.g. world↔screen pad conversion at the call site), capture the remaining gap as a follow-up primitive proposal.

- **(P3) `markdownToRuns` → AST.** Consider whether markdown markup (today `*`/`**`/`***` bold/italic toggles, parsed with flat boolean state in `packages/core/src/features/text/runs.ts:64`) should be promoted to a structured AST. The output is a flat `StyledRun[]`, not a tree. Defer to a future "rich text" pass — the current shape is sufficient for label/markdown rendering but limits reformatting / re-styling transforms.

---

## Scene, adapters & layout

- **(P2) `arrayAdapter` as the default Canvas adapter — full unification.** Partial work shipped: Canvas synthesizes an adapter from `items`/`setItems`/`toPose`/`fromPose`/`createDefault`/`poseBounds`/`intersectsRect` when no explicit `adapter` is passed. It collapses the flat-list boilerplate but is array-shape specific. The deeper move — every scene is a tree rooted at one container — was taken by `useScene` (kit-owned tree with leaf/container) but the inline-props and explicit-adapter tiers still sit alongside rather than collapsed. Full unification (one adapter contract, one default wiring) remains an option for later.

- **(P2) Group resize with rotated children.** Today: AABB-frame fallback (`expandIds` + `RECT_POSE_DESCRIPTOR.remapBounds` axis-aligned scale; no per-leaf local-frame handling). Needs proper per-leaf scale handling in the leaf's local frame, mirroring the existing single-rotated-leaf math.

- **(P3) SceneCanvas → useSceneAdapter for adapter construction.** Surfaced 2026-05-21 during the node-kind registry landing. Today `SceneCanvas` constructs its synthesized adapter inside `useSceneSelectTool` (the select-tool hook), which means every new `SceneToAdapterOptions` field (`layouts`, `cascadeContainerPose`, `kindOf`, …) has to be drilled through the hook's surface. `useSceneAdapter` already exposes the full options shape; lifting adapter construction to `SceneCanvas` and handing the result down would stop the drill-through and shrink `useSceneSelectTool`'s API. Out of scope for the registry work; file when next refactoring the SceneCanvas internals.

### `useScene` follow-ups

- **(P3) Container layout strategies in `useScene`** (today: absolute-positioning only).
- **(P3) Selection-in-Scene vs external.**
- **(P3) Full tier unification** (collapse inline-props/explicit-adapter onto Scene). Same effort as the P2 "`arrayAdapter` as the default Canvas adapter — full unification" above — track there.
- **(P3) Container-pose cascade as a scene-primitive semantic.** Today opt-in via `sceneToAdapter({ cascadeContainerPose: 'rect' })` shipped 2026-05-11 to absorb NestingDemo boilerplate — the deeper move is letting `scene.setPose` on a container cascade natively, which would require a `translatePose` plumbing decision on the `useScene` constructor.

### Container layout strategies (deferred from `docs/specs/2026-05-03-container-layout-strategies-design.md`)

> **Status note (2026-06-15): layout reflow is reconnected to the live action path.** `moveAction` consults the `layout` dep during single-node drags (`runLayoutPass`), folds destination + source reflow poses into the preview-ghost channel, and on commit emits the strategy's `commitDrop` ops + a cross-container reparent + source-reflow ops. The `LayoutStrategy` methods were renamed `childPoses` / `reflowPoses`, and the orphaned `MoveOverlay` type was deleted. See `docs/superpowers/specs/2026-06-15-revive-container-layout-reflow-design.md`. The bullets below are the genuinely-deferred remainder.
>
> One follow-up remains from the revival:
> - **Reparent-on-layout-drop lives in `moveAction`, not the strategies' `commitDrop`** (which are pose-only). If a strategy ever needs container-specific reparent semantics, revisit whether `commitDrop` should own it.

- **(P2) Drop rejection signal.** v1 layout commits a free-space `setPose` when no container accepted a drag. Needs a cleaner semantic — candidates: a dedicated cancel op, a snap-back-to-source-pose path, or having the source layout's `commitDrop` re-place the child at its origin slot.
- **(P2) Multi-select drag into a layout container.** Currently falls through to the per-id transform batch (no `commitDrop` invocation, no sibling reflow). Layout-aware reflow + commit only fire when `scratch.ids.length === 1` in `moveAction`. Decide multi-select-into-layout semantics (sequential commitDrops? grouped layout API?) before lifting the guard.
- **(P3) Full-opacity live reflow.** Reflowing siblings currently render at the preview-ghost layer's blanket `0.85` alpha (same as dragged ghosts), so mid-drag they look semi-transparent at their destination slots. A polished sortable-list feel wants them fully opaque; needs the ghost layer to treat reflow ids differently from dragged ids.
- **(P3) Z-order walk doesn't cross non-container ancestors.** Open question: when a deep layout container is BELOW (in z) a shallow layout container that shares the dragged point, today the deepest wins — debate whether real z-order across the whole tree (flat painter's order) should win instead. Decide once a consumer hits the case.
- **(P3) Tile-grid overflow policy.** Children beyond `cols * rows` are skipped from `childPoses`. Real apps may want scroll, grow-grid, or rejection — pick once a consumer asks.
- **(P3) Strategy-aware drop regions.** A layout could expose `dropRegion(container) → Bounds` extending beyond visible bounds for forgiveness (e.g. row layouts catching pointers slightly past the row's end).
- **(P3) Stateful layout strategy factories.** All v1 strategies are pure. If profiling shows recompute pain (likely only quadtree-class), promote to a factory returning `(container) → { ... }` with cached state.
- **(P3) Animated reflow transitions.** Sibling reflow is snap-to-target in v1. Smooth interpolation likely needs a `useAnimatedReflow` hook over the animation primitive.
- **(P3) Quadtree / packing layouts.** Niche enough not to belong in the generic kit; stays in eric or a future plugin.
- **(P3) Slot-based layout strategy** (rows / grid / ring arrangements à la eric's `@/model/arrangement`). Worth lifting once the v1 three settle.
- **(P3) Configurable layout hit-test order.** v1 uses top-most container under the dragged center. Innermost-regardless-of-z and explicit-drop-region modes are escape hatches if a real consumer needs them.
- **(P3) Per-strategy `acceptsDrop(dragged) → boolean`.** Today rejection is implicit (snap returns null). Add when type-aware containers appear.

### Tiling

- **(P3) Tiled-content layer primitive.** Surfaced 2026-05-17 by the ParallaxDemo loop work (`4c0e98ef`). The demo's local `tiledProject` helper walks every visible copy of a shape along a periodic x axis, giving seamless infinite-pan looping for free. Generalized shape: a `createTiledLayer<TData>({ source, period, axis? })` wrapper that takes any RenderLayer and produces a periodic version, with `tiledProject(visStart, visEnd, period)` as a public helper. Composes cleanly with `createParallaxLayer`. Open questions: 2D wrap (`period: number | { x, y }`); period as a function of view/dims vs constant; per-shape vs per-layer period. Demo today: `apps/site/demos/ParallaxDemo.tsx`. Likely lives at `packages/core/src/features/tiling/` or alongside `createParallaxLayer` in `packages/core/src/features/parallax/`.

### Units

- **(P3) Per-subobject scale.** Today the unit system is global per consumer. Real apps want a child object (a sub-assembly in a CAD scene) to declare its own unit/scale, with conversion at the parent boundary. Likely lives on the parent/group node.
- **(P3) Mixed-unit arithmetic** (`50% + 2ft`) — needs a context to resolve percentages against. Separate design problem.
- **(P3) Per-axis units** — defer until a concrete use case appears (rare; e.g. timeline charts where x is time, y is value).

---

## Animation

All from `docs/specs/2026-05-04-animation-primitive-design.md`:

- **(P3) Animation events / observability** — global subscribe API for debug overlays / analytics.
- **(P3) Animation-aware undo** — "rewind the animation" instead of cancel + jump.
- **(P3) GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts.
- **(P3) Scroll-driven / pointer-driven progress** — animation progress as a function of an external value, not time.
- **(P3) Layout-strategy reflow integration** — explicit hookup; today consumers compose `animateOnSetPose` over a layout-driven adapter.

---

## Selection, actions & UI panels

- **(P3) Silhouette area-select for geometry-in-`data` shapes.** The 2026-06-20 geometry-migration #3 made marquee/lasso area-select silhouette-aware (`packages/core/src/canvas/deps/hitTestArea.ts`, kernel `pointInPolygon`/`segmentsCross`), but it reads geometry from the **pose** only (`(pose as PolygonPath).coords`). So it fires for polygon-pose consumers and `geometryProjection`-synced nodes, but is inert for the kit's own inserted shapes (rect/ellipse/polygon/star/line/pencil), which store geometry in `node.data.path`/`data.shape` behind a plain `{x,y,w,h}` pose → these take the AABB fast-path. This is **not a regression** (the old rect-only `hitTestAABB` was equally AABB-only for them), but the silhouette benefit isn't realized for default kit geometry. Follow-up: route `hitTestArea`'s silhouette branch through `findShapeSilhouette`/`node.data` (world-frame; mind the coordinate frame) so kit-produced shapes also drop AABB false-positives. Either that or make `geometryProjection` the default so the pose always carries the silhouette.

- **(P3) Alignment guides — v1 follow-ups.** Auto-derived alignment guides shipped 2026-06-19 (`packages/core/src/features/guides/alignment/`: `deriveAlignmentGuides` + `matchAlignment` + `alignMoveBehavior`/`alignInsertBehavior`/`alignResizeBehavior`, rendered via `createGuidesLayer`; demo `apps/site/demos/AlignmentGuidesDemo.tsx`). Spec: `docs/superpowers/specs/2026-06-19-alignment-guides-design.md`. Multi-select drag alignment shipped 2026-06-19 (`alignMoveBehavior` matches the selection's union AABB via `unionBounds`). Remaining deferred: (a) **Figma-style segment rendering** — line spanning only between the aligned objects with end ticks / offset labels, instead of full-canvas lines (needs a span-aware layer, not just axis+offset); (b) **equal-spacing / distribution guides** ("equal gaps" across 3+ objects); (c) **rotated-object alignment** — derivation/matching use AABBs, so a rotated object aligns by its bounding box.

- **(P2) Op coalescing in `useScene`.** Done 2026-07-25 — `createScene` now delegates undo/redo to a `@weasel-js/history` instance (design: `docs/superpowers/specs/2026-07-25-unify-scene-history-engine-design.md`); opt-in via `UseSceneOptions.coalesceWindowMs` (default `0` = discrete entries, prior behavior), also forwarded through `sceneFromJSON`. The engine gained `historyLimit` + `onEvict` + O(1) `undoDepth`/`redoDepth`; `applyBatch`'s non-journal fork now records the external ops themselves on the same engine, so external-op batches coalesce too. Follow-up shipped 2026-07-25: scene undo history persists across reload (design: `docs/superpowers/specs/2026-07-25-scene-history-persistence-design.md` — `Scene.serializeHistory`/`restoreHistory`/`setHistoryAdapter`, engine `rebuildOp` hook, `clipKey` threading, draw wiring under `weaseldraw:scene-history-v1` with `defaultCommitAdapter` replay). Phase 2b (OS clipboard) shipped 2026-07-25 — see the Clipboard entry.

- **(P2) Clipboard: OS clipboard / cross-reload serialization.** Done 2026-07-25 (design: `docs/superpowers/specs/2026-07-25-os-clipboard-design.md`). Surface: the adapter clipboard seam (`snapshotSelection`/`commitPaste`/`getPasteOffset` on `sceneAdapter`) + `useClipboardOps`'s `produceFlavors`/`jsonReplacer` outbound seam with a best-effort `navigator.clipboard.write` ladder + the `kit:weasel-json` ingestion handler (priority −50, `IngestCtx.clipboard` wired by `SceneCanvas.ingestion.clipboard`) + a text/plain SVG fallback through `kit:svg` with a weasel-precedence guard + draw's SVG flavor override (`selectionToSvgString` over a selection-subset `sceneToSvgNodes` walk). Draw's hand-rolled clipboard was migrated onto the kit seam, so groups now copy/paste structurally. Imperative paste (toolbar button) stays in-memory by design — only Cmd+V's DOM `paste` event reaches the OS payload. Smoke-verified limitations: Chromium never surfaces `web `-prefixed custom formats on `ClipboardEvent.clipboardData` (async read shows `web application/x-weasel-clipboard+json`; the paste event carries only `text/plain`), so draw→draw cross-reload paste rides the SVG text flavor (since 2026-07-26 that flavor embeds the weasel JSON in `<metadata>` — `embedWeaselMetadataInSvg`/`extractWeaselClipboardFromSvg` + the `kit:weasel-json` SVG branch — so labels/typed data survive it too); and draw binds no Cmd+C shortcut — copy is toolbar-button only, as before the migration.


- **(P3) `<ToggleBar>` polish.** Shipped to `@weasel-js/ui` (spec/plan dated 2026-05-17). Visual still needs polish — literally, polish this.

### Align/distribute/flip follow-ups

- **(P3) Flip pivot policy on the actions registry adapter.** `useFlip`'s `pivot` flows through; bare `defaultFlipActions` deps could surface it.
- **(P3) Cursor-relative align** (e.g. align to mouse position rather than union).
- **(P3) Selection-handles-locked alignment** (align relative to the dragged corner during a resize gesture).

### Debug overlay follow-ups

- **(P3) Per-feature *style* configuration.** Per-feature *color* config already shipped (`DebugConfig.theme` → flat `DebugTheme` color map, `packages/core/src/debug/types.ts`). Remaining: per-feature line-width / dash style.
- **(P3) Debug overlay for hand/zoom tools.**
- **(P3) Printable snapshot mode** — rasterize debug + scene to a single image for bug reports. Should compose with `renderSceneToPixels` (`packages/core/src/canvas/renderSceneToPixels.ts`) as the underlying primitive.
- **(P3) FPS panel extensions** — ms-per-frame readout alongside FPS, draw-call count per frame, per-layer draw-cost breakdown (needs renderer-side instrumentation seams).

### WeaselDraw app follow-ups (defer)

- **(P3) Gradient fills.** Alpha/opacity shipped (`setFillOpacity`/`setStrokeOpacity` + opacity slider); gradient fill-style for objects remains. (Stroke-width control also shipped — now an editable `PropertyNumberInput`, not hardcoded.)
- **(P3) Palette presets / recently-used colors.**
- **(P3) Multi-page documents.**
- **(P3) Richer text style controls** (font, size, weight pickers).

---

## Plugins & packaging

### Theming

- **(P1) Make theming resilient and implementation-agnostic — it should "just work."** Today theming is a set of loosely-coupled conventions that each consumer has to re-derive, and every new surface (canvas-drawn chrome, DOM chrome, HUD widgets, published packages) re-solves it differently. The pieces that exist: `@weasel-js/theme` ships `tokens.css` (`--wzl-*` custom properties) plus a parallel TS export (`DEFAULT_TOKENS`/`TokenName`); `@weasel-js/ui` consumes tokens through 41 CSS Modules; `@weasel-js/hud` renders widgets into the canvas via WebGL and so can't read CSS custom properties at all without an explicit bridge; apps/draw layers its own `wd-` prefixed CSS on top; and the Storybook CSS Vars addon parses `tokens.css` off disk through `scripts/vite-plugin-weasel-tokens.ts`. Nothing enforces that these agree.

  The goal is a single theming contract that holds regardless of *where* a pixel is drawn (DOM vs canvas vs WebGL), *how* the consumer builds (bundler, plain `<link>`, SSR), and *whether* they use our CSS at all — with sensible defaults so a consumer who does nothing still gets a coherent look, and one override point that reaches every surface at once.

  Questions to settle in a spec: (a) is the source of truth CSS custom properties, the TS token object, or a build step that generates both from one input — and how do canvas/WebGL surfaces read it without a DOM `getComputedStyle` round-trip per frame; (b) how do themes compose (light/dark, brand override, per-instance override) without `!important` or specificity fights; (c) what does a consumer import — is `@weasel-js/ui/style.css` mandatory, and what breaks if they skip it; (d) how do tokens version across a lockstep release without every rename being a breaking change; (e) whether unthemed/partial-token states should fall back visibly or silently. Surfaced 2026-07-26 while making theme/ui/hud publishable: the packaging work forced each surface's theming assumptions into the open and they don't currently line up.

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

The kit's primitives are already pluggable — what's missing is a convention for bundling a feature's parts so a single `useFooPlugin()` call returns `{ tool, layers, ops, ... }` that the consumer spreads in, instead of wiring three or four separate exports per feature.

- **(P2) Lightweight v1:** a documented `WeaselPlugin = { tool?, layers?, behaviors?, ... }` shape plus a `mergePluginConfig(...plugins)` helper. ~30 lines + a docs page. Defer until we have ≥2 plugin-shaped features in flight (pen, debug overlay, future grid) — designing before multiple examples risks YAGNI.
- **(P3) Heavier v2** (only if needed for true third-party plugins): Canvas lifecycle hooks (mount/unmount/pre-render/post-render), capability/version negotiation against kit semver, sub-package layout (`@weasel-js/pen`?). Don't pursue without a real third-party consumer asking.

Pen tool and debug overlay both ship as separate exports first (tool + layer factory). After 2–3 plugin-shaped features have shipped this way, do a small spec pass to extract the bundling convention from the actual pattern.

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

- **(P3) Additional packs.** `useDiagramPack` (connectors, snap-to-grid), `useWhiteboardPack` (sticky notes, freeform pen, text), `usePresentationPack` (frame tools, slide nav). Add per real consumer demand.
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
- **(P3) `useScene` user-layer `parallax` property wiring to `createParallaxLayer`** at the SceneCanvas adapter seam (wait for real consumer demand).
- **(P3) Animated parallax** — tween pan/zoom for intro effects; compose `useAnimator` over the opts.

### System-registries pattern

- **(P3) `createReflectable<T>()` utility for the system-registries pattern.** Surfaced 2026-05-12. The kit maintains ≥8 registries with different lifecycles (fonts, tools, ops, actions, easings, shaders, Canvas layers, object-kind). The documentation half shipped — `docs/concepts.md:364` now has a "System registries" section cataloging every registry. Remaining: ship a small `createReflectable<T>()` utility for the cross-cutting reflection concern (debug overlay enumeration, conflict detection). A grand unification is still probably wrong — promote "pick one shape per scope category" only after 3+ registries in the same category exist.

---

## Demos & visual regression

- **(P3) Demo coverage gap: HUD widget gallery.** `@weasel-js/hud` ships five widgets (`button`, `rect`, `text`, `image`, `label`) but only `button` is demo'd (`apps/site/demos/HudDemo.tsx`) — a single "HUD widget gallery" demo card would cover the other four. Brainstorm scope before writing it. (The former `@weasel-js/ui` `CommandPalette`/`PropertiesPanel` half of this item was dropped — those are app-local components in `apps/draw/src/ui/`, not `@weasel-js/ui` exports, so there's no kit-export demo gap.)

### Canvas / SceneCanvas seam

Seam refactor landed 2026-05-24 (plan: `docs/superpowers/plans/2026-05-24-canvas-scenecanvas-seam.md`). After the refactor, `<Canvas>` is a coherent scene-agnostic primitive — WebGL surface + viewport (pinch zoom) + pointer routing + slot composition. Selection, picking, kind registry, scene-aware overlays all live in `<SceneCanvas>`. `<Canvas>` is `@internal` / `@deprecated` and no longer exported from the public barrel (2026-06-19) — it's now private. Internal consumers import it directly from `packages/core/src/canvas/Canvas`.

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

## Release-gate & build hygiene

- **(P3) Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one is desired. Today's barrel test asserts ops/shape-kinds/bundles parity; public exports remain uncovered.

- **(P2) Root `eslint.config.js` is never executed.** It defines `import/no-restricted-paths` zones (`core/` vs `features/`) — real architectural enforcement — but root `lint` is `tsc --noEmit` (`package.json`), and `.github/workflows/ci.yml` runs eslint nowhere; its only lint step is `npm run lint -w @weasel-js/labkit`, which is Biome on a different package. So the zone rules are unenforced, and `packages/font/src/leaf-purity.test.ts` had to re-implement a weaker regex version of the same idea to get anything gating at all. Wiring eslint into CI would let that test be deleted in favor of a rule that does real module resolution.

- **(P3) Tests reaching into another package's `src/` by relative path.** Four hud tests imported `../../core/src/features/text/atlas/registerFont` and broke when that file moved during the `@weasel-js/font` extraction. They were repointed at `@weasel-js/font`, but the pattern likely exists elsewhere — worth a sweep (`grep -rn "\.\./\.\./[a-z-]*/src/" packages/*/src`).

- **(P3) Last 4 React `act()` warnings in CI vitest.** The June 2026 sweep took the `ci.yml` "not wrapped in act(...)" count 200 → 4 (and killed the ~91 jsdom `getContext` stack dumps); see `vitest.setup.ts` (global `getContext` stub) and the test-side `act()` wrapping. The remaining 4 all come from `packages/core/src/canvas/SceneCanvas.tools.test.tsx`'s *"omitted defaultTools: resize is registered"* test — a SceneCanvas-internal deferred update from the resize-gesture commit that resists every test-side `act()` strategy tried (async microtask flush, `setTimeout(0)` macrotask flush, dispatching the whole down→move→up gesture inside one `act()`). A real fix has to live in SceneCanvas's update scheduling, not the test. Note: these warnings only reproduce under CI (ubuntu/worker timing), not locally — verify via the `ci.yml` log. Low value; defer.

- **(P3) Wire `test:perf` into a CI gate.** `animation-stress.spec.ts` was moved out of the visual suite into `tests/perf/` (own Playwright config + `npm run test:perf`) so its timing-sensitive mean-cycle assertion stops red-lighting `visual.yml`. It now runs in **no** CI workflow — it's a manual diagnostic. If we want regression coverage for renderer lag/crash-freedom, add a manual `workflow_dispatch` (or nightly) job that runs `test:perf`; keep it off the per-push path since the perf threshold flakes on shared runners.

---

## Documentation

- **(P2) README pitch sweep.** Initial draft landed; the `docs/` long-form sweep was completed (all hook names and import paths match the post-extraction surface). A re-pass before 0.1.0.

- **(P3) JSDoc audit at definition sites.** A one-pass sweep at definition sites for any public export still lacking a JSDoc string. (Barrel section headers already landed in `packages/core/src/index.ts`; per-symbol JSDoc lives at original definitions.) File a follow-up if a specific export turns up undocumented.
