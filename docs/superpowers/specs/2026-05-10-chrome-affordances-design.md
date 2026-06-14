# Chrome Affordances Design

**Status:** approved 2026-05-10 (informal back-and-forth in chat)
**Tag:** `@experimental` in the public barrel

## Problem

The kit's chrome (corner resize handles, rotation handle, marquee outline, anchor-edit dots, future affordances) is **drawn** by render layers and **dispatched** by tools. Today the two are coupled: each tool that owns chrome runs the chrome's hit-tests in its own `pointer.onDown` branch. When a non-owning tool is active, the chrome still renders (because the render layer runs every frame regardless) but the tool's pointer handler can't reach it.

Concrete failure mode that motivated this spec: in the lasso demo with active tool `lasso`, multi-selection chrome (corner resize handles + union AABB outline) renders correctly. The user clicks a corner handle expecting to resize. Instead, `useLassoTool.drag.onStart` claims the gesture and starts a new polyline. The handle is *visible but not hittable*.

This is one symptom of a broader rule violation:

> **Every visible affordance must be hittable, regardless of which tool is active.**

The kit's current architecture can't express this. Chrome rendering and chrome interaction live in different layers of abstraction; the dispatcher only consults the active tool when routing pointer events.

## Goal

Restructure chrome so:

1. **Visible affordances are first-class hit targets in the dispatcher's pipeline.** Hit dispatch walks render layers top-down before falling through to the active tool.
2. **Affordances are reusable factories.** Tools that operate on selection chrome (`useSelectTool`, custom transform tools, future tools) compose the same `createCornerResizeAffordance` factory rather than reimplementing handle hit-tests.
3. **Tools remain self-contained feature bags.** A tool's overlay layer is still a single `RenderLayer`; the affordances it hosts are internal details of that layer.
4. **A kit-level "chrome state" surface backs affordances.** Affordances are pure functions that read selection ids, derived bounds (overlay-aware), modifier flags, etc. from one canonical state object.
5. **Selection moves to core.** `useSelection` and its types are foundational to the chrome state surface — they belong in `src/core/selection/`, not under `features/`.
6. **Modal tools can preempt the affordance pipeline.** Pen mid-path-creation, text mid-edit, etc. opt into a `claimsAll(ctx)` predicate that bypasses chrome hit-tests for the duration of the modal state.

Tagged `@experimental` — surface may evolve before v2.

## Non-goals

- A separate "chrome tool" abstraction in the registry. Affordances live inside the tools that own them; the dispatcher treats them as part of layer hit-test routing, not as a fourth slot.
- A registry of affordances independent of tools. Each tool's affordances are local; cross-tool coordination is handled by the existing layer-ordering pipeline (top-down z-order).
- Per-affordance render layers. Each tool keeps a single overlay layer; affordances composite within it via `composeAffordanceLayer`. Multiplying layers would force a registry-shaped contract for ordering across tools.
- Replacing `useSelection` semantics or the existing `SelectionApi`. Only the file location moves.
- Touching unrelated chrome (anchor-edit handles, snap-target highlights, debug-overlay hover). Those follow the same pattern in their own follow-up specs once selection-chrome ships.
- Breaking changes to existing tool keybindings, overlay slot configs, or selection-mode behavior in `<SceneCanvas>`.

## Architecture

### §A — The principle

Every visible piece of chrome that ought to respond to a pointer event has a corresponding hit-test in its render layer. The dispatcher walks layers top-down on pointerdown; the first layer whose `hitTest` returns a non-null result owns the gesture. Tools-as-bags-of-features still hold: each tool's overlay is one layer, but that layer can host a list of affordances internally.

Modal tools (pen mid-path, text mid-edit) opt out via `Tool.claimsAll(ctx)` — when true, the layer pipeline is skipped and the gesture goes straight to the modal tool. Default off.

### §B — Affordance type

