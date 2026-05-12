# Declarative tool routing — Phase 5b (Hard migrations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the remaining built-in tools to the declarative routing factory, after closing the two known factory gaps (overlay forwarding, `claimsAll` function-form). Phase 5b completes the imperative-to-declarative tool migration begun in Phase 2.

**Architecture:** Two substrate-prep tasks land first (overlay + `claimsAll`-as-function on the factory). Then tool migrations in ascending complexity: `useLassoTool` (single-drag overlay), `useRectTool` (the simple drag-create shape — useful as the warmup before the shape-tool batch), `defineDragInsertTool` (shared substrate; fans out to `useInsertTool` and `useTextTool`), the standalone shape tools (`useEllipseTool`, `useLineTool`, `usePolygonTool`, `useStarTool`, `usePencilTool`), then `useCloneTool`, `useEditAnchorsTool`, and finally `useUserPenTool`. Each tool migration follows the `useSelectTool` template — drop imperative `defineTool` from `../defineTool`, replace channels with declarative routes + factory-forwarded overlay, preserve behavior verified by existing tests.

**Survey-driven scope correction.** The prompt's preamble made two assumptions the survey did not confirm:

1. **The "shape tools fan out from `defineDragInsertTool`" claim is wrong.** The survey found that only `useInsertTool` and `useTextTool` consume `defineDragInsertTool`. The standalone shape tools (`useEllipseTool`, `useLineTool`, `usePolygonTool`, `useStarTool`, `usePencilTool`) and the rect tool (`useRectTool`) each use the imperative `defineTool` *directly* with their own `useDragRect`/`useDragRadial` controllers and their own `useMemo`'d overlay layers. So `defineDragInsertTool`'s migration fans out to **two** consumers, not seven; the standalone shape tools are independent migrations each on the same per-tool template.
2. **`claimsAll` is not used by any built-in today.** The imperative `Tool.claimsAll: (ctx) => boolean` field exists in `tools/types.ts` and is read by `dispatcher.ts`, but no tool in `src/tools/builtin/` sets it. The prompt's reference to `useUserPenTool` using `claimsAll` mid-path is hypothetical — the pen tool's modal state is managed entirely through persistent scratch (`scratchRef` outside the dispatcher's `initScratch` contract), not through `claimsAll`. The migration still benefits from `claimsAll`-as-function (it's the only `PhaseDef` field still locked to a static value while `cursor` already takes a function), but we should not justify it as "the pen tool blocked on this." We add it as a symmetry fix and a future-facing affordance.

These corrections do not change the task list but they do change the framing and the regression-risk assessment. The plan below reflects the actual fanout.

**Also surveyed but already migrated, so out of scope:** `useDeleteTool`, `useDuplicateTool`, `useNudgeTool`, `useUndoRedoTool` (Phase 5a), `useHandTool` (Phase 2), `useSelectTool` (Phase 3 + 4.5), and the wheel/zoom viewport tools (`useWheelPanTool`, `useWheelZoomTool`, `useKeyboardZoomTool`, `usePinchZoomTool`) which use the legacy imperative `defineTool`. The viewport tools are flagged at the end as a Phase 5c candidate — they need `defineViewportTool` consumers, which is its own conversion exercise distinct from the body-hit tools handled here.

**`useUserTextTool` does not exist.** The Phase 5a hand-off list referenced `useUserTextTool`. The survey found no such file; `useTextTool` is the only text-creation tool and it is a thin wrapper around `defineDragInsertTool`. There is no modal text-edit tool — text editing is a scene-level capability via `features/text/useSceneTextEdit.ts`, which doesn't go through the Tool surface at all. So this plan covers `useTextTool` as a downstream consumer of the `defineDragInsertTool` migration, and the "modal text-edit Tool" mentioned in 5a is dropped from scope.

**Tech Stack:** TypeScript, React 18+, Vitest. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md` (including the Phase 4.5 follow-up section).

**Predecessors:**

- Phase 1 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-1.md`
- Phase 2 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-2.md`
- Phase 3 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-3.md`
- Phase 4 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-4.md`
- Phase 4.5 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-4-5.md`
- Phase 5a plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-5a.md`

**Reference implementations (study these before each migration):**

- `src/tools/builtin/useHandTool.ts` — viewport-only single drag (factory pattern via `defineViewportTool`).
- `src/tools/builtin/useSelectTool.ts` — full-surface declarative (every route channel, both phases, `pointerDown` classifier, `dblTap`, cursor override).

---

## File map

**Modified (substrate):**

- `src/tools/routing/types.ts` — change `PhaseDef.overlay` to forward through the factory; widen `PhaseDef.claimsAll` from `boolean` to `boolean | ((ctx) => boolean)`; adjust `ViewportPhaseDef` to keep its `Pick<PhaseDef>` projection compiling.
- `src/tools/routing/defineTool.ts` — read `phase.overlay` and emit it on the returned `Tool.overlay`; treat `claimsAll` as a function-or-boolean, resolved per call.
- `src/tools/routing/defineViewportTool.ts` — pass overlay + `claimsAll` through the lift (signature already forwards both fields by name; verify no narrowing breaks).
- `src/tools/routing/defineTool.test.ts` — add a fixture tool with an overlay and assert it surfaces on the returned `Tool.overlay`; add a fixture tool with `claimsAll: (ctx) => ...` and assert per-call evaluation.
- `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md` — append a "Phase 5b factory completeness" note documenting the function-form `claimsAll` and confirming the overlay forwarding semantics.

**Modified (tool migrations):**

- `src/tools/builtin/useLassoTool.ts`
- `src/tools/builtin/useRectTool.ts`
- `src/tools/builtin/defineDragInsertTool.ts` — migrated substrate; `useInsertTool.ts` and `useTextTool.ts` inherit automatically (no edits needed in their wrappers if the substrate's public shape is unchanged).
- `src/tools/builtin/useEllipseTool.tsx`
- `src/tools/builtin/useLineTool.tsx`
- `src/tools/builtin/usePolygonTool.tsx`
- `src/tools/builtin/useStarTool.tsx`
- `src/tools/builtin/usePencilTool.tsx`
- `src/tools/builtin/useCloneTool.ts`
- `src/tools/builtin/useEditAnchorsTool.ts`
- `src/tools/builtin/useUserPenTool.ts`

**Not modified:**

- `src/tools/builtin/useInsertTool.ts` and `src/tools/builtin/useTextTool.ts` — they import `defineDragInsertTool` and don't touch the imperative factory themselves; Task 5's substrate migration covers them transitively. Their existing test files (`useInsertTool.test.ts`, `useTextTool.test.ts`) verify the inheritance is clean.
- `src/tools/defineTool.ts` (the imperative identity helper) — kept for any out-of-tree consumers. The Phase 5b sweep gates on `grep -rn "from '../defineTool'" src/tools/builtin/` returning empty to confirm zero builtin consumers remain.
- Viewport tools (`useWheelPanTool.ts`, `useWheelZoomTool.ts`, `useKeyboardZoomTool.ts`, `usePinchZoomTool.ts`) — separate `defineViewportTool` migration deferred to Phase 5c per the closing section.

---

## Task 1: Substrate — forward `phase.overlay` through `defineTool`

**Files:**

- Modify: `src/tools/routing/types.ts`
- Modify: `src/tools/routing/defineTool.ts`
- Modify: `src/tools/routing/defineTool.test.ts`

The `PhaseDef.overlay` field already exists on the type but is silently dropped by the factory translator. The spec types it as `(ctx: ToolCtx<TScratch>) => RenderLayer<unknown>` but every imperative consumer (`useRectTool`, `useEllipseTool`, `useLassoTool`, etc.) constructs a `RenderLayer` once via `useMemo` and reads dynamic state via closure-over-refs inside `draw`. So the effective surface is "the factory evaluates the overlay producer once at translation time and emits a `RenderLayer<unknown>` onto `Tool.overlay`." We keep the function form (parameterless) for parity with `cursor` and to let consumers compose the layer from values in the enclosing render scope; we don't pass `ctx`, because there's no meaningful `ctx` at translation time — the dispatcher hasn't seen any event yet.

- [ ] **Step 1: Narrow the `PhaseDef.overlay` signature to a thunk**

Edit `src/tools/routing/types.ts`. Replace the existing `overlay?` line in `PhaseDef`:

```ts
/** Optional overlay layer rendered while the tool is in any active slot
 *  (active, hotkey, or ambient). The factory evaluates the thunk once
 *  at translation time and emits the resulting RenderLayer on
 *  Tool.overlay. The layer's `draw` closure should read dynamic state
 *  (scratch, controller overlay snapshots) via refs/closures captured
 *  in the enclosing render scope — same pattern Phase 2/3 hand-rolled
 *  tools use today.
 *
 *  Function form rather than a direct RenderLayer so consumers can
 *  defer construction until inside a `useMemo` factory body, where
 *  `useRef`-backed values are stable. Symmetric with `cursor`'s
 *  function form. */
