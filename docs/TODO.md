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

### P1 — foundational genericity gaps

(none currently open)

### P2 — broad reuse / friction-likely

**Viewport**
- Axis-aware elliptical hit shapes under non-uniform zoom → [Viewport](#viewport)

**Paths & booleans**
- Generic CSS cascade for `@weasel-js/svg`'s parser → [Paths & booleans](#paths--booleans)

**Text**
- Cross-browser overlay alignment → [Text](#text)
- Text properties panel (Character + Paragraph) → [Text](#text)

**Scene, adapters & layout**
- `arrayAdapter` as default Canvas adapter — full unification → [Scene, adapters & layout](#scene-adapters--layout)
- Group resize with rotated children → [Scene, adapters & layout](#scene-adapters--layout)
- SceneCanvas → useSceneAdapter for adapter construction → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: AABB-fallback assumes rect-shaped TPose → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: drop rejection signal → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: multi-select drag into a layout container → [Scene, adapters & layout](#scene-adapters--layout)

**Selection, actions & UI panels**
- Per-kind property-row registry for `<PropertiesPanel>` → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Op coalescing in `useScene`'s `LogEntry` history → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Clipboard: OS clipboard / cross-reload serialization → [Selection, actions & UI panels](#selection-actions--ui-panels)

**Plugins & packaging**
- Plugin/bundling convention v1 (`WeaselPlugin` shape) → [Plugins & packaging](#plugins--packaging)
- Barrel-hygiene: selection (pending design review) → [Plugins & packaging](#plugins--packaging)

**Documentation**
- README pitch sweep → [Documentation](#documentation)

---

## Tools & gestures

- **(P3) Remove `adapter.kindOf` escape hatch.** Shipped 2026-05-21: kit-owned `NodeKindRegistry` per `<SceneCanvas>`, populated via the `kinds` prop, derives `adapter.kindOf` for the dispatcher and Canvas read sites. Spec: `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`. Plan: `docs/superpowers/plans/2026-05-21-node-kind-registry.md`. **Follow-up:** in the next minor, delete the deprecated `adapter.kindOf` escape hatch. Current readers to migrate: `src/tools/dispatcher.ts:33` (`buildAffordanceTarget`), `src/canvas/SceneCanvas.tsx:928` (node resolver), and `apps/draw` svg interop (`svgExport.ts` / `svgInterop.ts`). Audit `demo/` and `apps/` consumers for the field before deletion. Kind information now flows via `getNodeAtPoint`'s Hit return value (see `src/canvas/getNodeAtPoint.ts`); the dispatcher could read Hit's `kind` field instead of `adapter.kindOf` as part of the cleanup.

- **(P3) Convergence-target facets.** Each kind-keyed concern (label/icon, propertyRows, bindings, subkinds, serialize/deserialize) lands as its own per-trait registry per the **node-traits reframe** at `docs/superpowers/specs/2026-05-24-node-traits-reframe-design.md` (which superseded the 2026-05-22 facets spec). The routing trait's registry (`src/core/scene/NodeRouting.ts`) is reframed; the other per-trait registries are still open. Tracked individually under the relevant TODO sections (per-kind property-row registry, default action icons).

- **(P3) Reshape `selectionOverlay` into a thin override hook.** The chrome-affordances spec shipped (2026-06-13): the multi-resize union now has a single owner — `ChromeState.unionBounds` — which both the affordance hit-tester (`affordanceAt` / `composeAffordanceLayer`) and the overlay layer read at draw time. The inline `poseById` re-derivations in `Canvas`/`SceneCanvas` are deleted, `createSelectionOverlayLayer` resolves the synthetic union from the draw-time chromeState envelope, and `MULTI_RESIZE_TARGET_ID` moved to `core/selection/` (fixing the backwards `affordances→tools` import). Residual: the synthetic-id plumbing (`getSelection` → `[MULTI_RESIZE_TARGET_ID]`, `getOutlineIds` → real members) still lives in the Canvas/SceneCanvas wiring rather than inside `createSelectionOverlayLayer`. Fold it into the layer so the slot is purely a consumer override hook.

- **(P3) Consolidate the two affordance hit-test mechanisms.** Selection chrome is hit-tested two ways: `composeAffordanceLayer`'s `RenderLayer.hitTest` walk (reached via `tools.getActiveOverlays()`, which is why `<SceneCanvas>` mounts the rotate tool as `ambient`) and `affordanceAt`/`buildAffordanceAt` (a chromeState-based classifier in `<SceneCanvas>`). Both now resolve resize/rotate/anchor targets from `ChromeState`, so they overlap. Pick one. This subsumes the former "affordances of registered-but-not-active tools" item: `affordanceAt` already makes built-in selection/resize/rotate/anchor chrome hittable cross-tool with no ambient registration (LassoDemo no longer registers select as `ambient`), and the audit of other chrome families (anchor-edit dots gated by `path-edit.anchors`; snap-highlights / debug-rings visualization-only) came back clean. The only uncovered case is surfacing an *arbitrary third-party tool's* affordances cross-tool — no consumer needs that today.

- **(P3) Image / future drag-insert tools.** Deferred from `docs/specs/2026-05-05-drag-insert-primitive-design.md`. The consolidated `useDragRect` + `useInsert` + `defineDragInsertTool` stack is built so adding new drag-insert tools is a thin Tool veneer. Polygon, star, ellipse, and line tools have since landed (`src/tools/builtin/{polygon,star,ellipse,line}/`); image-insert is the main remaining type, and each new tool is its own task.

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

- **(P3) Forward insert `index` through app publisher adapters.** `SliceDepPublisher.insertNode` drops the `index` arg when calling `scene.add`, identical to `BooleansAdapterPublisher.insertNode` and the canonical `sceneAdapter.insertNode`. In the real app the journal path (installed by `useModality`) places ops, so the inline adapter is not consulted and this is moot; it only affects the no-journal fallback. If undo re-insertion position ever regresses, forward `index` in all three adapters together.
- **(P3) Dep-aware `enabled` for `sliceAction`.** `sliceAction.enabled` returns `true` unconditionally. The action declares `requires: ['slice']` and its `onEnd` no-ops when the dep is absent, so behavior is safe, but a UI reading `enabled()` would show Slice enabled even when no slice dep is wired. Reflect dep presence if/when a consumer surfaces action-enabled state for slice.
- **(P3) Bézier-preserving + concave finite-cut (Approach B).** v1 flattens béziers on cut pieces and an infinite-line half-plane clip can over-cut concave shapes the finite stroke only partly crosses (pinned in `splitByLine.test.ts`). `splitPathByLine` is the single swap point for a chord-split Approach B + `schneiderFit` curve re-fitting.

---

## Viewport

- **(P2) Axis-aware elliptical hit shapes under non-uniform zoom.** Surfaced 2026-05-16 by the per-axis zoom landing. ~50 chrome hit-test sites today use `pxRadius / meanScale(view.scale)` (geometric-mean fallback). At non-uniform zoom this projects a circular screen-pixel hit region to an ellipse in world space — visually accurate handles but the pickable region is slightly too large along one axis and slightly too small along the other. Fix: refactor `composeAffordanceLayer` and the per-tool ad-hoc hit-tests (`penEdit/hitOverride`, `usePenTool` close-hit, `useSelectTool` multi-resize, snap-guide trigger zones) to either compare against an ellipse `(dx/rx)² + (dy/ry)² < 1` or transform the hit-test into screen space. Grid hairline strokes (`1 / meanScale(view.scale)`) have no obvious axis-aware analog — separate judgment call. Worth ~1 day; deferred from per-axis-zoom v1 spec to keep the migration atomic.

- **(P3) Typed discriminated union for multi-type insert.** Deferred from `docs/specs/2026-05-07-viewport-followups-design.md`. Current shape splits into `posefromBounds(bounds) → TPose` + `pointInsert(point) → TNode` (`src/interactions/actions/insert/options.ts`); multi-type canvases (rect vs image vs ellipse from one `<SceneCanvas>`) wire their own `tools` array (one `useInsertTool` per type) rather than folding a variant switch into the insert options. Revisit if a real consumer wants the single-canvas multi-type ergonomic.

---

## Paths & booleans

- **(P2) Generic CSS cascade for `@weasel-js/svg`'s parser.** Surfaced 2026-05-13 importing the Ghostscript tiger — `<g fill="...">` groups containing `<path>` elements with no direct fill were falling back to black. The targeted fix has since shipped: `packages/svg/src/parse.ts:432` `readInheritedAttr` walks up parents (honoring `inherit`/absence), plus `style=` parsing and inherited stroke/width. That's the per-attr walk-up the deeper refactor replaces — SVG has a long list of inheritable presentation attributes — paint (fill/stroke/fill-rule/fill-opacity/stroke-opacity), stroke decoration (linecap/linejoin/miterlimit/dasharray/dashoffset), font-* (family/size/weight/style/text-anchor/letter-spacing/decoration), color (for `currentColor` resolution), opacity, visibility, display, color-interpolation, image-rendering, shape-rendering, text-rendering, clip-rule, clip-path, mask, filter, marker-*. Per-attr walk-up code accumulates as the matrix grows; the right answer is **threading a cascading style context down through the recursive parse**: at each element, compute "current cascade" = parent cascade + element's own attrs + style attr; leaf parsers read from the threaded context, not from the DOM. Browser-only fast path could use `getComputedStyle` against a hidden DOM node, with the threaded-context fallback for Node/jsdom tests.

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

- **(P3) Layer effects framework.** Distinct from `FillStyle` — effects modify pixels rather than choosing color. Under WebGL each effect is its own pass: drop-shadow needs a blurred render-to-texture beneath, blur needs a separable kernel, blend modes need framebuffer compositing, clipping needs stencil. Likely shape: `type Effect = { kind: 'shadow' | 'blur' | 'composite' | 'clip' | 'transform'; ... }` consumed by the renderer (not the layer) so each effect knows how to set up its own GL state. Open question on composition model: per-layer `effects?: Effect[]` option vs a wrapper layer (`withEffects(layer, effects)`). Defer until a real use case lands.

- **(P3) Promote `ShaderDrawCommand` past `@experimental`.** Three real consumers now exist (plasma / ripple / voronoi panels), enough to validate the surface. Open questions before stabilization: (a) array uniform binding shape — currently consumers must pass per-slot keys (`u_ripples[0]`, `u_ripples[1]`, …); should the kit accept a flat `Float32Array` and split it? (b) hot-reload story for `registerProgram` re-registration; (c) how to expose the renderer's program registry without leaking internals (`shaders` prop is the seam, but consumers writing custom RenderLayers may want more).

- **(P3) `extractUniformNames` regex coverage.** Currently handles scalar uniforms and `T name[N];` arrays. Doesn't handle: matrix arrays (`mat3 u_xforms[4];`), GLSL preprocessor branches, nested struct uniforms, or layout qualifiers on the LHS. Bite-the-bullet rewrite probably wants a small GLSL-prelude parser. Defer until a consumer hits a gap.

---

## Text

- **(P2) Cross-browser overlay alignment.** `placeOverlay` uses an empirical `(+1, -1)` CSS-px nudge to compensate for canvas/CSS rasterization disagreement. Works on the dev setup; not universally correct across browsers/fonts/DPRs. A self-correcting probe was attempted and rejected.

- **(P2) Text properties panel** (Character + Paragraph). Surfaced 2026-05-11 while wiring `useTextEdit` into WeaselDraw — the kit ships rich `TextStyle` + `StyledRun` data and `useTextEdit` already handles bold/italic via the runs API, but there's no UI surface for any of it. A `@weasel-js/ui` `<TextPropertiesPanel>` (paralleling `<PropertiesPanel>` / `<PathfinderPanel>`) reading from selection and dispatching style/run mutations would close the gap. Coverage to design: font family (system + web fonts), font size, font weight, italic / underline / strikethrough toggles, fill color, caret/selection colors, line height, letter spacing / tracking (new — not on `TextStyle` yet), paragraph alignment, and per-range run styling on the active text-edit selection. Open questions: (a) split into Character vs Paragraph panels (Illustrator-style) or one combined panel for v1; (b) whether the panel binds to selection or to `editingId` (Illustrator binds to both); (c) how to expose run-level mutators publicly; (d) which fields need new `TextStyle` keys (letter-spacing/tracking, decoration). Likely a multi-day spec once a real consumer demands it.

- **(P3) Complex-script text shaping (HarfBuzz).** `src/features/text/atlas/GlyphLayout.ts` walks codepoints linearly and applies BmFont kerning pairs — sufficient for Latin / Cyrillic / Greek / CJK ideographs, wrong for Arabic / Devanagari / Thai / any script needing contextual shaping or reordering. Real fix is wiring a HarfBuzz WASM build (harfbuzzjs ~1MB) behind a feature flag so consumers who only need Latin can stay slim. Touches the layout pipeline only; the renderer already takes pre-laid glyphs. Defer until a real consumer hits a non-Latin language requirement.

- **(P3) eric `labelHelpers.ts` deletion check.** Investigate whether eric (`~/src/eric`) can delete its local `labelHelpers.ts` after the text world-unit pass landed. If consumer-side world-unit helpers still cover gaps the primitives don't (e.g. world↔screen pad conversion at the call site), capture the remaining gap as a follow-up primitive proposal.

- **(P3) `markdownToRuns` → AST.** Consider whether markdown markup (today `*`/`**`/`***` bold/italic toggles, parsed with flat boolean state in `src/features/text/runs.ts:64`) should be promoted to a structured AST. The output is a flat `StyledRun[]`, not a tree. Defer to a future "rich text" pass — the current shape is sufficient for label/markdown rendering but limits reformatting / re-styling transforms.

---

## Scene, adapters & layout

- **(P2) `arrayAdapter` as the default Canvas adapter — full unification.** Partial work shipped: Canvas synthesizes an adapter from `items`/`setItems`/`toPose`/`fromPose`/`createDefault`/`poseBounds`/`intersectsRect` when no explicit `adapter` is passed. It collapses the flat-list boilerplate but is array-shape specific. The deeper move — every scene is a tree rooted at one container — was taken by `useScene` (kit-owned tree with leaf/container) but the inline-props and explicit-adapter tiers still sit alongside rather than collapsed. Full unification (one adapter contract, one default wiring) remains an option for later.

- **(P2) Group resize with rotated children.** Today: AABB-frame fallback (`expandIds` + `RECT_POSE_DESCRIPTOR.remapBounds` axis-aligned scale; no per-leaf local-frame handling). Needs proper per-leaf scale handling in the leaf's local frame, mirroring the existing single-rotated-leaf math.

- **(P3) SceneCanvas → useSceneAdapter for adapter construction.** Surfaced 2026-05-21 during the node-kind registry landing. Today `SceneCanvas` constructs its synthesized adapter inside `useSceneSelectTool` (the select-tool hook), which means every new `SceneToAdapterOptions` field (`layouts`, `cascadeContainerPose`, `kindOf`, …) has to be drilled through the hook's surface. `useSceneAdapter` already exposes the full options shape; lifting adapter construction to `SceneCanvas` and handing the result down would stop the drill-through and shrink `useSceneSelectTool`'s API. Out of scope for the registry work; file when next refactoring the SceneCanvas internals.

### `useScene` follow-ups

- **(P3) Container layout strategies in `useScene`** (today: absolute-positioning only).
- **(P3) Selection-in-Scene vs external.**
- **(P3) Tree-mutation invariants documented explicitly** (`remove(container)` cascade, `move` cycle detection, `setLayer` on container). All three are already pinned by tests in `src/core/scene/scene.test.ts`; the remaining gap is explicit prose documentation.
- **(P3) Full tier unification** (collapse inline-props/explicit-adapter onto Scene). Same effort as the P2 "`arrayAdapter` as the default Canvas adapter — full unification" above — track there.
- **(P3) Container-pose cascade as a scene-primitive semantic.** Today opt-in via `sceneToAdapter({ cascadeContainerPose: 'rect' })` shipped 2026-05-11 to absorb NestingDemo boilerplate — the deeper move is letting `scene.setPose` on a container cascade natively, which would require a `translatePose` plumbing decision on the `useScene` constructor.

### Container layout strategies (deferred from `docs/specs/2026-05-03-container-layout-strategies-design.md`)

> **Status note (2026-06-15): layout reflow is reconnected to the live action path.** `moveAction` consults the `layout` dep during single-node drags (`runLayoutPass`), folds destination + source reflow poses into the preview-ghost channel, and on commit emits the strategy's `commitDrop` ops + a cross-container reparent + source-reflow ops. The `LayoutStrategy` methods were renamed `childPoses` / `reflowPoses`, and the orphaned `MoveOverlay` type was deleted. See `docs/superpowers/specs/2026-06-15-revive-container-layout-reflow-design.md`. The bullets below are the genuinely-deferred remainder.
>
> Two follow-ups surfaced during the revival:
> - **`nodeAtPoint` is missing from `moveAction.requires`**, so the dispatcher's `buildDeps` leaves `ctx.deps.nodeAtPoint` undefined — the opt-in `reparentOnDrop` param (the non-layout reparent path) is silently inert end-to-end. Add `'nodeAtPoint'` to `requires`. A `moveAction — reparentOnDrop` unit suite exists (`move.test.ts:402`) but injects `nodeAtPoint` into deps manually, bypassing `buildDeps` — so a dispatcher-level end-to-end test is the real remaining coverage.
> - **Reparent-on-layout-drop lives in `moveAction`, not the strategies' `commitDrop`** (which are pose-only). If a strategy ever needs container-specific reparent semantics, revisit whether `commitDrop` should own it.

- **(P2) AABB-fallback assumes rect-shaped TPose.** When `LayoutStrategy.contains` is absent, `moveAction`'s `runLayoutPass` hit-test (`testInside`) reads `pose.x/y/width/height` directly. For non-rect TPose (e.g. `Path`) the call is broken. Either (a) require `contains` on every `LayoutStrategy<NonRectPose>`, (b) thread a `PoseDescriptor` through the layout pass to derive an AABB, or (c) document the constraint and lint it.
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

- **(P3) Tiled-content layer primitive.** Surfaced 2026-05-17 by the ParallaxDemo loop work (`4c0e98ef`). The demo's local `tiledProject` helper walks every visible copy of a shape along a periodic x axis, giving seamless infinite-pan looping for free. Generalized shape: a `createTiledLayer<TData>({ source, period, axis? })` wrapper that takes any RenderLayer and produces a periodic version, with `tiledProject(visStart, visEnd, period)` as a public helper. Composes cleanly with `createParallaxLayer`. Open questions: 2D wrap (`period: number | { x, y }`); period as a function of view/dims vs constant; per-shape vs per-layer period. Demo today: `demo/demos/ParallaxDemo.tsx`. Likely lives at `src/features/tiling/` or alongside `createParallaxLayer` in `src/features/parallax/`.

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

- **(P3) Silhouette area-select for geometry-in-`data` shapes.** The 2026-06-20 geometry-migration #3 made marquee/lasso area-select silhouette-aware (`src/canvas/deps/hitTestArea.ts`, kernel `pointInPolygon`/`segmentsCross`), but it reads geometry from the **pose** only (`(pose as PolygonPath).coords`). So it fires for polygon-pose consumers and `geometryProjection`-synced nodes, but is inert for the kit's own inserted shapes (rect/ellipse/polygon/star/line/pencil), which store geometry in `node.data.path`/`data.shape` behind a plain `{x,y,w,h}` pose → these take the AABB fast-path. This is **not a regression** (the old rect-only `hitTestAABB` was equally AABB-only for them), but the silhouette benefit isn't realized for default kit geometry. Follow-up: route `hitTestArea`'s silhouette branch through `findShapeSilhouette`/`node.data` (world-frame; mind the coordinate frame) so kit-produced shapes also drop AABB false-positives. Either that or make `geometryProjection` the default so the pose always carries the silhouette.

- **(P2) Per-kind property-row registry for `<PropertiesPanel>`.** Surfaced 2026-05-13 while wiring object-kind-aware property rows in WeaselDraw's selection panel. Today `<PropertiesPanel>` is a presentation slot — every consumer hand-rolls property rows inline and branches on `primary.tool` / ad-hoc feature flags (`hasStrokeProps`, etc.) to decide what to render. Likely shape: kinds register a property-row contributor that takes the current selection + adapter and returns an array of `<PropertyRow>` children; the panel composes contributors for the union of selected kinds. Open questions: (a) registration site — kit-side keyed off the future object-kind registry vs. a consumer-owned `Map<kind, PropertyContributor>` passed to `<PropertiesPanel>` as a prop; (b) interplay with kit-shipped panels like `<TextPropertiesPanel>` / `<PathfinderPanel>`; (c) how to express rows that apply to a subset of the selection; (d) presentation order. Blocked on the object-kind registry. Defer until ≥2 consumer apps want this.

- **(P3) Alignment guides — v1 follow-ups.** Auto-derived alignment guides shipped 2026-06-19 (`src/features/guides/alignment/`: `deriveAlignmentGuides` + `matchAlignment` + `alignMoveBehavior`/`alignInsertBehavior`/`alignResizeBehavior`, rendered via `createGuidesLayer`; demo `demo/demos/AlignmentGuidesDemo.tsx`). Spec: `docs/superpowers/specs/2026-06-19-alignment-guides-design.md`. Multi-select drag alignment shipped 2026-06-19 (`alignMoveBehavior` matches the selection's union AABB via `unionBounds`). Remaining deferred: (a) **Figma-style segment rendering** — line spanning only between the aligned objects with end ticks / offset labels, instead of full-canvas lines (needs a span-aware layer, not just axis+offset); (b) **equal-spacing / distribution guides** ("equal gaps" across 3+ objects); (c) **rotated-object alignment** — derivation/matching use AABBs, so a rotated object aligns by its bounding box.

- **(P2) Op coalescing in `useScene`.** Default `coalesceKey`s landed at the op factories (`transform`/`setText`/`setLayer`/`setPath` now default `<name>:${id}`, joining `reparent`), so the standalone `@weasel-js/history` path coalesces without per-call boilerplate when a consumer sets `coalesceWindowMs > 0`. Remaining: `useScene`'s internal undo log (`scene.ts`) is a separate `LogEntry` history (`{kind, payload}[]`, no `coalesceKey` notion) that ignores coalescing entirely — `Op.coalesceKey` is lost when ops translate to scene mutations. Wiring it needs the coalesce-eligibility + window logic ported into `pushEntry` plus a way to thread the key from the originating `Op` into the `LogEntry`.

- **(P2) Clipboard: OS clipboard / cross-reload serialization.** Currently the kit's clipboard is in-memory only — copy doesn't reach the system clipboard, and reloading drops the buffer. Needs a serialization shape (likely the same op-log shape useScene wants) plus `navigator.clipboard` plumbing with a JSON wire format.


- **(P3) `<ToggleBar>` polish.** Shipped to `@weasel-js/ui` (spec/plan dated 2026-05-17). Visual still needs polish — literally, polish this.

### Align/distribute/flip follow-ups

- **(P3) Flip pivot policy on the actions registry adapter.** `useFlip`'s `pivot` flows through; bare `defaultFlipActions` deps could surface it.
- **(P3) Cursor-relative align** (e.g. align to mouse position rather than union).
- **(P3) Selection-handles-locked alignment** (align relative to the dragged corner during a resize gesture).

### Debug overlay follow-ups

- **(P3) Per-feature *style* configuration.** Per-feature *color* config already shipped (`DebugConfig.theme` → flat `DebugTheme` color map, `src/debug/types.ts`). Remaining: per-feature line-width / dash style.
- **(P3) Debug overlay for hand/zoom tools.**
- **(P3) Printable snapshot mode** — rasterize debug + scene to a single image for bug reports.
- **(P3) FPS panel extensions** — ms-per-frame readout alongside FPS, draw-call count per frame, per-layer draw-cost breakdown (needs renderer-side instrumentation seams).

### WeaselDraw app follow-ups (defer)

- **(P3) Gradient fills.** Alpha/opacity shipped (`setFillOpacity`/`setStrokeOpacity` + opacity slider); gradient fill-style for objects remains. (Stroke-width control also shipped — now an editable `PropertyNumberInput`, not hardcoded.)
- **(P3) Palette presets / recently-used colors.**
- **(P3) Multi-page documents.**
- **(P3) Richer text style controls** (font, size, weight pickers).
- **(P3) `loadInitial` restores only leaf nodes — groups/nesting lost on reload.** Surfaced 2026-06-19 while wiring history persistence. `apps/draw/src/App.tsx` `loadInitial` filters `n.kind === 'leaf'` and drops `parent`, flattening every node onto the `'default'` layer. So containers (Cmd+G groups) and any parent/child nesting don't survive a page reload even though `scene.toJSON()` persists the full tree. Fix: rebuild the full node list (containers + parent links + layers) from the snapshot via `scene.loadState(json)` instead of the leaf-only map. Independent of the history-persistence work.

---

## Plugins & packaging

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

- **(P3) Demo coverage gap: HUD widget gallery.** `@weasel-js/hud` ships five widgets (`button`, `rect`, `text`, `image`, `label`) but only `button` is demo'd (`demo/demos/HudDemo.tsx`) — a single "HUD widget gallery" demo card would cover the other four. Brainstorm scope before writing it. (The former `@weasel-js/ui` `CommandPalette`/`PropertiesPanel` half of this item was dropped — those are app-local components in `apps/draw/src/ui/`, not `@weasel-js/ui` exports, so there's no kit-export demo gap.)

### Canvas / SceneCanvas seam

Seam refactor landed 2026-05-24 (plan: `docs/superpowers/plans/2026-05-24-canvas-scenecanvas-seam.md`). After the refactor, `<Canvas>` is a coherent scene-agnostic primitive — WebGL surface + viewport (pinch zoom) + pointer routing + slot composition. Selection, picking, kind registry, scene-aware overlays all live in `<SceneCanvas>`. `<Canvas>` is `@internal` / `@deprecated` and no longer exported from the public barrel (2026-06-19) — it's now private. Internal consumers import it directly from `src/canvas/Canvas`.

---

## Backends (WebGL future)

From the WebGL transition spec — all deferred:

- **(P3) WebGPU backend.** Separate future spec.
- **(P3) Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win, significant API complexity. Defer until measured pain on the single-thread pipeline. (Note: `OffscreenCanvas` is already used on the main thread for pattern-tile rasterization in `src/features/patterns/` — that's not worker offload; the worker move is the open item.)
- **(P3) Exotic composite operations** (xor, custom Porter-Duff) via framebuffer pingpong — deferred from v1 GL.
- **(P3) Headless server-side rendering** (Node + headless-gl) — possible but not a v1 commitment.

(WebGL1 fallback explicitly rejected — WebGL2 only.)

---

## Release-gate & build hygiene

- **(P3) Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one is desired. Today's barrel test asserts ops/shape-kinds/bundles parity; public exports remain uncovered.

- **(P3) `gen:font` script.** Was at `packages/gl/scripts/gen-font.ts`; deleted in Step 10. If we ever regenerate the Inter MSDF atlas, restore the script under `scripts/gen-font.ts` at repo root using `msdf-bmfont-xml`. The current atlas was regenerated cleanly so the script is not on the critical path.

- **(P3) Last 4 React `act()` warnings in CI vitest.** The June 2026 sweep took the `ci.yml` "not wrapped in act(...)" count 200 → 4 (and killed the ~91 jsdom `getContext` stack dumps); see `vitest.setup.ts` (global `getContext` stub) and the test-side `act()` wrapping. The remaining 4 all come from `src/canvas/SceneCanvas.tools.test.tsx`'s *"omitted defaultTools: resize is registered"* test — a SceneCanvas-internal deferred update from the resize-gesture commit that resists every test-side `act()` strategy tried (async microtask flush, `setTimeout(0)` macrotask flush, dispatching the whole down→move→up gesture inside one `act()`). A real fix has to live in SceneCanvas's update scheduling, not the test. Note: these warnings only reproduce under CI (ubuntu/worker timing), not locally — verify via the `ci.yml` log. Low value; defer.

- **(P3) Wire `test:perf` into a CI gate.** `animation-stress.spec.ts` was moved out of the visual suite into `tests/perf/` (own Playwright config + `npm run test:perf`) so its timing-sensitive mean-cycle assertion stops red-lighting `visual.yml`. It now runs in **no** CI workflow — it's a manual diagnostic. If we want regression coverage for renderer lag/crash-freedom, add a manual `workflow_dispatch` (or nightly) job that runs `test:perf`; keep it off the per-push path since the perf threshold flakes on shared runners.

---

## Documentation

- **(P2) README pitch sweep.** Initial draft landed; the `docs/` long-form sweep was completed (all hook names and import paths match the post-extraction surface). A re-pass before 0.1.0.

- **(P3) JSDoc audit at definition sites.** A one-pass sweep at definition sites for any public export still lacking a JSDoc string. (Barrel section headers already landed in `src/index.ts`; per-symbol JSDoc lives at original definitions.) File a follow-up if a specific export turns up undocumented.

---

## Cosmetic cleanup

- **(P3) Registry unification leftover.** Stale `bindingsOverrideDrag` comments and test naming in `src/canvas/SceneCanvas.smoke.test.tsx`, `src/canvas/SceneCanvas.useSelectTool.integration.test.tsx`, several `src/tools/builtin/use*Tool/*.tsx` comments, and live test names in `src/tools/builtin/{insert,text}/use*Tool.test.ts` — rename when next in the area.
