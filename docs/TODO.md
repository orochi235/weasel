# canvas-kit / weasel TODO

Backlog for the canvas-kit framework (published as `@orochi235/weasel`). The
kit aims to be a generic 2D scene-graph foundation. Items here are evaluated
for cross-app reuse, not consumer-app value.

For history of completed work that pre-dates extraction, see `git log` and
the dated specs/plans under `specs/` and `plans/`.

## Tier 1 — foundational genericity gaps

Without these, the kit is essentially "axis-aligned-rectangle kit."

- **Paths and compound shapes.** `TPose` is generic at the type level but resize/insert/area-select/selection-overlay all bake in `{x, y, width, height}` math. Generalize to arbitrary paths: polygons, polylines, holes, boolean composition. Move + hit-testing + selection overlay all need a path-aware contract. Foundational for any non-rect editor (diagrams, schematics, illustration, mapping).
- **Groupable objects.** First-class group node: select-as-one, move-as-one, transform children relative to group origin. Universal across diagramming and illustration tools. *Status:*
  - Virtual groups (lasso-style `members[]` records, no scene-graph change) ship with `useGroupAction` / `useUngroupAction` and resize-as-group.
  - Structural groups (real hierarchy nodes) ship as `useStructuralGroupAction` / `useStructuralUngroupAction`, backed by `composeWorldPose` / `rebaseLocalPose`. Adapter contract now declares poses as **local** (relative to direct parent); the kit composes world via the helper. Children's locals are auto-rebased on group/ungroup so visual world position is preserved.
  - Open follow-ups: `useMoveInteraction` could grow auto-cascade so dragging a group with a structurally-grouped child shifts the child's world without the consumer rebasing. (Snap behaviors stay local-frame by design — see project memory; selection-overlay composer shipped as `worldPoseLookup`.)
- **Text rendering.** *Largely done.* `createTextLayer`, `useTextEditInteraction`, `createSetTextOp`, `pointInTextPose`, and `TextStyle` (with caret/selection theming) ship; in-place edit via a contenteditable overlay is wired through op/undo. Open follow-ups:
  - **Glyph-position hit testing.** Currently hit-tests the whole pose rect; per-glyph hit-testing (for caret placement on click into existing text) is not implemented.
  - **Cross-browser overlay alignment.** `placeOverlay` uses an empirical `(+1, -1)` CSS-px nudge to compensate for canvas/CSS rasterization disagreement. Works on the dev setup; not universally correct across browsers/fonts/DPRs. A self-correcting probe was attempted and rejected.
  - **Auto-sizing.** Pose width/height are caller-managed; no hook to grow the pose to fit the text. Likely lives in the consumer for now.
- **Gradient paint variants.** `Paint` is a tagged union with `solid` and `pattern` today. Adding `linear-gradient` and `radial-gradient` variants is a non-breaking extension when a real consumer asks. Each gradient type has many dials (color stops, color-space interpolation, angle vs vector, focal point for radial); design against a concrete call site rather than speculatively.
- **Layer effects framework.** Distinct from `Paint` — effects modify pixels rather than choosing color. Likely shape: `type Effect = { kind: 'shadow' | 'blur' | 'composite' | 'clip' | 'transform'; ... }` plus an `applyEffects(ctx, effects[])` helper that mutates `ctx.shadowBlur`/`filter`/`globalCompositeOperation`/etc before a draw block. Open question on composition model: per-layer `effects?: Effect[]` option vs a wrapper layer (`withEffects(layer, effects)`). Defer until a real use case lands (selection-overlay glow on hover? drop-shadow on dragged objects?). The breadth of canvas effects (shadows, filters, blend modes, clipping, transforms) means the abstraction will over- or under-fit without a concrete first consumer.

## Tier 2 — broad reuse

- **Customizable units.** *Done v1* (`UnitSystem` / `UnitValue`, bare-number = base unit fallback) — see `src/units.ts`. Open follow-ups:
  - **Per-subobject scale.** Today the unit system is global per consumer. Real apps want a child object (a sub-assembly in a CAD scene) to declare its own unit/scale, with conversion at the parent boundary. Likely lives on the parent/group node once Tier 1 #2 lands.
  - **Mixed-unit arithmetic** (`50% + 2ft`) — needs a context to resolve percentages against. Separate design problem.
  - **Per-axis units** — defer until a concrete use case appears (rare; e.g. timeline charts where x is time, y is value).
## Tier 1.5 — small additive hooks

- **Selection-driven action hooks**: shipped against the existing virtual-group adapter and `History`. When structural groups (Tier 1) land, `useGroupAction` / `useUngroupAction` will compose additional ops (reparent children under the new group node) but the hook surface should not need to change.
- **Grid overlay snap-target hover.** *Done.* `useGridCellHover` ships the pointer-tracking glue; pair its `getCell` with `createCellHighlightLayer` and the `spacing` your `gridSnapStrategy` already uses.

## Tier 3 — specialized but valuable

- **Bezier curves / splines (control-point editing gesture).** A path-capable kit (Tier 1 #1) gives the data shape; what's genuinely new here is the interaction pattern: editing handles on a curve. Specialized resize-like hook with non-corner anchors, plus curve sampling and hit-testing in the renderer. Useful for routing edges in node graphs, illustration, motion paths.
- **Parallax plugin.** Multi-layer canvas where layers translate at different rates relative to the viewport pan. Useful for sketch/concept-canvas backgrounds, depth illusions, mapping, and game-style scenes. Likely a `RenderLayer` factory or thin wrapper over `usePanInteraction` exposing `parallaxFactor` per layer. Plugin form keeps it out of the core. Open question: does it warp `screenToWorld` for hit-testing, or is parallax purely cosmetic?
- **d3 integration plugin.** Bridge the adapter/op model to d3 selections so consumers can drive scene updates from data joins (enter → InsertOp, update → setPose, exit → DeleteOp). Strict plugin form — d3 stays out of the core. Real audience: dashboards, network graphs, force-directed layouts, scientific viz.

## Pre-extraction polish

(Tracked here so `subtree split` carries them. Re-evaluate before 0.1.0.)

- TODO/FIXME scan inside `src/`.
- JSDoc audit on the barrel (`src/index.ts`).
- README pitch draft for the public-facing repo.