overlay?: () => RenderLayer<unknown>;
```

Rationale for dropping the `ctx` parameter: no current consumer reads it (`useRectTool`, `useEllipseTool`, `useLassoTool`, `useUserPenTool`, `defineDragInsertTool` all close over refs in their `draw` body), the dispatcher only collects overlays once per render via `getActiveOverlays()`, and the spec's `(ctx) => RenderLayer` shape was aspirational rather than load-bearing. If a future tool needs `ctx`, it can re-read scratch from the live ToolCtx inside `draw` itself — that's what scratch closures already do.

- [ ] **Step 2: Update `ViewportPhaseDef` if its `Pick` projection breaks**

`ViewportPhaseDef = Pick<PhaseDef, 'wheel' | 'keyDown' | 'keyUp' | 'cursor' | 'overlay' | 'claimsAll'>`. The Pick narrows automatically; no edit needed unless the `Pick` chokes on the changed type. Confirm by typechecking after Step 1.

- [ ] **Step 3: Emit overlay from `defineTool`**

Edit `src/tools/routing/defineTool.ts`. The current return object has no `overlay` field. Add it. The overlay should come from `def.initial.overlay` evaluated at factory call time — there's only one phase that authors "the overlay" in practice (engaged phase typically renders a *different* preview than initial, but the imperative consumers all set one overlay per tool, not per phase). For Phase 5b we forward the *initial-phase* overlay onto `Tool.overlay` and document the limitation; phase-specific overlays are a future enhancement (the closure over scratch handles "fade in/out depending on engagement" inside `draw` anyway, since scratch !== null is observable from the ref).

Insert near the end of the returned object (before the closing brace, beside `wheel:`):

```ts
overlay: def.initial.overlay ? def.initial.overlay() : undefined,
```

That's it — `getActiveOverlays()` in `useTools.ts` already reads `Tool.overlay` and pushes it into the active-tool layer stack.

- [ ] **Step 4: Document the per-phase limitation in `PhaseDef.overlay` JSDoc**

Extend the JSDoc added in Step 1 with:

```
Phase 5b note: only `initial.overlay` is read. If `engaged.overlay`
is set, it is ignored — phase-specific overlay routing is a future
enhancement. Tools that need engagement-aware previews should gate
inside the single overlay's `draw` body via `if (!scratch.somefield)
return []`, which is how every Phase 2/3 hand-rolled tool already
does it.
```

- [ ] **Step 5: Write a factory unit test for overlay forwarding**

Edit `src/tools/routing/defineTool.test.ts`. Add a test inside the existing describe block:

```ts
it('forwards initial.overlay onto Tool.overlay', () => {
  const layer: RenderLayer<unknown> = {
    id: 'fixture-overlay',
    label: 'Fixture',
    space: 'screen',
    draw: () => [],
  };
  const tool = defineTool({
    id: 'fixture',
    initial: { overlay: () => layer },
  });
  expect(tool.overlay).toBe(layer);
});

it('omits Tool.overlay when no phase.overlay is defined', () => {
  const tool = defineTool({ id: 'fixture-no-overlay', initial: {} });
  expect(tool.overlay).toBeUndefined();
});
```

Import `RenderLayer` at the top of the test file: `import type { RenderLayer } from '../../core/layers/render';`. Run only this file with:

```bash
npx vitest run src/tools/routing/defineTool.test.ts
```

Expected: both new tests pass, all existing tests remain green.

- [ ] **Step 6: Commit**

```bash
git add src/tools/routing/types.ts src/tools/routing/defineTool.ts src/tools/routing/defineTool.test.ts
git commit -m "feat(routing): forward phase.overlay through declarative factory"
```

Body: "Phase 5b substrate. The factory translator now reads
`def.initial.overlay` (a thunk returning a `RenderLayer`) and emits
it on `Tool.overlay`. Required for migrating shape/insert/lasso tools
without losing their preview layers."

---

## Task 2: Substrate — `claimsAll` as function on `PhaseDef`

**Files:**

- Modify: `src/tools/routing/types.ts`
- Modify: `src/tools/routing/defineTool.ts`
- Modify: `src/tools/routing/defineTool.test.ts`

The imperative `Tool.claimsAll: (ctx) => boolean` is per-call; the declarative `PhaseDef.claimsAll: boolean` is static-per-phase. The static form is sufficient for "engaged phase always claims" patterns (none currently used) but doesn't handle finer-grained gating like "claims only when scratch.midPath === true" that a pen-style tool *would* want if we migrated its modal state into engaged-phase scratch. Widening the field to `boolean | ((ctx) => boolean)` is mechanically symmetric with `cursor` (already `string | ((ctx) => string)`) and costs nothing for current consumers.

We choose option **A** from the prompt: widen the type and thread it through. Option B (post-factory spread) was rejected because every other phase-scoped option has a function form, and adding a documented spread-and-replace escape hatch as the only exception would invite consumers to drift into ad-hoc patching the factory's output for other fields too.

- [ ] **Step 1: Widen the type**

Edit `src/tools/routing/types.ts`. Replace the `claimsAll` line in `PhaseDef`:

```ts
/** Modal-claim predicate. When this resolves to `true`, the dispatcher
 *  routes every pointerdown to this tool and bypasses the affordance-layer
 *  hit-test pipeline — used by tools in modal states (pen mid-path, text
 *  mid-edit) where affordance hits would otherwise interrupt the
 *  in-progress gesture.
 *
 *  Function form receives the live ToolCtx (scratch, view, modifiers,
 *  target). Boolean form is sugar for `() => true` / `() => false` —
 *  use the function form when the decision depends on scratch state
 *  (e.g. `(ctx) => ctx.scratch?.midPath === true`).
 *
 *  Resolved per-call by the factory — the function fires on every
 *  pointerdown the dispatcher considers handing to this tool. Keep it
 *  cheap (no allocations, just a scratch read). */
claimsAll?: boolean | ((ctx: ToolCtx<TScratch>) => boolean);
```

`ToolCtx` is already imported at the top of the file (line 1). No new imports.

- [ ] **Step 2: Resolve `claimsAll` per call inside the factory**

Edit `src/tools/routing/defineTool.ts`. Replace the existing `claimsAll` block (lines 233–236):

```ts
// claimsAll lives on the active phase, optionally. Boolean and
// function forms both supported; the function form receives the
// live ctx (scratch, view, target, modifiers) and is re-evaluated
// on every pointerdown the dispatcher considers.
const claimsAll = (ctx: ToolCtx<TScratch>): boolean => {
  const v = phaseOf(ctx).claimsAll;
  if (v === undefined) return false;
  return typeof v === 'function' ? v(ctx) : v;
};
```

The dispatcher already invokes `tool.claimsAll(ctx)` as a function (see `dispatcher.ts:235`), so no dispatcher edit is needed. The factory's returned `Tool.claimsAll` was already a function — what changes is the *source* the function reads from.

- [ ] **Step 3: Mirror the change in `defineViewportTool`**

