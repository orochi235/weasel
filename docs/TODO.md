# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@orochi235/weasel`). The
kit aims to be a generic 2D scene-graph foundation. Items here are evaluated
for cross-app reuse, not consumer-app value.

For history of completed work that pre-dates extraction, see `git log` and
the dated specs/plans under `specs/` and `plans/`.

## WebGL backend rewrite (exploratory, unscheduled)

Spec: `docs/specs/2026-05-03-webgl-backend-design.md`. Full renderer rewrite from Canvas 2D to WebGL2. Not on the schedule — go-criteria documented in the spec ("when at least two are true"). When pursued:

- WebGPU backend after WebGL ships (separate future spec).
- Worker-thread offload via `OffscreenCanvas` rendering in a worker — major perf win, significant API complexity. Defer until single-thread GL is shipped and measured.
- Print/SVG export. 2D backend supports these for free via context swap; GL doesn't. Need a parallel SVG export path or 2D fallback for export.
- Custom shader API for consumers. The `kind: 'shader'` DrawCommand exists in the spec but its public surface (program registration, uniform binding) needs its own design pass.
- Exotic composite operations (xor, custom Porter-Duff) via framebuffer pingpong — deferred from v1 GL.
- WebGL1 fallback — out of scope; WebGL2 only.
- Headless server-side rendering (Node + headless-gl) — possible but not a v1 commitment.

## weasel-den deferrals

From `docs/specs/2026-05-03-weasel-den-design.md`:

- **Versioned default keybindings.** Post-1.0, support `useStandardTools({ keybindings: 'v1' })` so default-keybinding changes don't break existing consumers. v1 locks them in.
- **Additional packs.** `useDiagramPack` (connectors, snap-to-grid), `useWhiteboardPack` (sticky notes, freeform pen, text), `usePresentationPack` (frame tools, slide nav). Add per real consumer demand.
- **Migrate `useSelectTool` / `useInsertTool` / `useTextTool` / `useUserPenTool` to weasel-den.** Defer until each is stable post-overlay-channel work and any further Tool API iteration. They're staying in core to keep being canonical examples for primitive design.
- **Runtime plugin discovery.** Explicit non-goal in v1 — tools register statically via `useTools({ registry })`. Add when external authors want to ship tools without app rebuild.
- **Public third-party extension SDK.** Deliberate exports happen during the split, but no marketing or stability guarantees yet.
- **Per-workspace pre-commit narrowing.** Pre-commit hook should run only the workspace whose files changed (lint-staged dispatcher). Dispatcher script can land after the initial split.

## Eric audit (post weasel-den or at next break)

Eric (`~/src/eric`) is the side app weasel was extracted from; per project memory it remains the reference for prior-art demos and interaction patterns. Audit eric for parity with current weasel — verify it still builds against the published surface, check what divergent local copies of kit code (if any) need merging back. Trigger: user wants to implement container-layout strategies in eric next, and that's a candidate exercise for weasel's container/layout primitives.

## Viewport follow-ups (Phase 2c deferrals)

Surfaced as explicit out-of-scope items in `docs/specs/2026-05-03-tool-primitive-phase-2c-design.md:158-165` and `docs/specs/2026-05-03-viewport-and-hand-tool-design.md:133-143`. Phase 2c shipped pan+zoom+chrome-screen-space; these are the tail.

- **Inertial pan / momentum.** Drag-release continues panning with friction. Lives outside the hand tool — likely a `useInertialPan` decorator or option on `useHandTool`. Originally scoped in `docs/specs/2026-05-03-tool-primitive-phase-2c-design.md:161`.
- **Per-axis zoom** (`scaleX` ≠ `scaleY`). Real driver: timeline charts where x-axis is time and y-axis is value, zoomed independently. Forks `View` from `{x,y,scale}` to `{x,y,scaleX,scaleY}` and ripples through `worldToScreen`/`screenToWorld`/`zoomAt`. Originally scoped in `docs/specs/2026-05-03-tool-primitive-phase-2c-design.md:163`.
- **Animated zoom transitions.** Smooth interpolated `setView` for Cmd+0 reset and `zoomTo` (programmatic frame). Trivial layer on top of `setView` per the spec. Originally scoped in `docs/specs/2026-05-03-tool-primitive-phase-2c-design.md:164` and `docs/specs/2026-05-01-canvas-kit-zoom-interaction-design.md:283`.
- **Pinch-zoom on touch (real `TouchEvent`).** Browsers don't synthesize ctrl+wheel for native two-finger pinch on iPad/touchscreens — that path needs a separate `pinchTouch` source built on `TouchEvent` with two pointers. Originally scoped in `docs/specs/2026-05-03-tool-primitive-phase-2c-design.md:165` and `docs/specs/2026-05-01-canvas-kit-zoom-interaction-design.md:287-289`.

