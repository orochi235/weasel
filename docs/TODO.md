# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@orochi235/weasel`). The
kit aims to be a generic 2D scene-graph foundation. Items here are evaluated
for cross-app reuse, not consumer-app value.

For history of completed work that pre-dates extraction, see `git log` and
the dated specs/plans under `specs/` and `plans/`.

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
- **Layer effects framework.** Distinct from `Paint` — effects modify pixels rather than choosing color. Likely shape: `type Effect = { kind: 'shadow' | 'blur' | 'composite' | 'clip' | 'transform'; ... }` plus an `applyEffects(ctx, effects[])` helper that mutates `ctx.shadowBlur`/`filter`/`globalCompositeOperation`/etc before a draw block. Open question on composition model: per-layer `effects?: Effect[]` option vs a wrapper layer (`withEffects(layer, effects)`). Defer until a real use case lands (selection-overlay glow on hover? drop-shadow on dragged objects?). The breadth of canvas effects (shadows, filters, blend modes, clipping, transforms) means the abstraction will over- or under-fit without a concrete first consumer.

## Tier 2 — broad reuse

- **Customizable units.** *Done v1* (`UnitSystem` / `UnitValue`, bare-number = base unit fallback) — see `src/units.ts`. Open follow-ups:
  - **Per-subobject scale.** Today the unit system is global per consumer. Real apps want a child object (a sub-assembly in a CAD scene) to declare its own unit/scale, with conversion at the parent boundary. Likely lives on the parent/group node once Tier 1 #2 lands.
  - **Mixed-unit arithmetic** (`50% + 2ft`) — needs a context to resolve percentages against. Separate design problem.
  - **Per-axis units** — defer until a concrete use case appears (rare; e.g. timeline charts where x is time, y is value).
## Tier 1.5 — small additive hooks

- **Selection-driven action hooks**: shipped against the existing virtual-group adapter and `History` (`useEscape`, `useSelectAll`, `useDuplicate`, `useNudge`, `useDelete`, `useReorder`, `useClipboard`, `useUndoRedo`). Nested-group variants (`useNestedGroup` / `useNestedUngroup`) shipped alongside the original virtual-group `useGroup` / `useUngroup`.
- **Grid overlay snap-target hover.** *Done.* `useGridCellHover` ships the pointer-tracking glue; pair its `getCell` with `createCellHighlightLayer` and the `spacing` your `gridSnapStrategy` already uses.

- **Kit-level `viewTransform` integration on `<Canvas>`.** *What this is for, plainly:* let users zoom and pan the canvas — scroll-wheel to zoom in on detail, click-drag to pan around a scene larger than the viewport, pinch on a trackpad, hit Cmd+0 to reset. Today the kit ships the standalone primitives (`ViewTransform`, `useZoom`, `usePan`, `worldToScreen`, `screenToWorld`) but `<Canvas>` itself ignores them — the rendered pixels are always 1:1 with content units, and pointer events come in as raw canvas coords. The bezier demo's zoom buttons work around this with a CSS scale on a wrapper div, which grows the pixels visually but doesn't actually re-render at higher resolution and doesn't generalize. *Why it's deferred:* the rendering side is one line (`ctx.setTransform(zoom, 0, 0, zoom, panX, panY)` before `runLayers`) but overlays don't want to zoom — selection handles, marquee strokes, and anchor dots should stay a constant screen size regardless of zoom level, otherwise they balloon to absurdity at 4× and vanish at 0.25×. That means a two-pass renderer: scene + grid under the view transform, overlays under identity but positioned via `worldToScreen(...)`. Touches the `RenderLayer.draw` signature (needs a `view` arg), `handleHitRadius` semantics (becomes screen-px instead of world-px), and the default `clientToWorld`. Multi-day; ship when a real second consumer needs it (the bezier demo alone doesn't justify the surface change).

- **`arrayAdapter` as the default Canvas adapter.** Today every demo wires an explicit `adapter={arrayAdapter(...)}` (or hand-rolls one). Half the kit's surface assumes the arrayAdapter shape anyway. Make `adapter` optional — when omitted, Canvas synthesizes one from a smaller required prop set (`items`/`setItems` + `toPose`/`fromPose`, or just an `items` ref + a setter). Demos with the trivial flat-list shape drop the adapter boilerplate entirely; non-trivial cases keep the explicit-adapter escape hatch. Open: name and exact prop surface (`items` + `onChange`? a single `state` prop?), and whether group/ordered scenes get a parallel default or stay explicit.

- **Container layout strategies.** Containers (groups w/ `getChildren`/`setChildOrder`) are first-class, but children are positioned by absolute pose — there's no notion of a layout owned by the container. Real apps want stack/grid/flex strategies on a container so dragging in/out of it reflows siblings. Open scope: (a) ship a `LayoutStrategy<TPose>` interface (`getChildPositions(parent, children)` + drop-target hooks), (b) just expose hooks the consumer wires (`onChildAdded`, `onChildMoved`, `getChildSlot`) and ship one or two reference strategies (vertical stack, uniform grid). Either way needs a story for how the move overlay previews the reflow.

## Tier 3 — specialized but valuable

- **Bezier curves / splines (control-point editing gesture).** A path-capable kit (Tier 1 #1) gives the data shape; what's genuinely new here is the interaction pattern: editing handles on a curve. Specialized resize-like hook with non-corner anchors, plus curve sampling and hit-testing in the renderer. Useful for routing edges in node graphs, illustration, motion paths.
- **Parallax plugin.** Multi-layer canvas where layers translate at different rates relative to the viewport pan. Useful for sketch/concept-canvas backgrounds, depth illusions, mapping, and game-style scenes. Likely a `RenderLayer` factory or thin wrapper over `usePanInteraction` exposing `parallaxFactor` per layer. Plugin form keeps it out of the core. Open question: does it warp `screenToWorld` for hit-testing, or is parallax purely cosmetic?
- **d3 integration plugin.** Bridge the adapter/op model to d3 selections so consumers can drive scene updates from data joins (enter → InsertOp, update → setPose, exit → DeleteOp). Strict plugin form — d3 stays out of the core. Real audience: dashboards, network graphs, force-directed layouts, scientific viz.

## Pre-1.0 polish

(Extraction has happened — this is the public `weasel` repo. Re-evaluate before 0.1.0.)

- TODO/FIXME scan inside `src/` — *not yet done.*
- JSDoc audit on the barrel (`src/index.ts`) — *not yet done.*
- README pitch — *initial draft landed; the `docs/` long-form (concepts/hooks/adapters/extending) still uses pre-extraction `*Interaction` / `*Action` hook names and the old `src/canvas-kit/` paths. Needs a sweep.*