Edit `src/tools/routing/defineViewportTool.ts`. The `liftPhase` helper currently passes `claimsAll: phase.claimsAll` through unchanged — that line already supports `boolean | function` after the type widens. Verify no TypeScript error after Task 2 Step 1 lands. If `claimsAll` on `PhaseDef` is union-typed and `ViewportPhaseDef`'s `Pick` preserves the union, no edit is needed. Confirm by running:

```bash
npx tsc --noEmit
```

after Step 2. If a narrowing error appears (e.g. "Type 'boolean' is not assignable to type 'boolean | ((ctx) => boolean)'"), edit `liftPhase` to spell out the type:

```ts
claimsAll: phase.claimsAll as boolean | ((ctx: ToolCtx<TScratch>) => boolean) | undefined,
```

- [ ] **Step 4: Test the per-call function form**

Edit `src/tools/routing/defineTool.test.ts`. Add inside the existing describe block:

```ts
it('claimsAll as a function is evaluated per call', () => {
  let scratchVal: { engaged: boolean } = { engaged: false };
  const tool = defineTool<{ engaged: boolean }>({
    id: 'fixture-modal',
    initial: { claimsAll: (ctx) => ctx.scratch?.engaged === true },
  });
  const baseCtx = {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: {} as never, adapter: {}, applyOps: () => {},
    view: {} as never, canvasRect: {} as never, scratch: scratchVal,
  };
  expect(tool.claimsAll!(baseCtx as never)).toBe(false);
  scratchVal = { engaged: true };
  expect(tool.claimsAll!({ ...baseCtx, scratch: scratchVal } as never)).toBe(true);
});

it('claimsAll as boolean still works', () => {
  const tool = defineTool({
    id: 'fixture-static-claim',
    initial: { claimsAll: true },
  });
  expect(tool.claimsAll!({ scratch: null } as never)).toBe(true);
});

it('claimsAll absent returns false', () => {
  const tool = defineTool({ id: 'fixture-no-claim', initial: {} });
  expect(tool.claimsAll!({ scratch: null } as never)).toBe(false);
});
```

Run:

```bash
npx vitest run src/tools/routing/defineTool.test.ts
```

Expected: all three new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/types.ts src/tools/routing/defineTool.ts src/tools/routing/defineViewportTool.ts src/tools/routing/defineTool.test.ts
git commit -m "feat(routing): support function-form claimsAll on PhaseDef"
```

Body: "Phase 5b substrate. `PhaseDef.claimsAll` accepts `boolean | (ctx) => boolean`, resolved per call. Symmetric with `cursor`'s function form. No current built-in needs this — added for future modal tools and to remove the static-only restriction before Phase 5b's tool migrations."

---

## Task 3: Migrate `useLassoTool`

**Files:**

- Modify: `src/tools/builtin/useLassoTool.ts`

The simplest hard tool: single drag gesture, a polyline overlay, an Escape keybinding. Imperative shape today:

- `defineTool` from `../defineTool`.
- `drag: { onStart, onMove, onEnd, onCancel }` calling `ctl.start/move/end/cancel`.
- `keyboard.onDown` handling Escape mid-lasso.
- `overlay`: a `RenderLayer` constructed inside `useMemo`, drawing the lasso polyline from `ctl.overlay` snapshots.

Migration shape: a single function-form `drag` route (no targets — lasso works in empty space, and the imperative form doesn't gate on `ctx.target`), a `keyDown.Escape` route, and a `phase.overlay` thunk returning the same `RenderLayer`. Engaged-phase scratch isn't strictly required (the controller owns gesture state and we don't read scratch), so the migration uses `TScratch = undefined` and `begin({ scratch: undefined })` on drag start.

- [ ] **Step 1: Inspect current behavior**

Read `src/tools/builtin/useLassoTool.ts` and `src/tools/builtin/useLassoTool.test.tsx`. Note: the test asserts (a) drag commits via `selectFromLasso`, (b) Escape during lasso cancels without committing, (c) the overlay renders the polyline. Confirm what `ctl.isLassoSelecting` controls — Escape only claims when the controller is mid-gesture, so the route must respect that.

- [ ] **Step 2: Rewrite using declarative factory**

Replace the file body. Keep imports for `LassoIcon`, `PathBuilder`, view helpers, `useLassoSelect`, `selectFromLasso`, types. Swap `import { defineTool } from '../defineTool';` for `import { defineTool, claim, begin, none } from '../routing';`.

New tool body inside `useMemo`:

```ts
const overlay: RenderLayer<unknown> = {
  id: 'lasso-overlay',
  label: 'Lasso overlay',
  space: 'screen',
  draw: (_data, view): DrawCommand[] => {
    // Closure-read controller.overlay each draw — same pattern as the
    // imperative tool. No ctx is needed here; `view` arrives from the
    // overlay layer's draw call.
    const ov = ctl.overlay;
    if (!ov || ov.vertices.length === 0) return [];
    // ... (keep the existing transform/polyline/closer-line block verbatim)
  },
};

return defineTool<undefined>({
  id: 'lasso',
  ...(options.keybinding === null ? {} : { keybinding: options.keybinding ?? { key: 'L' } }),
  cursor: 'crosshair',
  presentation: {
    label: 'Lasso',
    icon: createElement(LassoIcon),
    group: 'select',
  },
  initial: {
    overlay: () => overlay,
    drag: (ctx, _e) => {
      ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
      return begin({
        scratch: undefined,
        onMove: (c) => {
          ctl.move(c.worldX, c.worldY, c.modifiers);
          return claim();
        },
        onRelease: () => {
          ctl.end();
          return claim();
        },
        onCancel: () => {
          ctl.cancel();
        },
      });
    },
    keyDown: {
      Escape: () => {
        if (!ctl.isLassoSelecting) return none();
        ctl.cancel();
        return claim();
      },
    },
  },
});
```

Notes:
- `drag` is the function-form (no target route table) — matches the imperative tool's "claim every pointerdown in this slot, no body-hit gating." The factory accepts `ActionFn` directly for function-form drag (`PhaseDef.drag: RouteTable | ActionFn`).
- `initial.overlay: () => overlay` — the `useMemo`'d layer is constructed in the outer closure once per `ctl` change, then the thunk closes over it. The factory calls the thunk once at translation time.
- `Escape`'s gate (`if (!ctl.isLassoSelecting) return none()`) matches the legacy `return 'pass'` — letting other ambient tools handle Escape when no lasso is in flight.
- No `engaged` phase needed: the gesture-state machine lives in `useLassoSelect`'s controller; the declarative factory's `activeSpec` tracks the in-flight `BeginSpec` (continuations) for the duration of the drag.

- [ ] **Step 3: Run the tool's tests**

```bash
npx vitest run src/tools/builtin/useLassoTool.test.tsx
```

Expected: all assertions pass. If overlay tests fail, double-check Task 1 actually emitted `Tool.overlay`. If Escape behavior fails, verify the `none()` vs `claim()` branching matches the legacy `'pass'`/`'claim'`.

- [ ] **Step 4: Run the full kit suite**

```bash
npx vitest run
```

Baseline holds.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useLassoTool.ts
git commit -m "refactor(useLassoTool): migrate to declarative routing factory"
```

---

## Task 4: Migrate `useRectTool`

**Files:**

- Modify: `src/tools/builtin/useRectTool.ts`

`useRectTool` is the "rect-as-shape" template the spec calls out as a role model. Migration shape: single function-form `drag`, no `pointerDown`, no `dblTap`, no `keyDown`; overlay forwarded.

- [ ] **Step 1: Inspect**