```ts
// src/affordances/types.ts

import type { DragChannel } from '../tools/types';
import type { ChromeState } from '../core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from '../core/viewport/view';

/** A single interactive piece of chrome. Pure functions; the kit composes
 *  multiple Affordances into a single RenderLayer per tool. */
export interface Affordance {
  /** Stable id for debug overlays + visibility maps. */
  id: string;
  /** Emit DrawCommands describing this affordance. Reads ChromeState +
   *  view. Returns [] when the affordance shouldn't render (no selection,
   *  multiActive false, etc. — affordance decides). */
  render(state: ChromeState, view: View): DrawCommand[];
  /** Optional. Returns a HitResult if `(worldX, worldY)` lands on this
   *  affordance, null otherwise. Affordances that are non-interactive
   *  (purely decorative) omit this. */
  hitTest?(
    worldX: number,
    worldY: number,
    state: ChromeState,
    view: View,
  ): HitResult | null;
}

/** Result of a layer's hit-test. Nominates the gesture's drag channel
 *  and (optionally) initial scratch state. */
export interface HitResult<TScratch = unknown> {
  drag: DragChannel<TScratch>;
  /** Initial scratch passed to drag.onStart. Lets the affordance pre-fill
   *  state from what its hit-test already computed (anchor: 'br',
   *  targetId: 'g1', etc.) so the tool's onStart doesn't re-hit-test. */
  initialScratch?: TScratch;
}
```

### §C — `composeAffordanceLayer` helper

```ts
// src/affordances/composeAffordanceLayer.ts

import type { RenderLayer } from '../core/layers/render';
import type { Affordance, HitResult } from './types';
import type { ChromeState } from '../core/selection/chromeState';

/**
 * Bundle a list of Affordances into a single RenderLayer. The layer's
 * draw iterates affordances in order (first → last = bottom → top).
 * Its hitTest walks the same list in REVERSE order (top → bottom = last
 * → first) and returns the first non-null result.
 */
export function composeAffordanceLayer(
  id: string,
  label: string,
  affordances: readonly Affordance[],
): RenderLayer<ChromeState> {
  return {
    id,
    label,
    space: 'screen',
    draw: (state, view) => {
      const out: DrawCommand[] = [];
      for (const a of affordances) {
        for (const cmd of a.render(state, view)) out.push(cmd);
      }
      return out;
    },
    hitTest: (wx, wy, state, view) => {
      // Top-down within the composite: last-rendered is topmost.
      for (let i = affordances.length - 1; i >= 0; i--) {
        const a = affordances[i];
        if (!a.hitTest) continue;
        const r = a.hitTest(wx, wy, state, view);
        if (r !== null) return r;
      }
      return null;
    },
  };
}
```

### §D — Chrome state surface

```ts
// src/core/selection/chromeState.ts

import type { Bounds } from '../adapters/types';
import type { NodeId } from '../scene/types';
import type { ModifierState } from '../../interactions/gestures/types';

/** Read-only state that affordances consult on every render and hit-test
 *  call. Built once per Canvas render via `buildChromeState`; affordances
 *  must not cache it across calls. */
export interface ChromeState {
  /** Currently selected ids. Live; reflects useSelection's React state. */
  selection: readonly NodeId[];
  /** True when the canvas is in multi-mode AND >= 2 ids are selected.
   *  Affordances targeting the union (multi-resize handles) gate on this;
   *  affordances targeting individual selection members iterate
   *  `selection`. */
  multiActive: boolean;
  /** Bounds for any selection member id. Honors active-tool overlay state
   *  (move/resize/rotate ghosts → ghost bounds; otherwise → committed
   *  pose bounds). Returns null for unknown ids or ids whose bounds aren't
   *  computable. */
  boundsOf(id: string): Bounds | null;
  /** Multi-union AABB when `multiActive`. Computed from `boundsOf` over
   *  every selected id. null otherwise. */
  unionBounds: Bounds | null;
  /** Active modifier state at the moment of the call. Hit-tests use this
   *  to refine behavior (e.g. alt-click drills through chrome). */
  modifiers: ModifierState;
}

export interface BuildChromeStateArgs {
  selection: readonly NodeId[];
  multiActive: boolean;
  effectiveBoundsOf: (id: string) => Bounds | null;
  modifiers: ModifierState;
}

export function buildChromeState(args: BuildChromeStateArgs): ChromeState {
  const { selection, multiActive, effectiveBoundsOf, modifiers } = args;
  let cachedUnion: { value: Bounds | null; computed: boolean } = { value: null, computed: false };
  return {
    selection,
    multiActive,
    boundsOf: effectiveBoundsOf,
    get unionBounds() {
      if (cachedUnion.computed) return cachedUnion.value;
      cachedUnion.computed = true;
      if (!multiActive) return (cachedUnion.value = null);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let any = false;
      for (const id of selection) {
        const b = effectiveBoundsOf(id);
        if (!b) continue;
        any = true;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
      }
      cachedUnion.value = any ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
      return cachedUnion.value;
    },
    modifiers,
  };
}
```

