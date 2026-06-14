# Eric ↔ Weasel parity audit — 2026-05-07

Audit of `~/src/eric` (the side-app weasel was extracted from on 2026-05-01) against `~/src/weasel` to find divergence, local kit copies, prior-art interactions, and API gaps.

## TL;DR

Eric is in good shape as a weasel consumer. There is **no surviving fork of kit source** — eric was the donor and the extraction left only consumer-app code behind. Almost every "kit-shaped" file under `src/canvas/` is now an *adapter* / *behavior* / *layer* that imports from `@weasel-js/core`, not a duplicate. Build and tests both pass against the local `file:../weasel` link. The most notable deltas are a handful of **drag-lab strategies that exist only in eric** (subgrid, slot-based, quadtree) and an entire **`src/geometry/` boolean-ops module** built on `clipper2-ts` — both of which are prior art worth pulling back into weasel's roadmap, not bug-fix-style merges.

---

## Build status

- `npm run build` (`tsc -b && vite build`) — **passes** in 225 ms with the only warnings being upstream `highs` / chunk-size noise unrelated to weasel.
- `npm test` — **passes**, 120 files / 816 tests / 1 skipped, ~6 s. Some `localStorage`-availability experimental warnings from `node` but no failures.
- TypeScript strict typecheck via `tsc -b` is clean (no diagnostics).

## Weasel version used vs current

| | value |
|---|---|
| eric `package.json` dep | `"@weasel-js/core": "file:../weasel"` |
| weasel `package.json` `version` | `0.1.0` |

Eric is on a path-link, so it always tracks whatever's in `~/src/weasel` HEAD. There is no published version pin to fall behind. (`peerDependencies.react: ">=18"` from weasel is satisfied by eric's React 19.2.4.)

## Local copies of kit code

Searched `~/src/eric/src/` for files that look like duplicated kit internals — by name (`labelHelpers`, `viewTransform`, `useZoom`, `arrayAdapter`, `placeOverlay`, `gridSnapStrategy`, `wheelHandler`, `clientToCanvas`, `sceneAdapter`) and by relative-import patterns / "copied from weasel" comments. No matches; the only source comment trail is `docs/canvas-kit/plans/2026-05-01-weasel-extraction.md` (the extraction plan itself).

The files under `src/canvas/`, `src/canvas/tools/`, `src/canvas/layers/`, `src/canvas/drag/`, `src/canvas/adapters/` *look* kit-shaped because they're the same vocabulary, but they are eric-specific implementations that compose weasel exports. Concrete examples:

| File in eric | What it looks like | Status |
|---|---|---|
| `src/canvas/patterns.ts` | a kit `patterns-builtin` re-export | **Domain wrapper.** Wraps `hatch/crosshatch/dots/chunks` with garden's palette defaults + caches `CanvasPattern`s. Header comment explicitly explains the kit stays domain-agnostic; this stays in eric. No merge needed. |
| `src/canvas/tools/snapMoveBehaviors.ts` | a kit `MoveBehavior` lib | **Consumer behaviors.** Imports `snapToGrid` / `snapBackOrDelete` from `@weasel-js/core/move` and adapts them to garden semantics (per-structure `snapToGrid: false`, alt bypass, plantings-only snap-back). Stays in eric. |
| `src/canvas/tools/structureMoveBehaviors.ts` | another kit `MoveBehavior` lib | **Consumer behaviors.** Union-AABB clamp + clash detect against `gardenStore`. Header notes the workaround for the missing `MoveBehavior.onMoveAll` hook (already on weasel's TODO Tier 1.5). |
| `src/canvas/tools/useEricSelectTool.ts` etc. | kit-style `defineTool` consumers | Use `defineTool`, `useMove`, `useAreaSelect`, `useDragRect` from weasel as designed. No duplication. |
| `src/canvas/layers/*LayersWorld.ts` | a kit `RenderLayer` factory pack | Garden-specific layers (zones, plantings, structures, tray, optimizer ghosts). Each imports `RenderLayer` type from weasel and returns its own draw closures. No merge needed. |
| `src/canvas/layers/visibilityWrap.ts` | could plausibly be generic | **Marginal.** Wraps a `RenderLayer[]` so each layer's `draw` short-circuits when `defaultVisible=false`/per-id flag is off. ~30 LOC; uses only `RenderLayer`. *Could* graduate to weasel as a tiny utility, but it's coupled to a runtime visibility-map convention eric owns. Low priority. |
| `src/canvas/layers/renderLayerRegistry.ts` | could plausibly be generic | **Marginal.** Sidebar-side `useSyncExternalStore` registry of which layers are mounted — purely UX scaffolding for eric's `RenderLayersPanel`. Stays in eric. |
| `src/canvas/layers/worldLayerData.ts` | re-declares `View` | **Notable.** The comment at the top says: `Camera-coords viewport. Mirrors @weasel-js/core's internal View (not exported from the package index).` This is the only place eric reaches around the public API. See "API gaps" below. |
| `src/hooks/useViewMoving.ts`, `src/hooks/useGardenOffscreen.ts` | look generic | Both read directly from `useUiStore` / `useGardenStore` (eric stores), so they're not portable as-is. The `useViewMoving` *concept* (debounced "is the view in motion?" boolean) is mildly interesting and could ship from weasel keyed on a `View`, but pretty thin. |
| `src/canvas/drag/useDragController.ts` + `*Drag.ts` siblings | a kit putative-drag framework | **Eric-only abstraction.** Phase-1/2 putative-drag controller that coexists with weasel's `useDragGesture`. The `moveDrag.ts` header explicitly notes it's an "Option A façade over weasel's `useMove`" because the move gesture lives inside a Tool. This is exploratory eric code; not appropriate to merge without further design. See "Interaction patterns" below. |
| `src/canvas/debug.ts` | kit-shaped | Eric-only `?debug=…` query-string token parser. Weasel has its own `parseDebugFlags` in `src/debug/` already; this one's tied to eric's renderLayers UX. Stays in eric. |
| `src/geometry/` (entire dir) | could be a kit module | **Not in weasel.** Boolean ops + offset + minkowski + flatten over `clipper2-ts`. See "Interaction patterns" — candidate for a future `@weasel-js/core/geometry` subpath, but only after weasel is willing to take a runtime dep. |
| `src/drag-lab/strategies/{quadtree,subgrid,slot-based}.ts` | kit-style layout strategies | **Not in weasel.** Weasel's `layout/strategies/` only has `freeform`, `snapPoint`, `tileGrid`. See "Interaction patterns." |

**Summary:** zero forked kit files; ~3 marginal candidates for graduation (`visibilityWrap`, `useViewMoving`, possibly `worldLayerData.View`); two larger bodies of prior art (`geometry/`, drag-lab strategies).

## Interaction patterns / demos worth noting

These exist in eric but not weasel. None is a "merge in" — they're prior art for future weasel features.

1. **`src/geometry/` — boolean ops + path utilities (clipper2-ts).** Full union/difference/intersection/xor/offset/minkowski/triangulate/flatten over `ShapePath`. Already maps to weasel's TODO **Tier 1 #1 ("Paths and compound shapes")**. When weasel takes that work on, this module is a plausible starting point.
2. **`src/drag-lab/strategies/quadtree.ts` + `quadtreeRenderer.ts`** — a recursive subdividing-quadtree placement strategy with a 7-layer debug overlay (cells, occupants, hover, etc.). Genuinely interesting prior art; weasel only has freeform/snapPoint/tileGrid. The companion `QUADTREE_LAYER_*` constants show a clean pattern for letting a layout strategy expose its own debug layers.
3. **`src/drag-lab/strategies/subgrid.ts`** — gap-aware grid with cell→pos / pos→cell mapping; complements weasel's tileGrid.
4. **`src/drag-lab/strategies/slot-based.ts`** — slot-array strategy (rows / grid / ring arrangements) sourced from `model/arrangement.ts`. Slot-snapping interaction useful template for "dock to predefined positions."
5. **`src/canvas/drag/` putative-drag framework (`useDragController` + `Drag<T,U>` shape).** Pure-compute drag pipeline — `read(sample,viewport) → compute(input) → publish to store → renderPreview(ctx)`. Coexists with weasel's `useDragGesture`. Worth knowing about when weasel evaluates a higher-level "drag = data + preview + commit" abstraction.
6. **`src/canvas/tools/structureMoveBehaviors.ts` — union-AABB clamp + per-secondary clash detection.** Working code that demonstrates the exact use case behind the TODO Tier 1.5 `MoveBehavior.onMoveAll(ctx)` hook. Useful as the spec input when that lands.
7. **`src/geometry-demos.ts` (standalone HTML page at `geometry-demos.html`)** — interactive boolean-ops/offset/Bezier/garden demos. Could inspire a `BooleanOpsDemo.tsx` once weasel has paths.
8. **`src/canvas/seedStartingHitTest.ts` + `seedStartingLayersWorld.ts`** — distinct "tray of cells with per-cell content" world model. Different enough from the garden world that it's worth knowing about as a second concrete adapter shape if weasel's adapter docs ever want a non-coordinate-grid example.

## API gaps found

The build/typecheck is clean, so there are no *outright* broken imports. The friction points are:

1. **`View` type not exported from weasel's index.** `src/canvas/layers/worldLayerData.ts` re-declares `interface View { x: number; y: number; scale: number }` with a comment saying "Mirrors `@weasel-js/core`'s internal `View` (not exported from the package index)." Weasel ships `ViewTransform` (`features/viewport/viewTransform.ts`), but the simpler camera-state shape eric uses isn't on the barrel. **Recommendation:** export the `View` (or whatever you want to call it — `ViewState`, `Camera`?) shape from weasel. Trivial change, removes a real ergonomic wart.
2. **`MoveBehavior.onMoveAll(ctx)` missing.** Already tracked in weasel's `docs/TODO.md` under Tier 1.5. Eric's `structureMoveBehaviors.ts` reconstructs each secondary's pose by hand from `ctx.origin + (proposed.primary - origin.primary)`. This is fine for shared-delta moves but blocks per-id constraints.
3. **`MoveBehavior` chains assume kit ordering vocabulary.** `snapMoveBehaviors.ts` has a long header documenting the Phase-5 deferral mapping ("snapToGrid → snapStructureZoneToGrid", "snapBackOrDelete → requirePlantingDrop"). The chain of (snap → clamp → clash → mirror → snap-back) is essentially folklore. Not a *bug*, but worth knowing — when weasel documents `MoveBehavior` ordering in `docs/extending.md`, this comment block is a strong source.
4. **`@weasel-js/core/move` subpath consumed.** Confirmed working — `snapMoveBehaviors.ts` imports `snapToGrid`, `snapBackOrDelete` from the subpath and the build resolves them. Subpath exports are healthy.

No instances of imports that fail or names that have been renamed since extraction. The `index.ts` barrel surface eric uses (`defineTool`, `useMove`, `useAreaSelect`, `useDragRect`, `usePointerGestures`, `Tool`, `ToolCtx`, `RenderLayer`, `MoveAdapter`, `ResizeAdapter`, `InsertAdapter`, `AreaSelectAdapter`, `LayoutStrategy`, `SnapTarget`, `ViewTransform`, `GestureContext`, `Op`, `createTransformOp`, `createInsertOp`, `createSetSelectionOp`, `screenToWorld`, `zoomAt`, `roundToCell`, `useDragHandle`, `useDropZone`, `createDragGhost`, `useClipboard`, `createMarkdownRenderer`, `renderLabel`, `renderFilledRegion`, `Paint`, `Region`, `TextRenderer`, `GridSlotConfig`, `DropTarget`, `DragPayload`, `ClipboardSnapshot`) is fully resolved.

## Recommended actions (priority ordered)

1. **Export a public `View` (camera state) type from weasel's barrel.** Removes the only "reach into internals" comment in eric. ~5 min of work, an obvious win, and makes the `worldLayerData.ts` re-declaration redundant.
2. **Use eric's `structureMoveBehaviors.ts` as the design input when implementing `MoveBehavior.onMoveAll(ctx)`.** TODO already tracks the hook — when it lands, replace eric's manual delta loop and verify multi-select clash still works. Coordinated change across both repos.
3. **Document the `MoveBehavior` ordering convention in weasel.** Lift the prose at the top of eric's `snapMoveBehaviors.ts` into `docs/extending.md` (or wherever `MoveBehavior` lives). Tier-1 documentation gap — has nothing to do with parity but the audit surfaced a clean source.
4. **When weasel takes on Tier 1 #1 (paths / compound shapes), pull from `src/geometry/`.** Don't merge speculatively; the module wants `clipper2-ts` as a runtime dep, which is a deliberate kit decision. But the API shape (`ShapePath` made of `LineSeg | CubicSeg`, plus `shapeUnion/Diff/Inter/Xor/Offset`) is well-tested (test files dated Apr 27) and worth borrowing.
5. **Consider graduating `visibilityWrap` and a `useViewMoving`-style hook.** Tiny utilities; check if weasel's roadmap wants either. Optional.
6. **Add eric's drag-lab quadtree / subgrid / slot-based strategies to weasel's strategies pack.** They're already strategy-shaped; only the type signatures (eric's `LabItem` vs weasel's strategy contract) need reconciliation. Good demo material once ported.
7. **No urgent fixes.** Build green, tests green, typecheck clean, no broken imports — eric is a healthy weasel consumer today.

---
*Audit performed against eric HEAD (May 6) and weasel HEAD (May 7) on a `file:../weasel` link.*