Read `src/tools/builtin/useRectTool.ts` and `src/tools/builtin/useRectTool.test.ts`. The drag uses a `useDragRect` controller and an `applyOpsRef` captured on `onEnd` before `dr.end()` (the controller's `onEnd` callback dispatches via the ref). Confirm this lifecycle: `onStart` calls `dr.start`, `onMove` calls `dr.move`, `onEnd` writes `applyOpsRef.current = ctx.applyOps` then calls `dr.end()` (which internally calls back into the consumer with bounds), and `onCancel` calls `dr.cancel()`.

- [ ] **Step 2: Rewrite**

Replace the imperative `defineTool` with `defineTool` from `../routing`. The drag becomes function-form and returns `begin({ ... })`:

```ts
return defineTool<null>({
  id: 'rect',
  keybinding: { key: 'R' },
  cursor: 'crosshair',
  initial: {
    overlay: () => overlay,
    drag: (ctx) => {
      dr.start(ctx.worldX, ctx.worldY, ctx.modifiers);
      return begin({
        scratch: null,
        onMove: (c) => {
          dr.move(c.worldX, c.worldY, c.modifiers);
          return claim();
        },
        onRelease: (c) => {
          applyOpsRef.current = c.applyOps;
          dr.end();
          return claim();
        },
        onCancel: () => {
          dr.cancel();
        },
      });
    },
  },
});
```

Imports: `import { defineTool, begin, claim } from '../routing';`. Drop `import { defineTool } from '../defineTool';`. Drop `initScratch` (the declarative factory provides one automatically from `ctx.scratch = null`).

- [ ] **Step 3: Run the tool's tests**

```bash
npx vitest run src/tools/builtin/useRectTool.test.ts
```

Expected: all assertions pass. Test asserts: drag commits a single rect via `applyOps`; cancel discards; overlay renders during the drag.

- [ ] **Step 4: Run the full kit suite**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useRectTool.ts
git commit -m "refactor(useRectTool): migrate to declarative routing factory"
```

---

## Task 5: Migrate `defineDragInsertTool` (substrate; fans out to `useInsertTool` + `useTextTool`)

**Files:**

- Modify: `src/tools/builtin/defineDragInsertTool.ts`

This is the substrate shared by `useInsertTool` and `useTextTool`. The current shape is more involved than `useRectTool` because it supports *both* click-to-insert and drag-to-insert, gated by `controller.supportsPointInsert` / `controller.supportsCommitInsert`, plus an `applyHitExistingGate` hit-test that converts a hit-on-existing-body into a selection rather than an insert.

The two consumers (`useInsertTool`, `useTextTool`) do not import the imperative `defineTool` themselves — they call `defineDragInsertTool(...)` and receive a `Tool<undefined>`. So they don't need edits as long as this task preserves the returned shape (`{ tool, applyOpsRef }`).

- [ ] **Step 1: Inspect current behavior**

Read `src/tools/builtin/defineDragInsertTool.ts` and `src/tools/builtin/defineDragInsertTool.test.ts`. Note the four code paths gated by capability flags:

- `supportsClick && supportsDrag` → both `pointer.onClick` and `drag` (most common — rect/ellipse insert via point-or-drag).
- `supportsClick && !supportsDrag` → click only (text insert, when `commitInsert` is omitted).
- `!supportsClick && supportsDrag` → drag only (rare; preserves the original useDragRect-only behavior).
- `!supportsClick && !supportsDrag` → no pointer handlers (the resulting Tool is a no-op; useful for harness adapters).

`applyHitExistingGate(ctx, hitExisting)` runs at the top of both `onClick` and `drag.onStart` — when a body hit is found, it selects and returns `'claim'` short-circuiting the insert. `applyOpsRef.current` is set at the entry of click/drag-start and cleared at the end/cancel of drag (and at the end of the synchronous click handler).

- [ ] **Step 2: Rewrite the tool factory body**

The wrapper is a *hook* (uses `useRef`/`useMemo`) — it stays that way. Only the inner `defineTool(...)` call gets swapped. The hit-existing gate moves into route actions; the click and drag handlers become declarative.

Replace `import { defineTool } from '../defineTool';` with `import { defineTool, claim, begin } from '../routing';`. Inside the `useMemo`, replace the `defineTool({...})` call:

```ts
return defineTool<undefined>({
  id,
  cursor,
  ...(keybinding ? { keybinding } : {}),
  ...(presentation ? { presentation } : {}),
  initial: {
    overlay: () => overlay,
    ...(supportsClick
      ? {
          click: {
            // Universal route — fires for every target (empty, node,
            // affordance). The hit-existing gate runs as part of the
            // action, matching the imperative tool's "always claim,
            // gate inside" semantics.
            '*': (ctx) => {
              if (applyHitExistingGate(ctx, hitExisting)) return claim();
              applyOpsRef.current = ctx.applyOps;
              controller.start(ctx.worldX, ctx.worldY, ctx.modifiers);
              controller.end();
              applyOpsRef.current = null;
              return claim();
            },
          },
        }
      : {}),
    ...(supportsDrag
      ? {
          drag: (ctx) => {
            if (applyHitExistingGate(ctx, hitExisting)) return claim();
            applyOpsRef.current = ctx.applyOps;
            controller.start(ctx.worldX, ctx.worldY, ctx.modifiers);
            return begin({
              scratch: undefined,
              onMove: (c) => {
                controller.move(c.worldX, c.worldY, c.modifiers);
                return claim();
              },
              onRelease: () => {
                controller.end();
                applyOpsRef.current = null;
                return claim();
              },
              onCancel: () => {
                controller.cancel();
                applyOpsRef.current = null;
              },
            });
          },
        }
      : {}),
  },
});
```

Notes:
- `click: { '*': handler }` uses the factory's universal-fallback semantics (verified by `defineTool.ts:126-129` and `:150-153`). The `*` route fires for `category: 'empty'` and any other target the imperative tool would have caught.
- `drag` is function-form (no target table) — matches the imperative tool's "claim every drag," with the hit-existing gate handled inside the action.
- `applyOpsRef` lifecycle is preserved exactly: click writes-then-clears synchronously; drag writes on `start`, clears on `release` and `cancel`.

- [ ] **Step 3: Run the substrate tests**

```bash
npx vitest run src/tools/builtin/defineDragInsertTool.test.ts
```

Expected: all assertions pass. The test file covers click-only, drag-only, click-and-drag, and the hit-existing gate.

- [ ] **Step 4: Run the consumer tests transitively**

```bash
npx vitest run src/tools/builtin/useInsertTool.test.ts src/tools/builtin/useTextTool.test.ts
```

Expected: both pass without code changes in their wrappers. If they fail, the substrate's behavior diverged — most likely the `click: { '*': ... }` route isn't firing for the test fixture's hit-target shape; double-check the `target.category` distribution in the test setup against the universal-fallback logic in `defineTool.ts:126`.

- [ ] **Step 5: Run the full kit suite**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/defineDragInsertTool.ts
git commit -m "refactor(defineDragInsertTool): migrate to declarative routing factory"
```

Body: "Phase 5b substrate. `useInsertTool` and `useTextTool` inherit the migration; no edits needed in their wrappers."

---

## Task 6: Migrate `useEllipseTool`

**Files:**

- Modify: `src/tools/builtin/useEllipseTool.tsx`

Same shape as `useRectTool` (Task 4): `useDragRect` controller, `applyOpsRef` lifecycle, ghost overlay. The only differences from rect are the create-callback signature (takes bounds, returns an ellipse-shaped node) and the overlay's `draw` function (computes a cubic-Bezier ellipse instead of a rect outline). Both are inside closures the migration doesn't touch.

- [ ] **Step 1: Inspect**

Read `src/tools/builtin/useEllipseTool.tsx` and its test. Confirm: imperative `defineTool` with `drag.onStart/onMove/onEnd/onCancel`, `useMemo`'d overlay, `applyOpsRef` set on `onEnd` before `dr.end()`. Identical to rect modulo the overlay's geometry.

- [ ] **Step 2: Rewrite**

Apply the same template as Task 4 Step 2:

```ts
return defineTool<null>({
  id: 'ellipse',
  keybinding: { key: 'E' },
  cursor: 'crosshair',
  initial: {
    overlay: () => overlay,
    drag: (ctx) => {
      dr.start(ctx.worldX, ctx.worldY, ctx.modifiers);
      return begin({
        scratch: null,
        onMove: (c) => {
          dr.move(c.worldX, c.worldY, c.modifiers);
          return claim();
        },
        onRelease: (c) => {
          applyOpsRef.current = c.applyOps;
          dr.end();
          return claim();
        },
        onCancel: () => {
          dr.cancel();
        },
      });
    },
  },
});
```

Imports: swap `'../defineTool'` for `'../routing'`, add `begin, claim`.

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tools/builtin/useEllipseTool.test.tsx
```

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useEllipseTool.tsx
git commit -m "refactor(useEllipseTool): migrate to declarative routing factory"
```

---

## Task 7: Migrate `useLineTool`

**Files:**

- Modify: `src/tools/builtin/useLineTool.tsx`

Differs from rect/ellipse in two ways: (1) the tool's scratch carries the active endpoints + modifier snapshot for overlay rendering (`LineScratch` interface), not just `null`, and (2) there's a `useState` setter for the overlay to bump React. The migration shape is the same — function-form drag returning `begin({ scratch, onMove, onRelease, onCancel })` — but scratch is non-trivial and `setScratchState` style React bumps need to keep working.

- [ ] **Step 1: Inspect**

Read `src/tools/builtin/useLineTool.tsx` and its test. Identify:
- The `LineScratch` shape (`start`, `current`, `shift`, `alt`).
- How scratch is *updated* during the drag (likely written into a ref + a `useState` setter for paint).
- Shift constrains to 15°; alt mirrors. Both read from `ctx.modifiers` on every `onMove`.
- The committed two-endpoint `create(a, b)` callback.

- [ ] **Step 2: Rewrite**

Pattern:

```ts
return defineTool<LineScratch | null>({
  id: 'line',
  keybinding: { key: '\\' /* or whatever the legacy key is */ },
  cursor: 'crosshair',
  initial: {
    overlay: () => overlay,
    drag: (ctx) => {
      const start = { x: ctx.worldX, y: ctx.worldY };
      const scratch: LineScratch = {
        start,
        current: start,
        shift: ctx.modifiers.shift,
        alt: ctx.modifiers.alt,
      };
      // Bump React so the overlay sees the new scratch identity (kept
      // for parity with the imperative useState bump — the routing
      // factory's `begin()` writes scratch into the dispatcher's ctx
      // but doesn't trigger a re-render on its own).
      forceRenderRef.current();
      return begin({
        scratch,
        onMove: (c) => {
          const next = c.modifiers.shift
            ? snapTo15Degrees(scratch.start, { x: c.worldX, y: c.worldY })
            : { x: c.worldX, y: c.worldY };
          scratch.current = next;
          scratch.shift = c.modifiers.shift;
          scratch.alt = c.modifiers.alt;
          forceRenderRef.current();
          return claim();
        },
        onRelease: (c) => {
          const a = scratch.start;
          const b = scratch.current;
          if (Math.hypot(b.x - a.x, b.y - a.y) < (minLength ?? 0)) {
            return claim(); // sub-threshold; no insert (matches legacy)
          }
          const node = createRef.current(a, b);
          if (!node) return claim();
          c.applyOps([createInsertOp({ node, label })], label);
          return claim();
        },
        onCancel: () => {},
      });
    },
  },
});
```

Notes:
- The `useState`/`forceRender` bump pattern is preserved verbatim — same trick the imperative tool uses to make the overlay refresh between pointer events.
- `scratch` is a captured object reference; mutating it in place ensures the same identity flows through the dispatcher's per-event `ctx.scratch` re-spread.
- The `minLength` threshold check stays the same.

If `useLineTool` uses additional scratch fields (e.g. shift-snap target stored separately), preserve those — read the existing file carefully before pasting the template.

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tools/builtin/useLineTool.test.tsx
```

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useLineTool.tsx
git commit -m "refactor(useLineTool): migrate to declarative routing factory"
```

---

## Task 8: Migrate `usePolygonTool`

**Files:**

- Modify: `src/tools/builtin/usePolygonTool.tsx`

Uses `useDragRadial` (center-out drag) and tracks live side-count in a `useRef` + `useState`. Mid-gesture `ArrowUp`/`ArrowDown` adjust sides (range 3–32), wheel adjusts too. The migration adds two new route surfaces beyond rect/ellipse: `keyDown.ArrowUp` / `keyDown.ArrowDown`, and `wheel`.

- [ ] **Step 1: Inspect**

Read `src/tools/builtin/usePolygonTool.tsx` and its test. Identify:
- The drag lifecycle (start/move/end/cancel via `useDragRadial`).
- The `sidesRef` and how `setSidesState` triggers an overlay redraw.
- Keyboard adjustment: `ArrowUp` increments sides (capped at 32), `ArrowDown` decrements (floored at 3).
- Wheel adjustment (if any).
- Overlay closure: reads `sidesRef.current` each `draw`.

- [ ] **Step 2: Rewrite**

```ts
return defineTool<null>({
  id: 'polygon',
  keybinding: { key: /* legacy key */ },
  cursor: 'crosshair',
  initial: {
    overlay: () => overlay,
    drag: (ctx) => {
      dr.start(ctx.worldX, ctx.worldY, ctx.modifiers);
      return begin({
        scratch: null,
        onMove: (c) => {
          dr.move(c.worldX, c.worldY, c.modifiers);
          return claim();
        },
        onRelease: (c) => {
          applyOpsRef.current = c.applyOps;
          dr.end();
          return claim();
        },
        onCancel: () => {
          dr.cancel();
        },
      });
    },
    keyDown: {
      ArrowUp: () => {
        sidesRef.current = Math.min(MAX_SIDES, sidesRef.current + 1);
        setSidesState(sidesRef.current);
        return claim();
      },
      ArrowDown: () => {
        sidesRef.current = Math.max(MIN_SIDES, sidesRef.current - 1);
        setSidesState(sidesRef.current);
        return claim();
      },
    },
    // If the imperative tool has wheel handling, add it. Inspect first.
    // wheel: (_ctx, event) => { ... }
  },
});
```

Notes:
- Always-claim on ArrowUp/Down matches the imperative tool's behavior (it intercepts arrow keys while polygon is active even when not mid-drag, so they don't pan).
- The legacy `MIN_SIDES`/`MAX_SIDES` constants stay; just inline-reference them.