The state object is constructed once per Canvas render and passed to every layer's `draw` and `hitTest`. The `unionBounds` accessor is lazy — affordances that don't need it pay nothing.

`effectiveBoundsOf` is supplied by Canvas; today's `previewBounds` / `previewPose` resolution path moves into a single function reused by chrome state and the existing render-time pose lookup. No new contract on tools.

### §E — Dispatcher integration

```ts
// Pseudocode for the new pointerdown path in dispatcher.ts.

function onPointerDown(e: PointerEvent): void {
  const slots = opts.getSlots();        // { hotkey, active, ambient }
  const baseCtx = opts.getCtx({ /* ... */ });

  // 1. Modal claim check. Hotkey first (engaged-while-held > active).
  if (slots.hotkey?.claimsAll?.(ctxFor(slots.hotkey, baseCtx))) {
    return startGesture(slots.hotkey, e, baseCtx);
  }
  if (slots.active?.claimsAll?.(ctxFor(slots.active, baseCtx))) {
    return startGesture(slots.active, e, baseCtx);
  }

  // 2. Layer hit-test pipeline (top-down).
  const layers = getLayersInDispatchOrder();   // top-down per z-order
  for (const layer of layers) {
    if (!layer.hitTest) continue;
    const result = layer.hitTest(worldX, worldY, layerData(layer), view, dims);
    if (result !== null) {
      return startAffordanceGesture(result.drag, result.initialScratch, e, baseCtx);
    }
  }

  // 3. Slot walk (existing behavior).
  const order = [slots.hotkey, slots.active, ...slots.ambient].filter(Boolean);
  for (const tool of order) {
    const decision = tool.drag?.onStart?.(e, ctxFor(tool, baseCtx))
                  ?? tool.pointer?.onDown?.(e, ctxFor(tool, baseCtx));
    if (decision === 'claim') return claimGesture(tool, e, baseCtx);
  }
  // No claim; gesture remains pending until threshold/release per existing logic.
}
```

Key semantics:

- **Affordance claim is unconditional within the layer pipeline.** A layer's `hitTest` returning a `HitResult` means the gesture goes to that affordance; there's no "now ask the tool too" step. The layer either claims or returns null.
- **Modal claim bypasses the layer pipeline.** A modal tool gets the gesture as if no chrome existed.
- **Slot walk preserves existing claim/pass semantics.** `'claim'` stops the walk; `'pass'` (or `void`) tries the next slot.
- **`inFlight` state machine extends.** When an affordance claims, the dispatcher synthesizes an `inFlight` entry whose `tool` field references a virtual tool record `{ drag: claim.drag }`. Subsequent pointermove / pointerup route to that drag channel exactly like an active-tool gesture.

### §F — `Tool` interface addition

```ts
// src/tools/types.ts (additions)

interface Tool<TScratch = unknown> {
  // ... existing fields ...
  /** State-aware predicate. When true, this tool claims every pointerdown
   *  and bypasses the affordance layer hit-test pipeline. Used by tools
   *  in modal states (pen mid-path, text mid-edit) where affordance hits
   *  would otherwise interrupt the gesture-in-progress.
   *  Default: undefined (treated as false). Called once per pointerdown
   *  with the tool's current ctx. */
  claimsAll?: (ctx: ToolCtx<TScratch>) => boolean;
}
```

Optional, additive. No existing tool needs to change.

### §G — `RenderLayer` interface addition

```ts
// src/core/layers/render.ts (additions)

interface RenderLayer<TData> {
  // ... existing fields ...
  /** Optional hit-test. When defined, the dispatcher consults this on
   *  pointerdown (top-down layer order) before falling through to the
   *  active tool. First non-null result wins. */
  hitTest?: (
    worldX: number,
    worldY: number,
    data: TData,
    view: View,
    dims: Dims,
  ) => HitResult | null;
}
```