## Tool primitive follow-ups

Small items surfaced during Phase 2a/2b/2c shakedown:

- **Swillustrator demo (full 5-tool palette).** *Shipped.* All five tools landed (select + insert-rect + text + pen + hand). Pen ships as `useUserPenTool` + `createPenPreviewLayer` — see `docs/specs/2026-05-03-pen-tool-design.md`.
- **Image / polygon / future drag-insert tools.** Deferred from `docs/specs/2026-05-05-drag-insert-primitive-design.md`. The consolidated `useDragRect` + `useInsert` + `defineDragInsertTool` stack is built so adding new drag-insert tools is a thin Tool veneer, but each tool is its own task.
- **Promote `hitExistingGate` to gate select-tool's move/resize paths.** Deferred from `docs/specs/2026-05-05-drag-insert-primitive-design.md`. Different responsibility (gating mutation gestures rather than insertion), different gesture surface — punt until a real consumer wants it.
- **General drag-gesture base subsuming `useDragRect` + `useMove`.** *Spec:* `docs/specs/2026-05-05-drag-gesture-base-design.md`. Pulls the imperative-controller scaffolding (phase machine, threshold gating, scratch lifecycle, `onGestureStart`/`onGestureEnd` resilience, stable controller identity) out below `useDragRect`/`useMove` as `useDragGesture<TScratch>`. Both existing hooks become wrappers; public surface unchanged.
- **Evaluate `useResize`/`useRotate` against `useDragGesture`.** Deferred from `docs/specs/2026-05-05-drag-gesture-base-design.md`. After the dragRect/move migration lands, evaluate whether resize and rotate fit cleanly on the new base. Their state shapes (per-id pose map keyed by handle/center, multi-target union AABB) are different from move's flat pose map and may not benefit. Revisit only if/when their scaffolding diverges from the base in a way that costs maintenance.
- [x] **NestedGroupsDemo: collapse custom moveTool + custom scene/ghost layers into `useSelectTool`.** *Shipped.* Hit resolution lives in `nestedGroupHitTester` (kit-exported); the demo uses `useSelectTool({ pickBest, move: { cascadeWorldPose: worldPoseOf } })` with the standard `scene` slot rendering world poses via `toPose: (n) => worldPoseOf(n.id)`. `previewPose`/`previewIds` flow through the standard slot — the demo no longer reads `move.overlay.poses`/`hideIds`. Adapter wires `hitTestArea` + `applyOps` so area-select runs.
- [x] **Multi-resize peekBounds via the active tool.** *Shipped.* `useSelectTool` now exports `MULTI_RESIZE_TARGET_ID` and implements `peekBounds(id)` that synthesizes the multi-union from `getSelection()` + `boundsOf`; `Canvas.tsx` no longer special-cases the synthetic id inline. `<SceneCanvas>` auto-wires `getSelection`; demos hand-building `useSelectTool` (ComposeDemo, MultiSelectDemo) pass it explicitly.
- **`useTextTool`'s synthesized adapter ergonomic.** `useTextTool` synthesizes its own `InsertAdapter` and threads `ctx.applyBatch` via a ref because the click-first ergonomic doesn't expose an adapter to the consumer. After the May 5 drag-insert primitive lands, the capture-and-clear is owned by `defineDragInsertTool` (not duplicated in the wrapper) but the underlying asymmetry remains. Revisit if a third drag-insert tool would benefit from a unified ergonomics story (e.g. accept either an adapter *or* an inline factory).

### Pen tool follow-ups (deferred from `docs/specs/2026-05-03-pen-tool-design.md`)

- **Snap-to-existing-anchors** (cross-path anchor snapping). Clicking near an existing path's anchor would coalesce. Useful for stitching paths; out of v1.
- **Mid-creation editing of placed anchors.** Append-only in v1 — to fix mistakes, finish the path and re-enter via BezierEdit. Drag-on-placed-anchor during creation embeds the BezierEdit gesture into pen creation (significant scope).
- **Continue an existing path's open endpoint.** Click an existing open path's first/last anchor to pick it up and append. Adjacent to mid-creation editing; not in v1.
- **Compound-path with open middle subpath.** v1 enforces "open subpath must be the last." Mixing open/closed in arbitrary order in a single multi-contour path needs a third Enter meaning (or a separate keybind for "open this subpath without committing").
- **Click-on-existing-anchor-to-edit during creation.** Same scope as mid-creation editing; deferred together.
- **Return path to the default tool.** *Shipped.* `useSelectTool` now declares `keybinding: 'V'` and `useKeybindings` handles Escape — falls back to the snapshotted initial active tool unless a `defaultTool: string | null` option overrides (or disables) it. Tests cover all three paths.