If the legacy file has wheel handling, mirror it via `wheel: (_ctx, event) => { ... }`. If not, omit the wheel route.

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tools/builtin/usePolygonTool.test.tsx
```

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/usePolygonTool.tsx
git commit -m "refactor(usePolygonTool): migrate to declarative routing factory"
```

---

## Task 9: Migrate `useStarTool`

**Files:**

- Modify: `src/tools/builtin/useStarTool.tsx`

Same shape as `usePolygonTool` — `useDragRadial`, `pointsRef` + `setPointsState`, `ArrowUp`/`ArrowDown` adjusts point count (3–32), inner-ratio override. The migration is the polygon template with `pointsRef`/`MIN_POINTS`/`MAX_POINTS` substituted.

- [ ] **Step 1: Inspect**

Read `src/tools/builtin/useStarTool.tsx`. Confirm it mirrors the polygon pattern: a star-specific overlay (outer + inner radius via points), a `pointsRef`/`setPointsState`, and `MIN_POINTS`/`MAX_POINTS` constants.

- [ ] **Step 2: Rewrite**

Apply the polygon Task 8 template verbatim, substituting `points` for `sides` and `MIN_POINTS`/`MAX_POINTS` for `MIN_SIDES`/`MAX_SIDES`. The drag, overlay-thunk, and ArrowUp/Down route shape are identical.

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tools/builtin/useStarTool.test.tsx
```

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useStarTool.tsx
git commit -m "refactor(useStarTool): migrate to declarative routing factory"
```

---

## Task 10: Migrate `usePencilTool`

**Files:**

- Modify: `src/tools/builtin/usePencilTool.tsx`

