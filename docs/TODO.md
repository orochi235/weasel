# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@orochi235/weasel`). The
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

- Kit-owned object-kind registry → [Tools & gestures](#tools--gestures)

### P2 — broad reuse / friction-likely

**Tools & gestures**
- Multi-mode chrome interaction → [Tools & gestures](#tools--gestures)
- Phase 5 cleanup of chrome-affordances spec → [Tools & gestures](#tools--gestures)
- Affordances of registered-but-not-active tools → [Tools & gestures](#tools--gestures)
- Audit other chrome violations (visible-is-hittable) → [Tools & gestures](#tools--gestures)
- `useTextTool` synthesized adapter ergonomic → [Tools & gestures](#tools--gestures)

**Viewport**
- Axis-aware elliptical hit shapes under non-uniform zoom → [Viewport](#viewport)
- Kit-level `viewTransform` zoom integration on `<Canvas>` → [Viewport](#viewport)

**Paths & booleans**
- Paths hot-loop perf hardening → [Paths & booleans](#paths--booleans)
- Generic CSS cascade for `@orochi235/weasel-svg`'s parser → [Paths & booleans](#paths--booleans)

**Rendering & paint**
- Renderer: accept CSS color formats beyond hex → [Rendering & paint](#rendering--paint)

**Text**
- Cross-browser overlay alignment → [Text](#text)
- Text properties panel (Character + Paragraph) → [Text](#text)

**Scene, adapters & layout**
- `arrayAdapter` as default Canvas adapter — full unification → [Scene, adapters & layout](#scene-adapters--layout)
- Group resize with rotated children → [Scene, adapters & layout](#scene-adapters--layout)
- `useScene`: op log serialization shape → [Scene, adapters & layout](#scene-adapters--layout)
- `useScene`: user-layer mutation methods → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: AABB-fallback assumes rect-shaped TPose → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: drop rejection signal → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: multi-select drag into a layout container → [Scene, adapters & layout](#scene-adapters--layout)
- Layout strategies: tool overlay rendering of reflowed siblings → [Scene, adapters & layout](#scene-adapters--layout)

**Selection, actions & UI panels**
- Promote `<ToolPalette>` into `@orochi235/weasel-ui` → [Selection, actions & UI panels](#selection-actions--ui-panels)
- `<ActionBar>` component in `@orochi235/weasel-ui` → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Default action icons → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Per-kind property-row registry for `<PropertiesPanel>` → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Declarative visibility rules for overlay chrome → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Alignment guides / insert snap-to-existing-edges → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Op coalescing follow-ups (`useScene`, default `coalesceKey`s) → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Clipboard: OS clipboard / cross-reload serialization → [Selection, actions & UI panels](#selection-actions--ui-panels)
- Swillustrator persistence → [Selection, actions & UI panels](#selection-actions--ui-panels)

**Plugins & packaging**
- Plugin/bundling convention v1 (`WeaselPlugin` shape) → [Plugins & packaging](#plugins--packaging)
- Barrel-hygiene: selection (pending design review) → [Plugins & packaging](#plugins--packaging)

**Demos & visual regression**
- `ShapeToolsDemo` visual-regression baseline → [Demos & visual regression](#demos--visual-regression)
- Drop `Canvas` public export (next minor) → [Demos & visual regression](#demos--visual-regression)

**Release-gate & build hygiene**
- Demo build not in `prepublishOnly` → [Release-gate & build hygiene](#release-gate--build-hygiene)
- `src/import-shims/` ↔ `tsup.config.ts` parity test → [Release-gate & build hygiene](#release-gate--build-hygiene)

**Documentation**
- README pitch sweep → [Documentation](#documentation)

---

## Tools & gestures

- **(P1) Kit-owned object-kind registry.** Surfaced 2026-05-12 by the declarative tool routing spec (`docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`). Today the kit is intentionally domain-agnostic about node payloads (`data: unknown`), so it has no native way to know a node is a "rect" vs a "text" vs a "path". The declarative routing tables key on target kinds (`'rect'`, `'text:selected'`, `'anchor:first'`); without a registry the kit punts to `'unknown'` and consumers wire their own classifier via the adapter. That works but moves a chunk of the routing contract into consumer space — every app reinvents "what counts as a rect." Likely shape: the kit exposes `registerNodeKind(name, classifier)` (or similar) — consumers register `'rect'`/`'text'`/`'path'` once with classifier functions that inspect `data`; the dispatcher consults the registry during hit-test enrichment to produce `target.kind`. Affordance kinds (`'handle:bottom-right'`, `'anchor:first'`) come from the affordance pipeline itself, not the registry. Open: whether the registry is mutable at runtime, whether kinds carry default presentation metadata (icons for the layer panel?), and how this composes with `useScene`'s layer system. Blocks proper consumer ergonomics on the declarative routing migration — Phase 1 ships a `kindOf?: (id) => string` adapter hook as a temporary contract; the registry replaces it.

- **(P2) Multi-mode chrome interaction.** Corner-resize and rotation affordances correctly hit-test for `MULTI_RESIZE_TARGET_ID` in multi-mode, but their drag wrappers return null for the synthetic id because `useResize`/`useRotate` don't natively handle the multi-target. Fix is a multi-target resize path (probably per-leaf scale via remapBounds, mirroring the existing group-resize math) — its own spec.

- **(P2) Phase 5 cleanup of chrome-affordances spec.** The migration in Phase 3-4 left two behaviors split between Canvas and `useSelectTool`: (a) Canvas still synthesizes the multi-resize union via `poseById` + `MULTI_RESIZE_TARGET_ID` for the selection-overlay slot, and (b) `useSelectTool`'s affordances render `[]` to avoid double-rendering with the Canvas slot. Phase 5 should drop the Canvas synthesis (ChromeState.unionBounds replaces it), flip the affordances back to real `render`, and reshape the `selectionOverlay` slot into a thin override hook.

- **(P2) Affordances of registered-but-not-active tools.** Today the dispatcher walks `tools.getActiveOverlays()` for affordance hit-tests, which only surfaces the active/hotkey/ambient slots' overlays — not arbitrary registered tools. To get selection chrome hittable while a non-select tool is active, the consumer has to register the select tool as `ambient` (see `LassoDemo` after the chrome-affordances spec). The architectural cleanup is to surface ALL registered tools' affordances cross-tool; deferred because changing `getActiveOverlays` broke `omits modifier overlay when not engaged` semantics. File a separate spec when it bites.

- **(P2) Audit other chrome violations against the visible-is-hittable principle.** Spec `docs/superpowers/specs/2026-05-10-chrome-affordances-design.md` shipped corner-resize + rotation as cross-tool-hittable affordances. Other chrome families that may render while a non-owning tool is active and need the same migration: anchor-edit dots (`useEditAnchorsTool`) — visible during anchor-edit mode; snap-target highlights (`createCellHighlightLayer`) — currently visualization only, file a follow-up if hover ever becomes interactive; debug-overlay hit-rings — visualization only, principle satisfied. Each chrome family with a real interactive surface gets its own follow-up spec.

- **(P2) `useTextTool`'s synthesized adapter ergonomic.** `useTextTool` synthesizes its own `InsertAdapter` and threads `ctx.applyBatch` via a ref because the click-first ergonomic doesn't expose an adapter to the consumer. After the May 5 drag-insert primitive landed, the capture-and-clear is owned by `defineDragInsertTool` (not duplicated in the wrapper) but the underlying asymmetry remains. Revisit if a third drag-insert tool would benefit from a unified ergonomics story (e.g. accept either an adapter *or* an inline factory).

- **(P3) Image / polygon / future drag-insert tools.** Deferred from `docs/specs/2026-05-05-drag-insert-primitive-design.md`. The consolidated `useDragRect` + `useInsert` + `defineDragInsertTool` stack is built so adding new drag-insert tools is a thin Tool veneer, but each tool is its own task.

- **(P3) Promote `hitExistingGate` to gate select-tool's move/resize paths.** Deferred from `docs/specs/2026-05-05-drag-insert-primitive-design.md`. Different responsibility (gating mutation gestures rather than insertion), different gesture surface — punt until a real consumer wants it.

- **(P3) Evaluate `useResize`/`useRotate` against `useDragGesture`.** Deferred from `docs/specs/2026-05-05-drag-gesture-base-design.md`. After the dragRect/move migration landed, evaluate whether resize and rotate fit cleanly on the new base. Their state shapes (per-id pose map keyed by handle/center, multi-target union AABB) are different from move's flat pose map and may not benefit. Revisit only if/when their scaffolding diverges from the base in a way that costs maintenance.

### Pen tool follow-ups

From `docs/specs/2026-05-03-pen-tool-design.md`:

- **(P3) Snap-to-existing-anchors** (cross-path anchor snapping). Clicking near an existing path's anchor would coalesce. Useful for stitching paths.
- **(P3) Mid-creation editing of placed anchors.** Append-only in v1 — to fix mistakes, finish the path and re-enter via BezierEdit. Drag-on-placed-anchor during creation embeds the BezierEdit gesture into pen creation (significant scope).
- **(P3) Continue an existing path's open endpoint.** Click an existing open path's first/last anchor to pick it up and append. Adjacent to mid-creation editing.
- **(P3) Compound-path with open middle subpath.** v1 enforces "open subpath must be the last." Mixing open/closed in arbitrary order in a single multi-contour path needs a third Enter meaning (or a separate keybind for "open this subpath without committing").
- **(P3) Click-on-existing-anchor-to-edit during creation.** Same scope as mid-creation editing; deferred together.

### Tool overlay channel deferrals

From `docs/specs/2026-05-03-tool-overlay-channel-design.md`:

- **(P3) Per-overlay z-positioning.** v1 always renders tool overlays on top. Add `overlayPosition?: 'top' | 'before-selection' | 'after-selection'` field to the Tool record when a real consumer wants overlay chrome below selection handles (e.g. a snap-target highlight that should sit behind handles).
- **(P3) Multiple overlays per Tool.** Today `Tool.overlay` is a single `RenderLayer`. If composing multiple visually distinct layers into one `draw` becomes painful, promote to `overlay?: RenderLayer | RenderLayer[]`.
- **(P3) Subscription / push model.** Today the channel is pull (Canvas asks each frame, scratch is read via React closure). If a tool needs to push state changes outside the React render cycle, add an imperative `tools.publishOverlay(toolId, layer)` channel.

---

## Viewport

- **(P2) Axis-aware elliptical hit shapes under non-uniform zoom.** Surfaced 2026-05-16 by the per-axis zoom landing. ~50 chrome hit-test sites today use `pxRadius / meanScale(view.scale)` (geometric-mean fallback). At non-uniform zoom this projects a circular screen-pixel hit region to an ellipse in world space — visually accurate handles but the pickable region is slightly too large along one axis and slightly too small along the other. Fix: refactor `composeAffordanceLayer` and the per-tool ad-hoc hit-tests (`penEdit/hitOverride`, `usePenTool` close-hit, `useSelectTool` multi-resize, snap-guide trigger zones) to either compare against an ellipse `(dx/rx)² + (dy/ry)² < 1` or transform the hit-test into screen space. Grid hairline strokes (`1 / meanScale(view.scale)`) have no obvious axis-aware analog — separate judgment call. Worth ~1 day; deferred from per-axis-zoom v1 spec to keep the migration atomic.

- **(P2) Kit-level `viewTransform` integration on `<Canvas>` — zoom phase.** *Pan-only integration shipped in Tool primitive Phase 2b (hand tool); this tracks the **zoom** half.* Let users zoom and pan the canvas — scroll-wheel to zoom in on detail, click-drag to pan around a scene larger than the viewport, pinch on a trackpad, hit Cmd+0 to reset. Today the kit ships the standalone primitives (`ViewTransform`, `useZoom`, `usePan`, `worldToScreen`, `screenToWorld`) but `<Canvas>` itself ignores them — rendered pixels are 1:1 with content units, pointer events come in as raw canvas coords. The bezier demo's zoom buttons work around this with a CSS scale on a wrapper div, which grows pixels visually but doesn't actually re-render at higher resolution. The rendering side is one line (`ctx.setTransform(...)` before `runLayers`) but "what stays constant under zoom" forks two ways:

  - **Kit-owned chrome** (selection handles, marquee, anchor dots, rotation handle): the kit can decide, and "screen-px constant" is unambiguous. Implies a two-pass renderer: scene + grid layers under the view transform, overlays under identity computing positions via `worldToScreen(...)`.
  - **Consumer-drawn scene** (path strokes, fills, lineWidths): the kit *can't* decide because it's domain-dependent. Illustrator/Figma scale strokes with zoom; map/diagramming tools pin strokes to screen-px. So the kit must hand the consumer enough info to pick — concretely, `drawOne(ctx, obj, pose)` gains a `view` arg.

  Surface impact: `RenderLayer.draw` signature (needs a `view` arg), `SceneSlotConfig.drawOne` signature (gains `view`), `handleHitRadius` semantics (becomes screen-px), default `clientToWorld` routes through `screenToWorld`. Multi-day; ship when a real second consumer needs it.

- **(P3) `insertTool.create` typed discriminated union for multi-type insert.** Deferred from `docs/specs/2026-05-07-viewport-followups-design.md`. Current shape is a single factory `(bounds) => { pose, data, id? } | null`; multi-type canvases (rect vs image vs ellipse from one `<SceneCanvas>`) wire their own `tools` array (one `useInsertTool` per type) rather than folding a variant switch into `create`. Revisit if a real consumer wants the single-canvas multi-type ergonomic.

---

## Paths & booleans

- **(P2) Paths hot-loop perf hardening.** Making paths first-class trades V8 monomorphization for polymorphism in interaction hot loops. Plan: (1) verify the `RectPath` discriminated subtype short-circuits in the polygon kernels (O(1) AABB + hit), (2) audit pointer-move paths for per-frame allocation (resize-preview ghost vertices are the worst offender — likely needs in-place mutation or `Float32Array` ghost buffers), (3) benchmark rect-only and polygon-only scenes against a pre-paths baseline, (4) fix any regression > ~10% before sunsetting any remaining rect-only fast paths.

- **(P2) Generic CSS cascade for `@orochi235/weasel-svg`'s parser.** Surfaced 2026-05-13 importing the Ghostscript tiger — `<g fill="...">` groups containing `<path>` elements with no direct fill were falling back to black because the parser only reads `el.getAttribute(attr)` at leaf time. A targeted fix patches fill/stroke/opacity inheritance plus `style=` attribute parsing, but SVG has a long list of inheritable presentation attributes — paint (fill/stroke/fill-rule/fill-opacity/stroke-opacity), stroke decoration (linecap/linejoin/miterlimit/dasharray/dashoffset), font-* (family/size/weight/style/text-anchor/letter-spacing/decoration), color (for `currentColor` resolution), opacity, visibility, display, color-interpolation, image-rendering, shape-rendering, text-rendering, clip-rule, clip-path, mask, filter, marker-*. Per-attr walk-up code accumulates as the matrix grows; the right answer is **threading a cascading style context down through the recursive parse**: at each element, compute "current cascade" = parent cascade + element's own attrs + style attr; leaf parsers read from the threaded context, not from the DOM. Browser-only fast path could use `getComputedStyle` against a hidden DOM node, with the threaded-context fallback for Node/jsdom tests.

### Pathfinder follow-ups (post-v1)

Core five + Crop shipped. Remaining:

- **(P3) Outline.** Stroke-to-fill silhouette — needs proper offsetting with joins/caps/self-intersection cleanup. No lightweight JS lib without major deps.
- **(P3) Trim and Merge.** Remove hidden portions / Trim + same-color reunion — need per-path style awareness, which the kit deliberately doesn't have since `data` is opaque. Wait on a compound-path-with-styles model.
- **(P3) Non-destructive boolean groups.** Figma-style "boolean group" container node that recomputes geometry from children at render time. Requires a new layer/scene-node type plus renderer support.
- **(P3) True curve booleans.** v1 flattens beziers before clipping; the result is straight-line. Skia/PathKit-style curve-preserving booleans are next-level — substantially harder.
- **(P3) Live preview during the gesture.** Holding the op key while hovering a path to see the result before committing.
- **(P3) Boolean ops on stroked paths.** Treat a stroke as a filled region, then clip. Blocked on stroke-to-fill (round/bevel/miter joins, end caps — its own design problem).
- **(P3) Pathfinder against text glyphs.** Needs glyph-to-path extraction.

- **(P3) Bezier curves / splines (control-point editing gesture).** A path-capable kit gives the data shape; what's genuinely new here is editing handles on a curve. Specialized resize-like hook with non-corner anchors, plus curve sampling and hit-testing in the renderer. Useful for routing edges in node graphs, illustration, motion paths.

---

## Rendering & paint

- **(P2) Renderer: accept CSS color formats beyond hex.** Surfaced 2026-05-17 building `D3SortableDemo`. `parseColor` rejects everything outside its narrow accepted set — `hsl(0, 65%, 55%)` threw `parseColor: unrecognized color`. Workaround was a precomputed hex palette in the demo, but every consumer reaching for a color library will hit the same wall. Specifically painful for the d3 plugin's `.tween()` escape (d3-interpolate produces `rgb(r, g, b)` strings).

  What to support:
  - All hex variants (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`)
  - `rgb(r, g, b)` / `rgba(r, g, b, a)` (number + percent forms)
  - `hsl(h, s%, l%)` / `hsla(...)`
  - Named CSS colors (~140 names) — useful for quick demos
  - Stretch: `oklch()` / `color()` function syntax

  Either hand-rolled parser (~150 lines, zero deps) or `d3-color` (~30 lines wiring, complete coverage but couples kit core to a d3 package). Lean toward hand-rolled for kit independence. Cache parsed colors by string identity (`Map<string, [r, g, b, a]>`).

- **(P3) Layer effects framework.** Distinct from `FillStyle` — effects modify pixels rather than choosing color. Under WebGL each effect is its own pass: drop-shadow needs a blurred render-to-texture beneath, blur needs a separable kernel, blend modes need framebuffer compositing, clipping needs stencil. Likely shape: `type Effect = { kind: 'shadow' | 'blur' | 'composite' | 'clip' | 'transform'; ... }` consumed by the renderer (not the layer) so each effect knows how to set up its own GL state. Open question on composition model: per-layer `effects?: Effect[]` option vs a wrapper layer (`withEffects(layer, effects)`). Defer until a real use case lands.

- **(P3) Promote `ShaderDrawCommand` past `@experimental`.** Three real consumers now exist (plasma / ripple / voronoi panels), enough to validate the surface. Open questions before stabilization: (a) array uniform binding shape — currently consumers must pass per-slot keys (`u_ripples[0]`, `u_ripples[1]`, …); should the kit accept a flat `Float32Array` and split it? (b) hot-reload story for `registerProgram` re-registration; (c) how to expose the renderer's program registry without leaking internals (`shaders` prop is the seam, but consumers writing custom RenderLayers may want more).

- **(P3) `extractUniformNames` regex coverage.** Currently handles scalar uniforms and `T name[N];` arrays. Doesn't handle: matrix arrays (`mat3 u_xforms[4];`), GLSL preprocessor branches, nested struct uniforms, or layout qualifiers on the LHS. Bite-the-bullet rewrite probably wants a small GLSL-prelude parser. Defer until a consumer hits a gap.

---

## Text

- **(P2) Cross-browser overlay alignment.** `placeOverlay` uses an empirical `(+1, -1)` CSS-px nudge to compensate for canvas/CSS rasterization disagreement. Works on the dev setup; not universally correct across browsers/fonts/DPRs. A self-correcting probe was attempted and rejected.

- **(P2) Text properties panel** (Character + Paragraph). Surfaced 2026-05-11 while wiring `useTextEdit` into Swillustrator — the kit ships rich `TextStyle` + `StyledRun` data and `useTextEdit` already handles bold/italic via the runs API, but there's no UI surface for any of it. A `@orochi235/weasel-ui` `<TextPropertiesPanel>` (paralleling `<PropertiesPanel>` / `<PathfinderPanel>`) reading from selection and dispatching style/run mutations would close the gap. Coverage to design: font family (system + web fonts), font size, font weight, italic / underline / strikethrough toggles, fill color, caret/selection colors, line height, letter spacing / tracking (new — not on `TextStyle` yet), paragraph alignment, and per-range run styling on the active text-edit selection. Open questions: (a) split into Character vs Paragraph panels (Illustrator-style) or one combined panel for v1; (b) whether the panel binds to selection or to `editingId` (Illustrator binds to both); (c) how to expose run-level mutators publicly; (d) which fields need new `TextStyle` keys (letter-spacing/tracking, decoration). Likely a multi-day spec once a real consumer demands it.

- **(P3) Complex-script text shaping (HarfBuzz).** `src/features/text/atlas/GlyphLayout.ts` walks codepoints linearly and applies BmFont kerning pairs — sufficient for Latin / Cyrillic / Greek / CJK ideographs, wrong for Arabic / Devanagari / Thai / any script needing contextual shaping or reordering. Real fix is wiring a HarfBuzz WASM build (harfbuzzjs ~1MB) behind a feature flag so consumers who only need Latin can stay slim. Touches the layout pipeline only; the renderer already takes pre-laid glyphs. Defer until a real consumer hits a non-Latin language requirement.

- **(P3) eric `labelHelpers.ts` deletion check.** Investigate whether eric (`~/src/eric`) can delete its local `labelHelpers.ts` after the text world-unit pass landed. If consumer-side world-unit helpers still cover gaps the primitives don't (e.g. world↔screen pad conversion at the call site), capture the remaining gap as a follow-up primitive proposal.

- **(P3) `parseMarkdownRuns` → AST.** Consider whether `[`/`(`/`]`/`)` markup should be promoted to a structured AST (today the output is a flat list of tokenized runs with composed factors, not a tree). Defer to a future "rich text" pass — the current shape is sufficient for label/markdown rendering but limits reformatting / re-styling transforms.

---

## Scene, adapters & layout

- **(P2) `arrayAdapter` as the default Canvas adapter — full unification.** Partial work shipped: Canvas synthesizes an adapter from `items`/`setItems`/`toPose`/`fromPose`/`createDefault`/`poseBounds`/`intersectsRect` when no explicit `adapter` is passed. It collapses the flat-list boilerplate but is array-shape specific. The deeper move — every scene is a tree rooted at one container — was taken by `useScene` (kit-owned tree with leaf/container) but the inline-props and explicit-adapter tiers still sit alongside rather than collapsed. Full unification (one adapter contract, one default wiring) remains an option for later.

- **(P2) Group resize with rotated children.** Today: dev warning + AABB-frame fallback. Needs proper per-leaf scale handling in the leaf's local frame, mirroring the existing single-rotated-leaf math.

### `useScene` follow-ups

- **(P2) Op log serialization shape** for built-in ops.
- **(P2) User-layer mutation methods** (`addLayer`/`removeLayer`/`renameLayer`/`moveLayer`).
- **(P3) Container layout strategies in `useScene`** (today: absolute-positioning only).
- **(P3) Selection-in-Scene vs external.**
- **(P3) Tree-mutation invariants documented explicitly** (`remove(container)` cascade, `move` cycle detection, `setLayer` on container).
- **(P3) Full tier unification** (collapse inline-props/explicit-adapter onto Scene).
- **(P3) Container-pose cascade as a scene-primitive semantic.** Today opt-in via `sceneToAdapter({ cascadeContainerPose: 'rect' })` shipped 2026-05-11 to absorb NestingDemo boilerplate — the deeper move is letting `scene.setPose` on a container cascade natively, which would require a `translatePose` plumbing decision on the `useScene` constructor.

### Container layout strategies (deferred from `docs/specs/2026-05-03-container-layout-strategies-design.md`)

- **(P2) AABB-fallback assumes rect-shaped TPose.** When `LayoutStrategy.contains` is absent, `useMove`'s layout hit-test reads `pose.x/y/width/height` directly. For non-rect TPose (e.g. `Path`) the call is broken. Either (a) require `contains` on every `LayoutStrategy<NonRectPose>`, (b) thread a `PoseDescriptor` through the layout pass to derive an AABB, or (c) document the constraint and lint it.
- **(P2) Drop rejection signal.** v1 layout commits a free-space `setPose` when no container accepted a drag. Needs a cleaner semantic — candidates: a dedicated cancel op, a snap-back-to-source-pose path, or having the source layout's `commitDrop` re-place the child at its origin slot.
- **(P2) Multi-select drag into a layout container.** Currently falls through to the per-id transform batch (no `commitDrop` invocation, no sibling reflow). Layout-aware commit only fires when `ctx.draggedIds.length === 1`. Decide multi-select-into-layout semantics (sequential commitDrops? grouped layout API?) before lifting the guard.
- **(P2) Tool overlay rendering of reflowed siblings.** `MoveOverlay` now publishes `hypotheticalChildPositions` / `sourceReflowPositions`, but `useSelectTool`'s overlay doesn't yet draw them. Wire the select tool's overlay to render hypothetical poses (likely as ghosts).
- **(P3) Z-order walk doesn't cross non-container ancestors.** Open question: when a deep layout container is BELOW (in z) a shallow layout container that shares the dragged point, today the deepest wins — debate whether real z-order across the whole tree (flat painter's order) should win instead. Decide once a consumer hits the case.
- **(P3) Tile-grid overflow policy.** Children beyond `cols * rows` are skipped from `getChildPositions`. Real apps may want scroll, grow-grid, or rejection — pick once a consumer asks.
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

- **(P2) Promote `<ToolPalette>` into `@orochi235/weasel-ui`.** Today it lives at `apps/swillustrator/src/ui/ToolPalette/` — ~140 lines including roving-tabindex keyboard nav. Generic enough for the kit; every consumer rewrites it otherwise. The kit already ships `<ToolButton>` + `<ToolGroup>` building blocks; the palette is the composed shell.

- **(P2) `<ActionBar>` component in `@orochi235/weasel-ui`.** Generic group-keyed action toolbar, parallel to `<ToolPalette>`. Reads `actions.list().filter(a => a.group === groupKey)` and renders icon-buttons with `Action.label` as title, `Action.shortcut` as keystroke hint, disabled state from `evaluateEnabled`. Replaces the hand-rolled `<PathfinderPanel>` / hypothetical `<AlignPanel>` / `<DistributePanel>` with one composable surface.

- **(P2) Default action icons.** `Action.icon` is in the schema but `defaultAlignActions` / `defaultDistributeActions` don't ship default SVGs. The right move is shipping `defaultBooleanActions` + default-iconed align/distribute factories so a generic `<ActionBar group="pathfinder">` (or `"align"` / `"distribute"`) can render the row without per-app SVGs. ~8 icons to draw (6 align, 2 distribute) plus the 5 boolean icons already inline in `PathfinderPanel`.

- **(P2) Per-kind property-row registry for `<PropertiesPanel>`.** Surfaced 2026-05-13 while wiring object-kind-aware property rows in Swillustrator's selection panel. Today `<PropertiesPanel>` is a presentation slot — every consumer hand-rolls property rows inline and branches on `primary.tool` / ad-hoc feature flags (`hasStrokeProps`, etc.) to decide what to render. Likely shape: kinds register a property-row contributor that takes the current selection + adapter and returns an array of `<PropertyRow>` children; the panel composes contributors for the union of selected kinds. Open questions: (a) registration site — kit-side keyed off the future object-kind registry vs. a consumer-owned `Map<kind, PropertyContributor>` passed to `<PropertiesPanel>` as a prop; (b) interplay with kit-shipped panels like `<TextPropertiesPanel>` / `<PathfinderPanel>`; (c) how to express rows that apply to a subset of the selection; (d) presentation order. Blocked on the object-kind registry. Defer until ≥2 consumer apps want this.

- **(P2) Declarative visibility rules for overlay chrome.** Today, conditional visibility for selection-overlay parts (handles, rotation handle, etc.) is wired imperatively per-call-site or via per-feature `gateLayer` wrappers. A more durable shape would be a small declarative DSL: "don't display rotation handles unless the direct parent has focus", "show alignment guides only when shift is held", "hide handles during an active gesture". Open questions: where the rules live, what state inputs they read, how they compose with kit defaults vs. consumer overrides. Defer until 3+ concrete cases want this.

- **(P2) Alignment guides / insert snap-to-existing-edges.** Shows snap lines when an inserted/moved object's edge or center aligns with a sibling's. Slot for a new `SnapStrategy` plus an overlay layer. Originally scoped in `docs/specs/2026-04-30-canvas-kit-resize-insert-design.md:278`.

- **(P2) Op coalescing follow-ups.** Wire matching coalescing into `useScene`'s internal `pushEntry` (it uses a different `LogEntry` shape, not `Op`); auto-set `coalesceKey` defaults at op factories (`transform:${id}`, `setText:${id}`) so consumers get coalescing without per-call boilerplate.

- **(P2) Clipboard: OS clipboard / cross-reload serialization.** Currently the kit's clipboard is in-memory only — copy doesn't reach the system clipboard, and reloading drops the buffer. Needs a serialization shape (likely the same op-log shape useScene wants) plus `navigator.clipboard` plumbing with a JSON wire format.

- **(P2) Swillustrator persistence.** Currently in-memory only — no save/load/export.

- **(P3) `<ToggleBar>` polish.** Shipped to `@orochi235/weasel-ui` (spec/plan dated 2026-05-17). Visual still needs polish — literally, polish this.

### Align/distribute/flip follow-ups

- **(P3) Flip pivot policy on the actions registry adapter.** `useFlip`'s `pivot` flows through; bare `defaultFlipActions` deps could surface it.
- **(P3) Cursor-relative align** (e.g. align to mouse position rather than union).
- **(P3) Selection-handles-locked alignment** (align relative to the dragged corner during a resize gesture).

### Debug overlay follow-ups

- **(P3) Per-feature color/style configuration.**
- **(P3) Debug overlay for hand/zoom tools.**
- **(P3) Printable snapshot mode** — rasterize debug + scene to a single image for bug reports.
- **(P3) FPS panel extensions** — ms-per-frame readout alongside FPS, draw-call count per frame, per-layer draw-cost breakdown (needs renderer-side instrumentation seams).

### Swillustrator app follow-ups (defer)

- **(P3) Stroke-width control** (today hardcoded to 1px).
- **(P3) Fill-style options beyond solid** (gradient, alpha).
- **(P3) Palette presets / recently-used colors.**
- **(P3) Multi-page documents.**
- **(P3) Richer text style controls** (font, size, weight pickers).

---

## Plugins & packaging

### Plugin/bundling convention

The kit's primitives are already pluggable — what's missing is a convention for bundling a feature's parts so a single `useFooPlugin()` call returns `{ tool, layers, ops, ... }` that the consumer spreads in, instead of wiring three or four separate exports per feature.

- **(P2) Lightweight v1:** a documented `WeaselPlugin = { tool?, layers?, behaviors?, ... }` shape plus a `mergePluginConfig(...plugins)` helper. ~30 lines + a docs page. Defer until we have ≥2 plugin-shaped features in flight (pen, debug overlay, future grid) — designing before multiple examples risks YAGNI.
- **(P3) Heavier v2** (only if needed for true third-party plugins): Canvas lifecycle hooks (mount/unmount/pre-render/post-render), capability/version negotiation against kit semver, sub-package layout (`@orochi235/weasel-pen`?). Don't pursue without a real third-party consumer asking.

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

- **(P3) Document & lightly unify the system-registries pattern.** Surfaced 2026-05-12. The kit already maintains ≥8 registries with very different lifecycles: fonts, tools, ops, actions, easings, shader programs, Canvas custom layers, and the coming kit-owned object-kind registry. A grand unification is probably wrong — lifecycles and mutability differ enough. Two lower-risk moves: (a) write a `docs/concepts.md` section "System registries" cataloging every registry with consistent fields (name, scope, lifecycle, API, reflection?), and (b) ship a small `createReflectable<T>()` utility for the cross-cutting reflection concern (debug overlay enumeration, conflict detection). Promote "pick one shape per scope category" only after 3+ registries in the same category exist.

---

## Demos & visual regression

- **(P2) `ShapeToolsDemo` visual-regression baseline.** `demo/demos/ShapeToolsDemo.tsx` has been live since the shape-tools landing but its baseline PNG was never captured. Run `gh workflow run visual-update.yml` + `gh run download <id>` per CONTRIBUTING.md; commit the resulting `tests/visual/baselines/shape-tools.png`.

- **(P3) Demo coverage gaps for submodules.** `@orochi235/weasel-ui` exports `CommandPalette` and `PropertiesPanel` but has no demo card for either (CommandPalette is used in the harness chrome itself — surfacing it as a demo would expose it). `@orochi235/weasel-hud` ships five widgets (`button`, `rect`, `text`, `image`, `label`) but only `button` is demo'd — a single "HUD widget gallery" demo card would cover the other four. Brainstorm scope per demo before writing them.

### Canvas-internal-only migration

Surfaced 2026-05-16 building the force-graph demo. Bare `<Canvas>` with a custom RenderLayer reading mutating refs has no scene-mutation signal — the only way to drive 60Hz repaints is forcing React re-renders, which churns the tools machinery enough to wedge the canvas after settle. `Canvas` was marked `@internal` / `@deprecated` (this minor); README no longer points consumers at it.

- **(P2) Drop the public `Canvas` export entirely** in the next minor. Currently retained for one cycle with a CHANGELOG deprecation note. Internal consumers (`SceneCanvas`, test files) keep importing it directly from `src/canvas/Canvas`.

---

## Backends (WebGL future)

From the WebGL transition spec — all deferred:

- **(P3) WebGPU backend.** Separate future spec.
- **(P3) Worker-thread offload** via `OffscreenCanvas` rendering in a worker — major perf win, significant API complexity. Defer until measured pain on the single-thread GL pipeline.
- **(P3) Exotic composite operations** (xor, custom Porter-Duff) via framebuffer pingpong — deferred from v1 GL.
- **(P3) Headless server-side rendering** (Node + headless-gl) — possible but not a v1 commitment.

(WebGL1 fallback explicitly rejected — WebGL2 only.)

---

## Release-gate & build hygiene

- **(P2) Demo build not in `prepublishOnly`.** `prepublishOnly` runs `tsc --noEmit && vitest run && tsup build` but skips `build:demo`. The demo build uses vite (different resolution path: `@orochi235/weasel/<x>` aliases to `src/import-shims/<x>.ts`), and silent drift surfaced 2026-05-14 when `src/import-shims/routing.ts` was missing — tsup happily produced `dist/routing.js` via its own entry config, but vite couldn't resolve the import for the demo. Either chain `build:demo` into `prepublishOnly`, or add a separate CI gate that runs it.

- **(P2) `src/import-shims/` ↔ `tsup.config.ts` parity test.** Every subpath listed in `tsup.config.ts` `entry` (and every key in `package.json` `exports`) needs a matching `src/import-shims/<name>.ts` shim so vite's wildcard alias resolves. A 5-line parity test (read tsup entries, read package.json exports, list `src/import-shims/`, assert sets match) would prevent the drift class above.

- **(P3) Bundle Inspector — public-exports inventory.** Curated list of public exports if/when one is desired. Today's barrel test asserts ops/shape-kinds/bundles parity; public exports remain uncovered.

- **(P3) `gen:font` script.** Was at `packages/weasel-gl/scripts/gen-font.ts`; deleted in Step 10. If we ever regenerate the Inter MSDF atlas, restore the script under `scripts/gen-font.ts` at repo root using `msdf-bmfont-xml`. The current atlas was regenerated cleanly so the script is not on the critical path.

---

## Documentation

- **(P2) README pitch sweep.** Initial draft landed; the `docs/` long-form sweep was completed (all hook names and import paths match the post-extraction surface). A re-pass before 0.1.0.

- **(P3) JSDoc audit at definition sites.** Section headers landed throughout the 721-line barrel (`src/index.ts`); per-symbol JSDoc lives at original definitions. Remaining: a one-pass sweep at definition sites for any public export still lacking a JSDoc string. File a follow-up if a specific export turns up undocumented.

---

## Cosmetic cleanup

- **(P3) Registry unification leftover.** Stale `bindingsOverrideDrag` comments and test naming in `src/canvas/SceneCanvas.smoke.test.tsx`, `src/canvas/SceneCanvas.useSelectTool.integration.test.tsx`, and several `src/tools/builtin/use*Tool/*.tsx` files — rename when next in the area.