## Tool overlay channel deferrals

From `docs/specs/2026-05-03-tool-overlay-channel-design.md` (v1 explicit out-of-scope):

- **Per-overlay z-positioning.** v1 always renders tool overlays on top. Add `overlayPosition?: 'top' | 'before-selection' | 'after-selection'` field to the Tool record when a real consumer wants overlay chrome below selection handles (e.g. a snap-target highlight that should sit behind handles).
- **Multiple overlays per Tool.** Today `Tool.overlay` is a single `RenderLayer`. If composing multiple visually distinct layers into one `draw` becomes painful, promote to `overlay?: RenderLayer | RenderLayer[]`.
- **Subscription / push model.** Today the channel is pull (Canvas asks each frame, scratch is read via React closure). If a tool needs to push state changes outside the React render cycle, add an imperative `tools.publishOverlay(toolId, layer)` channel.

## Deferred from animation primitive (2026-05-04)

From `docs/specs/2026-05-04-animation-primitive-design.md`. The `src/animation/` module ships `useAnimator` (`tween`/`spring`/`decay`), `tweenPose`/`springPose`, `animateOnSetPose`, `animateLifecycle`, and the `momentum` MoveBehavior. Out of scope:

- Ambient / looping animations — `loop({...})` convenience helper. Primitive supports it via self-retriggering tween; ship sugar when a real consumer wants it.
- Spring "no destination" mode — unify `spring`/`decay` if the seam pinches.
- Animation events / observability — global subscribe API for debug overlays / analytics.
- Synchronized animations / staggers — "animate N objects with 50ms stagger" one-liner.
- Animation-aware undo — "rewind the animation" instead of cancel + jump.
- GPU / Web Animations API bridge — offload to compositor for very large concurrent counts.
- Scroll-driven / pointer-driven progress — animation progress as a function of an external value, not time.
- Easing function library — *Shipped.* Full Penner family: linear + quad/cubic/quart/quint + sine/expo/circ + back/elastic/bounce, with `In`/`Out`/`InOut` variants for each. Re-exported from `src/animation/index.ts` and bundled into a `EASINGS` lookup with an `EasingName` type for demo pickers. Pre-existing `easeIn`/`easeOut`/`easeInOut` aliases preserved (resolve to the quadratic curves).
- Animator pause / resume / time-scale — useful for debugging.
- Layout-strategy reflow integration — explicit hookup; today consumers compose `animateOnSetPose` over a layout-driven adapter.

## Deferred from container layout strategies (2026-05-04)

From the `LayoutStrategy<TPose>` module (`freeform`/`tileGrid`/`snapPoint` strategies + `useMove` integration). Spec: `docs/specs/2026-05-03-container-layout-strategies-design.md`.