Freehand pencil — accumulates pointer samples through the drag, fits a Bezier path via `schneiderFit` on release. Scratch is a `PencilScratch | null` carrying `{ samples }`. The fit-on-release path is where `closeThreshold` decides whether the resulting `PolygonPath` is open or closed.

- [ ] **Step 1: Inspect**

Read `src/tools/builtin/usePencilTool.tsx`. Identify:
- `PencilScratch` shape and how samples are appended.
- The `samplesRef` (for overlay) vs scratch (for begin/move/release lifecycle).
- The fit-on-release logic via `schneiderFit(samples, tolerance)` and the `closeThreshold` check.

- [ ] **Step 2: Rewrite**

```ts
return defineTool<PencilScratch | null>({
  id: 'pencil',
  keybinding: { key: 'N' /* or legacy */ },
  cursor: 'crosshair',
  initial: {
    overlay: () => overlay,
    drag: (ctx) => {
      const samples: PencilPoint[] = [{ x: ctx.worldX, y: ctx.worldY }];
      samplesRef.current = samples;
      forceRenderRef.current();
      return begin({
        scratch: { samples },
        onMove: (c) => {
          samples.push({ x: c.worldX, y: c.worldY });
          forceRenderRef.current();
          return claim();
        },
        onRelease: (c) => {
          if (samples.length < 2) return claim();
          const path = schneiderFit(samples, tolerance);
          const first = samples[0];
          const last = samples[samples.length - 1];
          const closed = Math.hypot(last.x - first.x, last.y - first.y) <= closeThreshold;
          const node = createRef.current(path, { closed });
          if (!node) {
            samplesRef.current = null;
            return claim();
          }
          c.applyOps([createInsertOp({ node, label })], label);
          samplesRef.current = null;
          forceRenderRef.current();
          return claim();
        },
        onCancel: () => {
          samplesRef.current = null;
          forceRenderRef.current();
        },
      });
    },
  },
});
```

Notes:
- `samplesRef` is the parallel ref the overlay's `draw` closure reads. The scratch carries the same array by reference so both views agree.
- `forceRender` matches the imperative tool's `useState` bump to keep the overlay re-painted between pointer events.

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tools/builtin/usePencilTool.test.tsx
```

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/usePencilTool.tsx
git commit -m "refactor(usePencilTool): migrate to declarative routing factory"
```

---

## Task 11: Migrate `useCloneTool`

**Files:**

- Modify: `src/tools/builtin/useCloneTool.ts`

Distinct from the shape tools: clone is a *gesture* tool, not an insert tool. It binds to pointerdown on existing bodies and at threshold-cross hands off to a clone controller. Scratch carries `{ pendingId, pendingMods }` captured on pointerdown. The tool's `behaviors[]` config decides whether the current modifier state activates the clone — plain (no-modifier) drags should fall through to the active-slot tool's drag, so the pointerdown route must return `none()` when no behavior activates.

- [ ] **Step 1: Inspect**

Read `src/tools/builtin/useCloneTool.ts` (already partially surveyed above) and its test. Identify:
- The pointerdown gate: only claim when (a) the pointer hit a body via `pickBest` and (b) some behavior in `behaviors[]` activates for the current modifiers.
- The scratch handoff: `pendingId` + `pendingMods` captured on `onDown`, replayed on `drag.onStart` into `clone.start(pendingId, ...)`.
- Cancellation via Escape (if present) or `drag.onCancel`.
- Overlay: live clone ghost rendered via `drawGhost` or `drawOne` fallback.

- [ ] **Step 2: Rewrite**

Use `pointerDown` (Phase 4.5 channel) for the classifier:

```ts
return defineTool<CloneScratch>({
  id: 'clone',
  initial: {
    overlay: () => overlay,
    pointerDown: {
      '*': (ctx) => {
        const id = pickBestRef.current(ctx.worldX, ctx.worldY);
        if (!id) return none();
        const mods = { /* extract from ctx.modifiers */ };
        if (!behaviorsRef.current.some((b) => b.activates(mods))) return none();
        // Open engaged with scratch — no continuations yet; drag.onStart
        // picks up the pending id below.
        return begin({
          scratch: { pendingId: id, pendingMods: mods },
        });
      },
    },
    drag: (ctx) => {
      const s = ctx.scratch;
      if (!s.pendingId || !s.pendingMods) return none();
      clone.start(s.pendingId, ctx.worldX, ctx.worldY, s.pendingMods);
      return begin({
        scratch: s,
        onMove: (c) => {
          clone.move(c.worldX, c.worldY);
          return claim();
        },
        onRelease: (c) => {
          c.applyOps(clone.end(), 'Clone');
          return claim();
        },
        onCancel: () => {
          clone.cancel();
        },
      });
    },
  },
});
```

Notes:
- The `pointerDown` route returns `begin({ scratch })` *without* a continuation — pure classifier mode (Phase 4.5 semantics). The subsequent `drag.onStart` reads `ctx.scratch.pendingId` to know what to clone.
- Returning `none()` when no behavior activates lets the dispatcher fall through to the active-slot tool's drag (e.g. select tool's move), preserving the legacy non-modifier-drag pass-through.
- The two `begin()`s in sequence — pointerDown opens engaged with scratch; drag.onStart returns another `begin()` to install continuations. The factory's `activeSpec` slot only stores the most recent `BeginSpec`; the second `begin()` replaces the first (which had no continuations anyway).

If the test reveals that `useCloneTool` also handles Escape or has wheel hooks, fold them into the `initial.keyDown` / `initial.wheel` routes.

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tools/builtin/useCloneTool.test.tsx
```

If the test asserts behavior that requires the pointerDown classifier scratch to survive through the click+drag fork (e.g. "pointerdown without crossing threshold still selects the hit body"), verify the factory's `pointerDown→click` path handles this correctly. The factory's onClick reads `ctx.target` for routing; clone has no `click` route, so a sub-threshold tap should fall through to ambient tools — confirm that matches the imperative behavior. If not, add `click: { '*': (ctx) => none() }` to make the pass-through explicit.

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useCloneTool.ts
git commit -m "refactor(useCloneTool): migrate to declarative routing factory"
```

---

## Task 12: Migrate `useEditAnchorsTool`

**Files:**

- Modify: `src/tools/builtin/useEditAnchorsTool.ts`

Anchor-editing tool — typically reachable via `dblTap` from `useSelectTool` (see `useSelectWithAnchorEdit.ts`). Has hit-test routing for anchors vs handles vs body, drag-to-move-anchor, possibly delete-anchor on backspace, escape-to-exit. The migration uses target-based routing (`drag: { 'anchor:*': ..., 'handle:*': ... }` style) if the imperative tool already discriminates by target, or function-form drag with internal hit dispatch if it does its own hit math.

- [ ] **Step 1: Inspect**

Read `src/tools/builtin/useEditAnchorsTool.ts` and its test (`useEditAnchorsTool.test.tsx`). Identify:
- What targets it accepts on pointerdown / drag (anchor handles? body? empty?).
- Whether it uses `ctx.target` discrimination today or hand-rolls a hit test.
- Keyboard handlers (Escape, Backspace, Delete).
- Overlay (anchor markers, handle lines).

- [ ] **Step 2: Rewrite**

The detailed shape depends on the inspection step. Two likely patterns:

**Pattern A — if the imperative tool already uses target categories:**

```ts
initial: {
  overlay: () => overlay,
  drag: {
    // Routes keyed by ctx.target.kind, e.g. 'anchor', 'handle', 'body'.
    'anchor': (ctx) => begin({ /* drag anchor */ }),
    'handle': (ctx) => begin({ /* drag handle */ }),
    '*': () => none(),  // empty / unrecognized → pass
  },
  keyDown: {
    Escape: () => { /* exit edit */ return claim(); },
    Backspace: () => { /* delete anchor */ return claim(); },
    Delete: () => { /* delete anchor */ return claim(); },
  },
},
```

**Pattern B — if it hand-rolls hit math today:**

Keep the function-form drag and call into the existing hit-helper inside the action:

```ts
drag: (ctx) => {
  const hit = hitTestAnchorOrHandle(ctx.worldX, ctx.worldY);
  if (!hit) return none();
  // ... dispatch on hit kind
  return begin({ /* ... */ });
},
```

Choose based on the inspection. Pattern A is preferred when feasible (it surfaces the routing in the action registry / debug overlay for free).

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tools/builtin/useEditAnchorsTool.test.tsx
```

- [ ] **Step 4: Run full suite**

```bash
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useEditAnchorsTool.ts
git commit -m "refactor(useEditAnchorsTool): migrate to declarative routing factory"
```

---

## Task 13: Migrate `useUserPenTool`

**Files:**

- Modify: `src/tools/builtin/useUserPenTool.ts`

The most complex tool in the migration. Multi-mode state machine (Idle / Drawing / BetweenSubpaths) tracked via persistent scratch held in a ref (`scratchRef`) outside the dispatcher's `initScratch` contract — Phase 3 hand-rolled `initScratch: () => scratchRef.current!` to thread the same object through every gesture.

The imperative pen surfaces:

- `pointer.onDown`: capture `_pendingDown` (snapped coords + alt/shift) so subsequent click or drag handler uses down-time coords/modifiers.
- `pointer.onClick`: place a corner anchor, or close-on-first-anchor, or open-finish on Cmd+click, or double-click-detect open-finish.
- `drag.onStart`: place an anchor with an outgoing handle (Illustrator smooth anchor).
- `drag.onMove`: update outgoing handle (alt breaks mirror).
- `drag.onEnd`: commit the smooth anchor and record `_lastClick` for double-click detection.
- `keyboard.onDown`: Enter open-finishes, Escape discards.
- `cursor`: function-form, reads `scratch.closeHintActive`.
- `onDeactivate`: commit (≥2 anchors) or discard.
- `forceRender` bump every state change so the overlay re-paints.

This maps onto the declarative factory cleanly because Phase 4.5 already shipped `pointerDown` (for the `_pendingDown` capture), the `event` parameter on `ActionFn` (for raw KeyboardEvent reads), and modifier-aware routing (for Cmd+click vs plain click).

The persistent-scratch ref pattern (`scratchRef.current` lives across gestures) doesn't go through the declarative factory's scratch slot — the imperative pen tool sets `Tool.initScratch: () => scratchRef.current!` to hand the same mutable object back every time the dispatcher asks. The declarative factory's auto-`initScratch: () => null` doesn't preserve this. We have three options:

1. **Add `def.initScratch?: () => TScratch` to `ToolDef`** and forward it through the factory. This is a third small substrate addition. Mechanical and bounded.
2. **Don't migrate `useUserPenTool` in 5b — defer to 5c with the precondition that `initScratch` lands first.**
3. **Restructure pen to not need persistent scratch** — too invasive; defer.

**Recommended: option 1.** It's a half-day's work and unblocks pen cleanly. Add it as Task 13's Step 0 (substrate dependency).

- [ ] **Step 0: Substrate — add `initScratch?` to `ToolDef`**

Edit `src/tools/routing/types.ts`. Add to `ToolDef`:

```ts
/** Override the default scratch initializer. Default is `() => null`
 *  cast to `TScratch`, which works for tools whose scratch is fresh
 *  every gesture. Tools that need scratch identity to survive across
 *  gesture boundaries (e.g. the pen tool's multi-click subpath state)
 *  pass a stable-ref-returning thunk here. The factory forwards this
 *  onto the returned `Tool.initScratch`. */
initScratch?: () => TScratch;
```

Edit `src/tools/routing/defineTool.ts`. Change the existing line:

```ts
initScratch: () => null as unknown as TScratch,
```

to:

```ts
initScratch: def.initScratch ?? (() => null as unknown as TScratch),
```

Add a test in `defineTool.test.ts`:

```ts
it('forwards def.initScratch onto Tool.initScratch', () => {
  const shared = { count: 0 };
  const tool = defineTool({
    id: 'fixture-scratch',
    initScratch: () => shared,
    initial: {},
  });
  expect(tool.initScratch!()).toBe(shared);
  expect(tool.initScratch!()).toBe(shared); // same identity each call
});
```

Commit this substrate-prep step before the pen migration itself:

```bash
git add src/tools/routing/types.ts src/tools/routing/defineTool.ts src/tools/routing/defineTool.test.ts
git commit -m "feat(routing): support custom initScratch on ToolDef"
```

- [ ] **Step 1: Inspect `useUserPenTool`**

Re-read `src/tools/builtin/useUserPenTool.ts` end-to-end. Note every state mutation site and which channel triggers it. Map each onto a declarative route:

| Imperative site | Declarative route |
|---|---|
| `pointer.onDown` (capture `_pendingDown`) | `initial.pointerDown: { '*': (ctx) => { ...; return claim(); } }` |
| `pointer.onClick` (corner-anchor / close / open-finish) | `initial.click: { '*': (ctx, e) => ... }` with modifier check via raw event |
| `drag.onStart` (place anchor + outHandle) | `initial.drag: (ctx) => begin({ scratch, onMove, onRelease, onCancel })` |
| `keyboard.onDown` (Enter / Escape) | `initial.keyDown: { Enter, Escape }` |
| `cursor` (function-form) | `cursor: (ctx) => ctx.scratch?.closeHintActive ? 'pointer' : 'crosshair'` |
| `onDeactivate` (commit ≥2 / discard) | `onDeactivate: (ctx) => { ... }` (already supported) |
| `initScratch` (return persistent `scratchRef.current`) | Step 0 substrate |

The pen does NOT currently use `claimsAll` (no migrations from imperative). But the migration *could* set `claimsAll: (ctx) => ctx.scratch?.current?.anchors?.length ?? 0 > 0`, expressing "while mid-path, claim all" — that would actually fix a latent bug where affordance hits during multi-click can interrupt the path. **Decision: do NOT set `claimsAll` in this migration.** It changes user-visible behavior and the imperative pen explicitly doesn't have it. Document the option in a comment for a follow-up.

- [ ] **Step 2: Rewrite**

Swap the import: `import { defineTool, claim, none, begin } from '../routing';`. Inside the `useMemo`, replace the imperative tool body. The pen's scratch carries enough state that the declarative form doesn't need a separate `engaged` phase — every route handler reads `ctx.scratch` and decides what to do based on the state machine.

Sketch:

```ts
return defineTool<PenScratch>({
  id: 'pen',
  keybinding: { key: 'P' },
  cursor: (ctx) => (ctx.scratch?.closeHintActive ? 'pointer' : 'crosshair'),
  presentation: {
    label: 'Pen',
    icon: createElement(PenIcon),
    group: 'draw',
  },
  initScratch: () => scratchRef.current!,
  onDeactivate: (ctx) => {
    const s = ctx.scratch;
    const cur = s.current;
    const totalAnchors =
      (cur ? cur.anchors.length : 0) +
      s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);
    if (totalAnchors >= 2) commit(s);
    else resetScratch(s);
  },
  initial: {
    pointerDown: {
      '*': (ctx) => {
        const s = ctx.scratch;
        const snap = optsRef.current.snapPoint;
        const p = snap ? snap({ x: ctx.worldX, y: ctx.worldY }) : { x: ctx.worldX, y: ctx.worldY };
        s._pendingDown = {
          worldX: p.x, worldY: p.y,
          alt: ctx.modifiers.alt, shift: ctx.modifiers.shift,
        };
        forceRenderRef.current();
        // Return none() so the dispatcher continues to the click/drag fork.
        // The factory's pointerDown semantics: none() means "scratch is
        // already updated, but we're not engaging — let click/drag classify."
        return none();
      },
    },
    click: {
      '*': (ctx, _e) => {
        // ... port the existing pointer.onClick body verbatim, returning
        // claim() at the end of each branch. The modifier check
        // (ctx.modifiers.meta || ctx.modifiers.ctrl) replaces the
        // imperative ctx.modifiers reads — same source, same semantics.
      },
    },
    drag: (ctx) => {
      // Port drag.onStart body. The returned begin() installs
      // onMove/onRelease/onCancel continuations.
      const s = ctx.scratch;
      const down = s._pendingDown;
      // ... existing onStart body ...
      return begin({
        scratch: s,
        onMove: (c) => {
          // ... existing onMove body ...
          return claim();
        },
        onRelease: (c) => {
          // ... existing onEnd body ...
          return claim();
        },
        onCancel: (c) => {
          c.scratch.draggingHandleAt = null;
          c.scratch._pendingDown = null;
          forceRenderRef.current();
        },
      });
    },
    keyDown: {
      Enter: (ctx) => {
        const s = ctx.scratch;
        const totalAnchors =
          (s.current ? s.current.anchors.length : 0) +
          s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);
        if (totalAnchors === 0) return none();
        commit(s);
        forceRenderRef.current();
        return claim();
      },
      Escape: (ctx) => {
        const s = ctx.scratch;
        if (s.current === null && s.finishedSubpaths.length === 0) return none();
        resetScratch(s);
        forceRenderRef.current();
        return claim();
      },
    },
    overlay: () => penOverlayLayer,  // construct via useMemo above
  },
});
```

Important behavioral notes (verify against existing test):
- `pointerDown` returns `none()` after capturing `_pendingDown` — this means the factory does *not* open engaged from pointerDown; the next gesture stage (click or drag) reads `_pendingDown` from scratch on its own. The scratch mutation is sticky because `scratchRef.current` survives across gestures.
- The `click: { '*': ... }` route fires on every click target (the universal-fallback path in `defineTool.ts:126` handles empty-canvas clicks). Pen needs both anchor-on-empty and click-on-existing-affordance (close-on-first-anchor), so a single `'*'` route is appropriate.
- The pen tool's current code uses persistent `scratchRef.current`, so even though the factory's `applyResult` writes `ctx.scratch = null` on commit/cancel, the next gesture's `initScratch` returns the *same* `scratchRef.current` object whose fields were reset via `resetScratch(s)`. Verify the test still passes — if the dispatcher's per-gesture scratch reset interacts badly with the persistent ref, work around by treating `null` as "no current subpath" inside the routes (which the existing code already does).

Critical subtle point: the imperative pen tool's `initScratch` returns the same ref every time, *and* `applyResult` (commit/cancel) sets `ctx.scratch = null` on the *local ctx*. The persistent state is preserved because `scratchRef.current` is reset in-place via `resetScratch(s)` before the factory writes `null` to ctx.scratch. After commit, the next gesture's `initScratch` returns the same (now-reset) ref again. **Verify this works post-migration** — if `applyResult` writes `null` to the ctx and the next gesture reads `null` from ctx.scratch (because `initScratch` ran but the dispatcher didn't update ctx), the pen breaks. If broken, fix by returning `claim()` from terminal pen actions instead of `commit()`/`cancel()` — `claim()` doesn't touch scratch — and let the pen tool manage scratch nullification internally via `resetScratch`.

- [ ] **Step 3: Run the pen test file (large, expect a long run)**

```bash
npx vitest run src/tools/builtin/useUserPenTool.test.tsx
```

Expected: all assertions pass. The pen test is the most behaviorally dense in the kit — every Illustrator convention has its own assertion. If anything fails, narrow to the failing test name and trace the route resolution by adding a temporary `console.log` in the affected action.

- [ ] **Step 4: Run full kit suite**

```bash
npx vitest run
```

Baseline holds. Pen migration is the last regression risk before the final gate.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useUserPenTool.ts
git commit -m "refactor(useUserPenTool): migrate to declarative routing factory"
```