Optional, additive. Existing layers without `hitTest` are skipped during the layer walk.

### §H — File layout

```
src/core/selection/                      ← NEW (foundational state + types)
  useSelection.ts                        ← moved from src/features/selection/
  types.ts                               ← SelectionApi, NodeId glue (moved)
  chromeState.ts                         ← NEW — buildChromeState(...)
  index.ts                               ← barrel

src/features/selection/                  ← stays — presentational + ambient
  overlay.ts                             ← createSelectionOverlayLayer
                                            (will be reshaped to host
                                             affordances in Phase 5)
  SelectionContext.tsx                   ← cross-component publish/subscribe
  index.ts

src/affordances/                         ← NEW (kit-level chrome primitives)
  types.ts                               ← Affordance, HitResult
  composeAffordanceLayer.ts              ← composite layer helper
  cornerResize.ts                        ← createCornerResizeAffordance
  rotationHandle.ts                      ← createRotationAffordance
  index.ts                               ← barrel
```

Top-level `src/affordances/` (not `src/core/affordances/`) — affordances are kit primitives but they consume core state, so they sit one level above. Layering visible at file-tree level: `core` → `affordances` → `tools` → `features`.

### §I — `useSelectTool` after migration

The tool's surface stays the same (consumers don't notice the change). Internally:

- Imports `createCornerResizeAffordance` and `createRotationAffordance`.
- Builds its overlay via `composeAffordanceLayer('select-overlay', 'Select chrome', [cornerResize(opts), rotationHandle(opts)])`.
- Drops the inline corner-handle and rotation-handle hit-tests from `pointer.onDown`. The `body-hit` and marquee branches stay (they're not affordance-shaped — body-hit isn't a single visible chrome element, it's "any selectable scene object").
- Reads selection bounds from `ChromeState` (passed through Canvas's render-time wiring); the existing `getSelection`/`boundsOf` fallback path stays for back-compat with consumers who hand-roll the tool against an adapter that doesn't surface state.

The `MULTI_RESIZE_TARGET_ID` synthesis moves into `buildChromeState` (it's a derived value of `selection + boundsOf + multiActive`, not the select tool's private business). The synthetic id stops being needed externally — `unionBounds` directly exposes the value.

## Implementation phases

Five phases. Each ends in a working, testable state with no user-facing regression.

### Phase 1 — Move selection to core + build chrome state surface

- `git mv src/features/selection/{useSelection.ts,types.ts}` → `src/core/selection/`. Update kit-internal import paths; the `@weasel-js/core` barrel re-export stays so consumers see no change.
- Create `src/core/selection/chromeState.ts` with the `ChromeState` type and `buildChromeState` builder.
- Wire `buildChromeState` into Canvas — call it on every render, expose via the helpers ref / context so layers can read it on `draw`.
- **Tests:** type-check passes after move; `buildChromeState` unit tests for each derived field (`selection`, `multiActive`, `unionBounds` with 0/1/2/N selected, `boundsOf` overlay-awareness).
- **No user-facing change.** State surface exists; no consumer reads it yet.

### Phase 2 — Affordance scaffolding + dispatcher integration

- Create `src/affordances/`. Add `types.ts` (`Affordance`, `HitResult`) and `composeAffordanceLayer.ts`.
- Extend `RenderLayer<TData>` with optional `hitTest`.
- Extend `Tool<TScratch>` with optional `claimsAll`.
- Update `dispatcher.ts`: pointerdown does (1) modal claim check, (2) layer hit-test walk, (3) existing slot walk. Synthesize `inFlight` for affordance claims.
- **Tests:** `composeAffordanceLayer` unit; dispatcher integration with synthetic affordance layers (claim + null + multi-affordance ordering); modal-claim bypass; pass→fallthrough preserved for tools without `claimsAll`.
- **No user-facing change.** Scaffolding ready; no real affordances wired.

### Phase 3 — First affordance (corner resize) + migrate `useSelectTool`

- Build `createCornerResizeAffordance(opts)`. Reads `ChromeState` (selection / `boundsOf` / `unionBounds`); draws corner handles in screen-space; hit-tests cursor against handles. Returns `{ drag, initialScratch: { anchor, targetId } }` on hit. The `drag` channel runs `useResize` against the target.
- Migrate `useSelectTool`'s corner-handle path. Drop the inline hit-test in `pointer.onDown`. Build the tool's overlay via `composeAffordanceLayer([cornerResize])`.
- **Tests:** affordance unit (each anchor variant, single + multi selection); existing `useSelectTool` integration suite passes; new integration test "corner-resize hit while non-select tool active" passes (the principle's load-bearing case).
- **First user-facing change.** Lasso demo's resize handles work mid-lasso.

### Phase 4 — Rotation affordance + complete migration

- Build `createRotationAffordance(opts)`. Same shape, drives `useRotate`.
- Migrate `useSelectTool`'s rotation-handle path. Tool's overlay becomes `composeAffordanceLayer([cornerResize, rotationHandle])`.
- Audit kit for other chrome violations (anchor-edit dots while non-edit tool active, etc.). File follow-up specs as needed; address out of scope here.
- **Tests:** rotation affordance unit; "rotate while non-select active" integration.

### Phase 5 — Canvas slot cleanup + cross-tool integration

- Audit Canvas's `selectionOverlay` slot. The kit-level synthesis we built earlier (multi-union fallback in `poseById`, `getOutlineIds` plumbing) becomes redundant — `ChromeState.unionBounds` and the affordances' own per-id outlines subsume it. Slot becomes a thin override hook for consumers replacing the default chrome.
- Drop now-redundant code paths in `useSelectTool` (the `boundsOfRef` dance for `previewBounds`, the inline corner / rotation hit-tests, the `MULTI_RESIZE_TARGET_ID` constant if unused externally).
- Update demos that hand-build `useSelectTool` (NestedGroupsDemo, GroupsDemo, MultiSelectDemo, LassoDemo). Verify no breakage.
- **Tests:** demo smoke tests; visual-regression specs (if their baselines need refresh, soak via the existing CI flow); `prepublishOnly` green.

### Total scope

~3-4 days of focused work. Each phase commits independently; if Phase 3 blocks (unlikely — the affordance is deliberately small), the kit at end of Phase 2 is shippable as scaffolding-only.

## Documentation updates

The kit's core docs encode the vocabulary; new concepts and moved files have to land there in lockstep with the code. Each implementation phase finishes with the corresponding doc edits.

### `docs/taxonomy.md` — vocabulary

**Update existing entries:**

- §1 *Selection* — file path moves from `src/features/selection/useSelection.ts` to `src/core/selection/useSelection.ts`. Add a sentence noting that `ChromeState` (the affordance-facing read-only view) is built atop the `SelectionApi`.
- §1 *Slot* — the `selectionOverlay` slot's role becomes "thin override hook for replacing default chrome" rather than "what the kit synthesizes the selection layer from."
- §5 *Selection overlay* — rewrite to describe the new model: the selection chrome is composed from kit-level **affordances** rather than Canvas-synthesized handle layers. `createSelectionOverlayLayer` stays as a presentational helper for consumers that want a single-layer chrome bundle without pulling affordances directly.

**Add new entries:**

- §1 *Affordance* — a reusable factory primitive that produces a `{ render, hitTest? }` pair consumed by tools. Lives in `src/affordances/`. Tools compose multiple affordances into a single overlay layer via `composeAffordanceLayer`. Examples: `createCornerResizeAffordance`, `createRotationAffordance`. Cross-reference §1 *Tool* and §5 *Selection overlay*.
- §2 *Chrome state* — the read-only `ChromeState` object built once per Canvas render and passed to every affordance's `render` and `hitTest` call. Source of truth for selection ids, derived bounds, multi-union AABB, and modifier flags. Lives in `src/core/selection/chromeState.ts`. Consumed only by affordances; tools read from `ToolCtx` as today.
- §4 *Modal claim* (or extend §1 *Tool*) — describe the optional `Tool.claimsAll(ctx)` predicate and the affordance-pipeline-bypass it enables.

**Add to §6 *Concepts not in the kit (yet)*:**

- *Affordance registry / plugin discovery* — declared explicitly NOT a goal. Affordances are passed to tools by reference; cross-tool ordering is layer z-order. No ambient registry.

### `docs/concepts.md` — narrative concepts

- *Layer* — note the optional `hitTest` field. The dispatcher consults it on pointerdown before falling through to the active tool.
- New section: *Affordance* — the narrative version. Picture: "tools render their chrome through affordances; affordances expose hit-tests so visible chrome is always interactive regardless of which tool is active."

### `docs/extending.md` — custom-tool guide

- New subsection: *Building a custom affordance.* Walk through `createCornerResizeAffordance` as the worked example: factory args, `render` implementation, `hitTest` returning `{ drag, initialScratch }`, composing into a tool's overlay.
- Update the *Custom tools* subsection: tools that own chrome should compose affordances rather than running inline `pointer.onDown` hit-tests.

### `docs/hooks.md` — hook reference

- *`useSelection`* — file path update only.
- New entry: *Affordance factories* (or move to a separate `affordances.md` if the count grows): `createCornerResizeAffordance`, `createRotationAffordance`.

### `docs/adapters.md`

- No change — adapter contract is unchanged. Affordances read state via `ChromeState`, not via an adapter directly.

### Phase mapping

| Phase | Doc deliverables |
|---|---|
| 1 | Update `taxonomy.md` *Selection* entry (file path + ChromeState reference); add *Chrome state* entry. |
| 2 | Add *Affordance* entry (kit primitive, but no concrete factories yet). Update `concepts.md` *Layer* (note `hitTest`). Add *Modal claim* note under *Tool*. |
| 3 | Update `extending.md` with the corner-resize affordance walkthrough; add `hooks.md` entry for `createCornerResizeAffordance`. |
| 4 | Add `hooks.md` entry for `createRotationAffordance`. |
| 5 | Rewrite *Selection overlay* §5 in `taxonomy.md` for the new model. Confirm `concepts.md` chrome narrative is accurate. Drop `MULTI_RESIZE_TARGET_ID` mentions if the symbol leaves the public barrel. |

## Code-shape constraints

- **Affordances are pure functions.** No useState, no useEffect, no React. They receive state on every call. (The factory function creating an affordance can take options/closures, but the resulting `Affordance` object is stateless.)
- **`composeAffordanceLayer` produces a `RenderLayer`** — slots into the existing Canvas layer pipeline without a new abstraction.
- **`ChromeState` is read-only.** No mutators. Affordances dispatch gestures through `drag.onStart`'s `ToolCtx` (which has `applyBatch`, `selection.set`, etc.) — they don't reach back into `ChromeState`.
- **Bundle impact:** `src/affordances/` directory ~600 LOC including tests. `src/core/selection/` shifts ~300 LOC of imports without growing. Net: ~600 LOC product code added, no removals in Phase 1-2; Phase 5 deletes ~150 LOC of now-redundant Canvas + `useSelectTool` plumbing.
- **Tree-shakeable:** consumers who don't import any affordance pay nothing.
- **No public API breakage** in Phase 1-4. Phase 5 drops `MULTI_RESIZE_TARGET_ID` from the public barrel if the audit confirms no external consumer references it.

## Out of scope (deferred)

- **Other chrome-violation audits.** Anchor-edit dots, snap-target highlights, debug-overlay hit-rings — each follows the same pattern but has its own state shape. File one spec per family once the selection-chrome baseline lands.
- **Per-affordance visibility.** The kit's existing layer visibility map operates at layer granularity; suppressing one affordance within a composite would require new wiring. Defer until a real consumer wants it.
- **Affordance overlap resolution.** When two affordances within a composite would both claim `(x, y)`, the array order is the tiebreaker (last → first walk). Cross-composite overlap is resolved by layer z-order. No explicit conflict-resolution API in v1.
- **Touch / multi-pointer chrome interactions.** Affordances are single-pointer only in v1; multi-touch chrome (e.g. two-finger rotate) follows the existing `usePinchGesture` pattern and isn't tied to the affordance abstraction.
- **Server-side / offscreen affordance rendering.** Affordances are screen-space only; no headless render path.
- **Full extraction of `useSelectTool` into chrome-only-tool + select-only-tool.** The migration in Phase 3-4 keeps `useSelectTool` as the unit; affordances are internal. Splitting into smaller tools is its own future spec if a consumer needs to compose them differently.