- **AABB-fallback assumes rect-shaped TPose.** When `LayoutStrategy.contains` is absent, `useMove`'s layout hit-test reads `pose.x/y/width/height` directly. For non-rect TPose (e.g. `Path`) the call is broken. Either (a) require `contains` on every `LayoutStrategy<NonRectPose>`, (b) thread a `PoseDescriptor` through the layout pass to derive an AABB, or (c) document the constraint and lint it.
- **Z-order walk doesn't cross non-container ancestors.** `useMove`'s layout-pass z-order walk uses `OrderedAdapter.getChildren` to recurse the scene tree; depth ordering picks the deepest layout-bearing container. Cases where two layout-bearing containers sit at different depths under unrelated ancestors are correct. Open question: when a deep layout container is BELOW (in z) a shallow layout container that shares the dragged point, today the deepest wins — debate whether real z-order across the whole tree (flat painter's order) should win instead. Decide once a consumer hits the case.
- Multi-select drag into a layout container currently falls through to the per-id transform batch (no `commitDrop` invocation, no sibling reflow). Layout-aware commit only fires when `ctx.draggedIds.length === 1`. Decide multi-select-into-layout semantics (sequential commitDrops? grouped layout API?) before lifting the guard.
- **Drop rejection signal.** v1 layout commits a free-space `setPose` when no container accepted a drag. Needs a cleaner semantic — candidates: a dedicated cancel op, a snap-back-to-source-pose path, or having the source layout's `commitDrop` re-place the child at its origin slot.
- **Tile-grid overflow policy.** Children beyond `cols * rows` are skipped from `getChildPositions`. Real apps may want scroll, grow-grid, or rejection — pick once a consumer asks.
- **Strategy-aware drop regions.** A layout could expose `dropRegion(container) → Bounds` extending beyond visible bounds for forgiveness (e.g. row layouts catching pointers slightly past the row's end). Today the gesture hit-tests against container body bounds.
- **Stateful layout strategy factories.** All v1 strategies are pure. If profiling shows recompute pain (likely only quadtree-class), promote to a factory returning `(container) → { ... }` with cached state.
- **Animated reflow transitions.** Sibling reflow is snap-to-target in v1. Smooth interpolation during the preview is a layer above (likely a `useAnimatedReflow` hook over the now-shipped animation primitive).
- **Quadtree / packing layouts.** Eric's quadtree strategy stays in eric (or a future plugin). Niche enough not to belong in the generic kit.
- **Slot-based layout strategy** (rows / grid / ring arrangements à la eric's `@/model/arrangement`). Worth lifting once the v1 three settle and a kit-generic shape emerges that doesn't drag domain types.
- **Configurable layout hit-test order.** v1 uses top-most container under the dragged center. Innermost-regardless-of-z and explicit-drop-region modes are escape hatches if a real consumer needs them.
- **Per-strategy `acceptsDrop(dragged) → boolean`.** Today rejection is implicit (snap returns null). An explicit pre-check could short-circuit `getDropTargets` for incompatible objects (e.g. a grid that only accepts squares). Add when type-aware containers appear.
- **Tool overlay rendering of reflowed siblings.** `MoveOverlay` now publishes `hypotheticalChildPositions` / `sourceReflowPositions`, but `useSelectTool`'s overlay doesn't yet draw them. Wire the select tool's overlay to render hypothetical poses (likely as ghosts) so users see the reflow preview during the drag.

## Deferred from text-primitive world-unit pass (2026-05-04)

From the `renderLabel` / `markdownText` world-unit safety refactor (`padX`/`padY`/`cornerRadius` configurable on `renderLabel`, multiplicative `sizeFactor` replacing additive `sizeOffset`, drop `Math.round` on line height).

- Investigate whether eric (`~/src/eric`) can delete its local `labelHelpers.ts` after this lands. If consumer-side world-unit helpers still cover gaps the primitives don't (e.g. world↔screen pad conversion at the call site), capture the remaining gap as a follow-up primitive proposal.
- Consider whether `parseMarkdownRuns`'s `[`/`(`/`]`/`)` markup should be promoted to a structured AST (today the output is a flat list of tokenized runs with composed factors, not a tree). Defer to a future "rich text" pass — the current shape is sufficient for label/markdown rendering but limits reformatting / re-styling transforms.

## Plugin/bundling convention

The kit's primitives (Tool, RenderLayer, Adapter, PoseDescriptor, Behavior, Op factory, DebugSink) are already pluggable — any external package can author one and consumers wire it in. **What's missing is a convention for bundling a feature's parts** so a single `useFooPlugin()` call returns `{ tool, layers, ops, ... }` that the consumer spreads into Canvas/useTools, instead of wiring three or four separate exports per feature.

- **Lightweight v1:** a documented `WeaselPlugin = { tool?, layers?, behaviors?, ... }` shape plus a `mergePluginConfig(...plugins)` helper. ~30 lines + a docs page. Defer until we have ≥2 plugin-shaped features in flight (pen, debug overlay, future grid) — designing the convention before we have multiple examples risks YAGNI.
- **Heavier v2 (only if needed for true third-party plugins):** Canvas lifecycle hooks (mount/unmount/pre-render/post-render), capability/version negotiation against kit semver, sub-package layout (`@orochi235/weasel-pen`?). Multi-day. Don't pursue without a real third-party consumer asking.

Pen tool and debug overlay both ship as separate exports first (tool + layer factory). After 2–3 plugin-shaped features have shipped this way, do a small spec pass to extract the bundling convention from the actual pattern.

## Tier 1 — foundational genericity gaps

Without these, the kit is essentially "axis-aligned-rectangle kit."

- **Paths and compound shapes.** *Phase 1 + 2 shipped.* Phase 1 (`cbf2201`) generalized the gesture math off `{x, y, width, height}`: `useResize` takes an optional `geometry: PoseDescriptor<TPose>` (default `RECT_POSE_DESCRIPTOR`, `pathPoseDescriptor` for `Path` poses) so bounds + remap-on-resize work over any pose shape; move uses `translatePose` (e.g. `translatePath`) and snap behaviors take a `PoseOriginProjection`. Phase 2 (uncommitted) shipped `CompoundPathsDemo` — five non-rect shapes (multi-contour evenodd ghost, composePath duck, disjoint hat+cape Hamburglar, extreme-aspect goose, open-polyline-tentacle octopus) all editable through the same Canvas + `geometry={pathPoseDescriptor}`. `composePath`, `polygonFromPoints`, `PathBuilder`, `pointInPath`, and `traceToContext` are all public. Open follow-ups (track here so they don't get lost during the migration):
  - **Hot-loop perf hardening.** Making paths first-class trades V8 monomorphization for polymorphism in interaction hot loops. Plan: (1) ship the `RectPath` discriminated subtype so the polygon kernels can short-circuit on the common case (O(1) AABB + hit), (2) audit pointer-move paths for per-frame allocation (resize-preview ghost vertices are the worst offender — likely needs in-place mutation or `Float32Array` ghost buffers), (3) benchmark rect-only and polygon-only scenes against the pre-migration baseline (commit hash needed before Phase 0 starts), (4) fix any regression > ~10% before sunsetting `RectPose` machinery. Defer until Phases 0–4 have landed and we have real numbers to chase, not speculative ones.
- **Groupable objects.** First-class group node: select-as-one, move-as-one, transform children relative to group origin. Universal across diagramming and illustration tools. *Status:*
  - Virtual groups (lasso-style `members[]` records, no scene-graph change) ship with `useGroup` / `useUngroup` and resize-as-group.
  - Nested groups (real hierarchy nodes) ship as `useNestedGroup` / `useNestedUngroup`, backed by `composeWorldPose` / `rebaseLocalPose`. Adapter contract now declares poses as **local** (relative to direct parent); the kit composes world via the helper. Children's locals are auto-rebased on group/ungroup so visual world position is preserved.
  - Snap behaviors stay local-frame by design (see project memory). Selection-overlay composer shipped as `worldPoseLookup`. `useMove` auto-cascade shipped: when the move adapter exposes `getChildren` and the hook is given `cascadeWorldPose`, descendants are translated alongside the dragged ids in the live overlay (no extra ops — children's locals don't change when their parent's local moves).
  - Rotation gesture shipped (`useRotate`) with a `RotatedPose` extension and a `selectionOverlay.rotationHandle` toggle; rotates around AABB center. Resize on a rotated object still operates against the AABB (deferred — see RotateDemo description).
- **Text rendering.** *Largely done.* `createTextLayer`, `useTextEdit`, `createSetTextOp`, `pointInTextPose`, and `TextStyle` (with caret/selection theming) ship; in-place edit via a contenteditable overlay is wired through op/undo. Open follow-ups:
  - **Glyph-position hit testing.** *Done.* `caretIndexAt(ctx, x, y, pose)` resolves a world-space click to a character offset using the wrap's `lineStarts`; `useTextEdit.startEdit(id, { caret })` seeds the contenteditable caret at that offset. TextDemo's double-click drops the caret where you clicked instead of selecting all.
  - **Cross-browser overlay alignment.** `placeOverlay` uses an empirical `(+1, -1)` CSS-px nudge to compensate for canvas/CSS rasterization disagreement. Works on the dev setup; not universally correct across browsers/fonts/DPRs. A self-correcting probe was attempted and rejected.
  - **Auto-sizing.** *Done v1* — `fitTextPose(ctx, pose, opts?)` returns a copy of the pose with `height` (or `width` and `height`, via `axis: 'both'`) recomputed to fit the wrapped/unwrapped text. Pure helper — caller decides when to recompute and writes the result back through their adapter; the kit does not own the policy.
- **Gradient paint variants.** `Paint` is a tagged union with `solid` and `pattern` today. Adding `linear-gradient` and `radial-gradient` variants is a non-breaking extension when a real consumer asks. Each gradient type has many dials (color stops, color-space interpolation, angle vs vector, focal point for radial); design against a concrete call site rather than speculatively.
- **Per-vertex coloring on paths.** Today a `Path` pose carries one fill paint applied uniformly. A per-vertex color array (one color per anchor / polygon vertex, interpolated across triangles between them) would unlock gradient maps, heatmaps, mesh shading, and "rainbow stroke" effects without leaving the kit. 2D canvas has no native barycentric interpolation, so the implementation needs either (a) a triangulation pass + per-triangle gradient fills, or (b) an offscreen WebGL bridge (heavier, but scales). Decide once a concrete consumer wants it. Sits adjacent to the gradient-variants work but is a distinct shape — gradients are paint definitions, vertex colors are pose-attached data.
- **Layer effects framework.** Distinct from `Paint` — effects modify pixels rather than choosing color. Likely shape: `type Effect = { kind: 'shadow' | 'blur' | 'composite' | 'clip' | 'transform'; ... }` plus an `applyEffects(ctx, effects[])` helper that mutates `ctx.shadowBlur`/`filter`/`globalCompositeOperation`/etc before a draw block. Open question on composition model: per-layer `effects?: Effect[]` option vs a wrapper layer (`withEffects(layer, effects)`). Defer until a real use case lands (selection-overlay glow on hover? drop-shadow on dragged objects?). The breadth of canvas effects (shadows, filters, blend modes, clipping, transforms) means the abstraction will over- or under-fit without a concrete first consumer.

## Tier 2 — broad reuse

- **Customizable units.** *Done v1* (`UnitSystem` / `UnitValue`, bare-number = base unit fallback) — see `src/units.ts`. Open follow-ups:
  - **Per-subobject scale.** Today the unit system is global per consumer. Real apps want a child object (a sub-assembly in a CAD scene) to declare its own unit/scale, with conversion at the parent boundary. Likely lives on the parent/group node once Tier 1 #2 lands.
  - **Mixed-unit arithmetic** (`50% + 2ft`) — needs a context to resolve percentages against. Separate design problem.
  - **Per-axis units** — defer until a concrete use case appears (rare; e.g. timeline charts where x is time, y is value).
## Tier 1.5 — small additive hooks

- **Selection-driven action hooks**: shipped against the existing virtual-group adapter and `History` (`useEscape`, `useSelectAll`, `useDuplicate`, `useNudge`, `useDelete`, `useReorder`, `useClipboard`, `useUndoRedo`). Nested-group variants (`useNestedGroup` / `useNestedUngroup`) shipped alongside the original virtual-group `useGroup` / `useUngroup`.
- **Grid overlay snap-target hover.** *Done.* `useGridCellHover` ships the pointer-tracking glue; pair its `getCell` with `createCellHighlightLayer` and the `spacing` your `gridSnapStrategy` already uses.

- **Aspect-ratio lock during resize (`shift` to constrain).** *Shipped.* `lockAspectWithModifier({ key?: 'shift' | 'alt' | 'meta' | 'ctrl' })` ResizeBehavior — drag a corner/edge with the modifier held to maintain the start-pose's W/H ratio. Default key `'shift'`. Re-exported via `@orochi235/weasel/resize`. See `src/interactions/gestures/resize/behaviors/lockAspect.ts`.
- **Alignment guides / insert snap-to-existing-edges.** Shows snap lines when an inserted/moved object's edge or center aligns with a sibling's. Slot for a new `SnapStrategy` plus an overlay layer. Originally scoped in `docs/specs/2026-04-30-canvas-kit-resize-insert-design.md:278`.
- **Op coalescing implementation.** `Op.coalesceKey` is declared in `src/core/ops/types.ts:13` and set on `transform`/`setText` ops, but `History.append` does not coalesce — every drag step still pushes a discrete entry (ops are batched per gesture, but per-keystroke text edits aren't merged across batches). Originally scoped in `docs/specs/2026-04-30-canvas-kit-interactions-design.md:304` as "mark `coalesceKey` field but defer logic." Decide policy (time window? consecutive same-key only?) and wire it into `History`.
- **Drag-to-reorder UX for sibling z-order.** `createMoveToIndexOp` and `useReorder` ship the data side, but no built-in gesture or list-style sidebar drives them — consumers wire their own. Worth shipping a reference UI (a draggable layer-list panel) and/or a scene-graph drag-into-position gesture. Originally scoped in `docs/specs/2026-05-01-canvas-kit-sibling-zorder-design.md:222`.
- **`renderChildrenLayer` factory.** Spec calls out a natural follow-up: a `renderChildrenLayer({ adapter, parentId, drawObject })` factory that iterates `adapter.getChildren(parentId)` and draws each. Today consumers hand-iterate. Originally scoped in `docs/specs/2026-05-01-canvas-kit-sibling-zorder-design.md:211-218` and tracked again in `docs/plans/2026-05-01-canvas-kit-sibling-zorder.md:1293`.
- **Clipboard: cursor-relative paste offsets.** Today `useClipboard.paste()` uses a fixed cascade offset; pasting near the pointer (or at a `dropPoint`) is a common editor expectation. `commitPaste(ctx)` already accepts an optional `dropPoint`; useClipboard just doesn't pass one. Originally scoped in `docs/specs/2026-05-01-canvas-kit-area-select-clipboard-design.md:273`.
- **Clipboard: OS clipboard / cross-reload serialization.** Currently the kit's clipboard is in-memory only — copy doesn't reach the system clipboard, and reloading drops the buffer. Needs a serialization shape (likely the same op-log shape useScene wants) plus `navigator.clipboard` plumbing with a JSON wire format. Originally scoped in `docs/specs/2026-05-01-canvas-kit-area-select-clipboard-design.md:274`.
- **Lasso (non-rectangular) area-select.** Marquee select is rectangular only. Lasso draws an arbitrary polygon and selects items whose bounds intersect (or whose centers fall inside). Adjacent to the path/polygon work in Tier 1. Originally scoped in `docs/specs/2026-05-01-canvas-kit-area-select-clipboard-design.md:275`.
- **`selectionClone` variant (alt-drag clones the entire selection).** Today `useClone` (alt-drag) clones only the hit object. Selection-clone duplicates every selected item as a group and drags the cluster. Originally scoped in `docs/specs/2026-05-01-canvas-kit-clone-design.md:230-231`.

- **Kit-level `viewTransform` integration on `<Canvas>` — zoom (Phase 2c-or-later).** *Pan-only integration is being split out into Tool primitive Phase 2b (hand tool); this entry now tracks the **zoom** half.* *What this is for, plainly:* let users zoom and pan the canvas — scroll-wheel to zoom in on detail, click-drag to pan around a scene larger than the viewport, pinch on a trackpad, hit Cmd+0 to reset. Today the kit ships the standalone primitives (`ViewTransform`, `useZoom`, `usePan`, `worldToScreen`, `screenToWorld`) but `<Canvas>` itself ignores them — the rendered pixels are always 1:1 with content units, and pointer events come in as raw canvas coords. The bezier demo's zoom buttons work around this with a CSS scale on a wrapper div, which grows the pixels visually but doesn't actually re-render at higher resolution and doesn't generalize. *Why it's deferred:* the rendering side is one line (`ctx.setTransform(zoom, 0, 0, zoom, panX, panY)` before `runLayers`) but the "what stays constant under zoom" question forks two ways:

  - **Kit-owned chrome** (selection handles, marquee, anchor dots, rotation handle): the kit can decide, and "screen-px constant" is unambiguous — no app wants 32px-tall handles at 4× zoom. This implies a two-pass renderer: scene + grid layers run under the view transform, overlays run under identity but compute their positions via `worldToScreen(...)`.

  - **Consumer-drawn scene** (path strokes, fills, lineWidths): the kit *can't* decide because it's domain-dependent. Illustrator/Figma scale strokes with zoom (a 2pt line is 4px at 2× — strokes are "what would print"). Map/diagramming tools pin strokes to screen-px (a road stays 2px thick at any zoom — you're zooming the layout, not the style). Real apps mix: Figma scales shape strokes but pins UI; Photoshop pins selection chrome but raster brush strokes are world-px. So the kit must hand the consumer enough information to pick — concretely, `drawOne(ctx, obj, pose)` gains a `view` arg (or `zoom` shortcut) so consumers can divide `lineWidth` themselves when they want screen-constant strokes.

  *Surface impact:* `RenderLayer.draw` signature (needs a `view` arg), `SceneSlotConfig.drawOne` signature (gains `view`), `handleHitRadius` semantics (becomes screen-px instead of world-px), default `clientToWorld` routes through `screenToWorld`. Multi-day; ship when a real second consumer needs it (the bezier demo alone doesn't justify the surface change).

- **`arrayAdapter` as the default Canvas adapter.** Today every demo wires an explicit `adapter={arrayAdapter(...)}` (or hand-rolls one). Half the kit's surface assumes the arrayAdapter shape anyway. Make `adapter` optional — when omitted, Canvas synthesizes one from a smaller required prop set (`items`/`setItems` + `toPose`/`fromPose`, or just an `items` ref + a setter). Demos with the trivial flat-list shape drop the adapter boilerplate entirely; non-trivial cases keep the explicit-adapter escape hatch. Open: name and exact prop surface (`items` + `onChange`? a single `state` prop?), and whether group/ordered scenes get a parallel default or stay explicit.

## Tier 3 — specialized but valuable

- **Pathfinder-style shape merge operations.** Boolean ops on `Path` poses — union, intersection, subtract (front-minus-back), exclude (xor), divide, trim, merge, crop, outline. Illustrator's Pathfinder panel + Figma's boolean ops are the reference UX. Likely a `pathfinder.union(a, b)` family of pure functions returning a new `Path`, plus a selection-driven action hook (`usePathfinder`) that takes the current multi-selection and writes a single replacement path via the existing op pipeline. Open: which polygon-clipping algorithm to bring in (Vatti vs Greiner-Hormann vs Martinez), Bezier handling (flatten-then-clip vs true curve booleans), and whether the result preserves the source shapes as a non-destructive group.
- **Bezier curves / splines (control-point editing gesture).** A path-capable kit (Tier 1 #1) gives the data shape; what's genuinely new here is the interaction pattern: editing handles on a curve. Specialized resize-like hook with non-corner anchors, plus curve sampling and hit-testing in the renderer. Useful for routing edges in node graphs, illustration, motion paths.
- **Parallax plugin.** Multi-layer canvas where layers translate at different rates relative to the viewport pan. Useful for sketch/concept-canvas backgrounds, depth illusions, mapping, and game-style scenes. Likely a `RenderLayer` factory or thin wrapper over `usePanInteraction` exposing `parallaxFactor` per layer. Plugin form keeps it out of the core. Open question: does it warp `screenToWorld` for hit-testing, or is parallax purely cosmetic?
- **d3 integration plugin.** Bridge the adapter/op model to d3 selections so consumers can drive scene updates from data joins (enter → InsertOp, update → setPose, exit → DeleteOp). Strict plugin form — d3 stays out of the core. Real audience: dashboards, network graphs, force-directed layouts, scientific viz.

## Recently shipped (follow-ups optional)

- **Swillustrator standalone app (`apps/swillustrator/`).** *Shipped.* Spun out from the demo entry into its own Vite app with a full-page UI: left tool-palette sidebar, right fill/stroke color pickers (native `<input type="color">`), centered US-Letter page-shaped canvas (816×1056 @ 96dpi). Reuses the same 5-tool palette (select/insert/text/pen/hand) plus always-on viewport tools. Scripts: `npm run dev:swill`, `npm run build:swill`. **Open follow-ups (defer):** persistence (currently in-memory only — no save/load/export); stroke-width control (today hardcoded to 1px); fill-style options beyond solid (gradient, alpha); palette presets / recently-used colors; multi-page documents; richer text style controls (font, size, weight pickers); SwillustratorDemo entry in the kit demo was retired — the standalone app is the home now.

- **Debug overlay primitives.** *Shipped.* `<Canvas debug={DebugConfig | true | 'all'}>` appends a screen-space overlay layer that paints what the kit's interaction system "sees": object bounds (AABBs), pose origins, every hit-test shape, handle positions, snap candidates, per-layer metadata. URL fallback `?debug=all` (or `?debug=bounds,handles`) reads from `location.search`. Tree-shaken when `debug` is falsy/undefined — zero runtime cost in prod. Demo: `demo/demos/DebugOverlayDemo.tsx`. Open follow-ups (defer until consumer friction): per-feature color/style configuration; debug overlay for hand/zoom tools; printable snapshot mode (rasterize debug + scene to a single image for bug reports).

- **`useScene` — kit-owned scene primitive.** *Phases 1–3 shipped (`391ba2e`, `da9675a`, `24c72eb`).* Reference doc: `docs/proposals/useScene.md`. Adds a third tier of scene-state ergonomics: kit-owned `Scene<TData, TLayer, TPose>` primitive with first-class container/leaf tree, orthogonal layer tags, opaque domain payload, auto-undoable mutations, and a `recordOp` seam for consumer ops. `<SceneCanvas>` synthesizes an adapter and auto-wires undo/redo + container cascade. `demo/demos/SceneDemo.tsx` shows cross-layer parenting + a `setColor` consumer op on the same undo stack. **Open follow-ups (defer until consumer friction):** op log serialization shape for built-in ops; user-layer mutation methods (`addLayer`/`removeLayer`/`renameLayer`/`moveLayer`); container layout strategies (today: absolute-positioning only); selection-in-Scene vs external; tree-mutation invariants documented explicitly (`remove(container)` cascade, `move` cycle detection, `setLayer` on container); full tier unification (collapse inline-props/explicit-adapter onto Scene).

- **Tool primitive Phases 1 + 2a + 2b.** Phase 1 substrate (`defineTool`, `useTools`, `useKeybindings`, `ToolCtx`, three-slot dispatcher with four channels). Phase 2a built-ins (`useSelectTool`, `useInsertTool`, `useDeleteTool`, `useNudgeTool`, `useUndoRedoTool`, `useDuplicateTool`). Phase 2b viewport pan + `useHandTool` (active `H` + modifier `space`) — see `docs/specs/2026-05-03-viewport-and-hand-tool-design.md`. Phase 2c is the active queue item above.

- **Container-rooted scene (unify flat-list and group adapters) — partially superseded by `useScene`.** The arrayAdapter-as-default work shipped (Canvas synthesizes an adapter from `items`/`setItems`/`toPose`/`fromPose`/`createDefault`/`poseBounds`/`intersectsRect` when no explicit `adapter` is passed). It collapses the flat-list boilerplate but is array-shape specific. The deeper move — every scene is a tree rooted at one container — was taken by `useScene` (kit-owned tree with leaf/container) but the inline-props and explicit-adapter tiers still sit alongside rather than collapsed. Full unification (one adapter contract, one default wiring) remains an option for later.

## Pre-1.0 polish

(Extraction has happened — this is the public `weasel` repo. Re-evaluate before 0.1.0.)

- TODO/FIXME scan inside `src/` — *not yet done.*
- JSDoc audit on the barrel (`src/index.ts`) — *not yet done.*
- README pitch — *initial draft landed; the `docs/` long-form sweep was completed (all hook names and import paths match the post-extraction surface).*