Body: "Phase 5b — most complex migration in the kit. Multi-mode state machine (Idle / Drawing / BetweenSubpaths) preserved via the new `def.initScratch` substrate that threads a stable scratch ref through every gesture. All routes (`pointerDown`, `click`, `drag`, `keyDown`) declarative; cursor + onDeactivate forwarded; persistent `scratchRef` survives commit/cancel."

---

## Task 14: Final regression sweep — full prepublishOnly gate

After all migrations are committed individually, run the release gate end-to-end. This matches CI and catches anything `vitest` alone misses.

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

Zero errors.

- [ ] **Step 2: Full test run**

```bash
npx vitest run
```

Same pass/fail count as the pre-Phase-5b baseline. Note the baseline by running this command before starting Task 1.

- [ ] **Step 3: Production build**

```bash
npx tsup build
```

Build succeeds.

- [ ] **Step 4: Sanity check zero imperative-defineTool consumers in body-hit tools**

```bash
grep -rn "from '../defineTool'" src/tools/builtin/
```

Expected matches: only the viewport tools (`useWheelPanTool.ts`, `useWheelZoomTool.ts`, `useKeyboardZoomTool.ts`) which are deferred to 5c. Every body-hit tool — and `defineDragInsertTool` — must be absent from this list. If any body-hit tool still imports from `../defineTool`, its migration was incomplete.

- [ ] **Step 5: Update the spec's migration-status section**

Open `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`. The spec tracks per-tool migration progress; append Phase 5b's completion entry and tick off each tool. If no such table exists, add a short paragraph noting Phase 5b completion and listing the migrated tools.

- [ ] **Step 6: Sanity-check the action registry / debug overlay reflects new routes**

Run the kit's interactive demo (or relevant story) and open the debug overlay. Confirm that activating `useLassoTool`, `useEllipseTool`, etc. now shows their routes in the registry — they'll appear because the declarative factory reports route resolutions via `__reportRoute` whereas the imperative form never did. This is a *feature* of the migration, not a regression — flag it if any consumer shows unexpected routes (e.g. if a tool resolves `'*'` when a more-specific route was expected).

---

## What Phase 5c will pick up

Three follow-up scopes are intentionally out of 5b:

1. **Viewport tool migrations.** `useWheelPanTool`, `useWheelZoomTool`, `useKeyboardZoomTool`, `usePinchZoomTool` all use the imperative `defineTool` from `../defineTool`. They should migrate to `defineViewportTool` from `../routing` — a smaller surface (no body hits, no `click`/`dblTap`, drag is function-form) and an independent batch from the body-hit tools handled here.
2. **Phase-specific overlays.** Phase 5b's overlay forwarding only reads `def.initial.overlay`. If a future tool needs different overlays in initial vs engaged phase (e.g. select tool's selection-outline vs in-flight-move ghost), the factory needs a `phaseOf(ctx).overlay`-style lookup at draw time. This requires reworking `Tool.overlay` from a static `RenderLayer` to a thunk the dispatcher invokes per render — a non-trivial cross-cut.
3. **Pen tool's latent `claimsAll` enhancement.** Setting `claimsAll: (ctx) => ctx.scratch?.current?.anchors?.length > 0` would fix a latent bug where mid-path affordance hits can interrupt the pen. Out of 5b because it changes user-visible behavior; in 5c after validating with the pen's existing test suite that affordance interruptions are actually problematic.

---

## Self-review checklist (per writing-plans skill)

- [x] **Spec coverage** — every deferred-from-5a tool gets a task: `useLassoTool` (T3), `useTextTool` via `defineDragInsertTool` (T5), `useUserPenTool` (T13). `useUserTextTool` documented as nonexistent (removed from scope).
- [x] **Placeholder scan** — no `TBD`, no "implement later." Each task has either complete code or an explicit inspection step before code.
- [x] **Type consistency** — `claimsAll: boolean | ((ctx: ToolCtx<TScratch>) => boolean)` consistent across Task 2 (substrate) and the no-op in Task 13 (pen doesn't set it). `initScratch?: () => TScratch` consistent across Task 13 Step 0 (substrate) and the pen consumer.
- [x] **Step content** — each step shows real code or a real command with expected output.
- [x] **Survey-driven** — the task list reflects what the survey found (10 tool files unmigrated, two of them inheriting via `defineDragInsertTool`), not the prompt's pre-survey guess of five.
