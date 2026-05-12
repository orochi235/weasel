# Declarative tool routing — Phase 4.5 (Factory completeness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two known gaps in the routing factory surface (no pointerDown channel; ActionFn missing raw event) so Phase 5 tool migrations don't need imperative shims.

**Architecture:** Phase 4.5 extends the existing `routing/` module — no new files, no new submodules. Two type surface changes ripple through the factory translator:

1. `PhaseDef` grows a `pointerDown?: RouteTable<TScratch>` field; `defineTool` emits a `pointer.onDown` handler that runs the route table before any threshold-gated channel. Most `pointerDown` routes return `begin(spec)` (engage immediately) or set classifier scratch via `begin({ scratch, ... })` with no `onMove` / `onRelease` so the subsequent click vs. drag channels in the same gesture see the prepared scratch.
2. `ActionFn<TScratch>` and the three `BeginSpec` continuations (`onMove`, `onRelease`, `onCancel`) gain an optional second parameter: the raw DOM event (`PointerEvent | KeyboardEvent | WheelEvent`). The factory threads `_e` (already in scope in every translator branch) through to user code. Existing route tables that ignore the parameter type-check unchanged because the parameter is optional.

After both ship, useSelectTool's three remaining imperative shims (`pointer.onDown`, `pointer.onClick`, `dblTap.onTap`) collapse into declarative routes. The legacy imperative `drag` shim built around `useMove`/`useResize`/`useRotate` already migrated in Phase 3 Task 4 and is unaffected here.

**Tech Stack:** TypeScript, React 18+, Vitest. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`.
**Predecessors:**
- Phase 1 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-1.md`
- Phase 2 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-2.md`
- Phase 3 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-3.md`

**Phase 3 T3 reported the gaps verbatim:**
> 1. **No `pointer.onDown`** — the routing factory only emits `pointer.onClick`.
> 2. **No PointerEvent in ActionFn** — `ActionFn<TScratch>` only receives `ctx`.

---

### File map

**Modified:**

- `src/tools/routing/types.ts` — add `pointerDown?: RouteTable<TScratch>` to `PhaseDef`; change `ActionFn<TScratch>` to accept an optional `event` parameter.
- `src/tools/routing/result.ts` — change `BeginSpec<TScratch>`'s `onMove` / `onRelease` / `onCancel` signatures to accept an optional `event` parameter.
- `src/tools/routing/defineTool.ts` — add an `onDown` builder that consults `phase.pointerDown`; thread the raw event into every `applyResult` / continuation call.
- `src/tools/routing/defineTool.test.ts` — add tests for `pointerDown` routing and for `event` propagation.
- `src/tools/routing/lookup.test.ts` — no schema change to `RouteTable` itself, but add a smoke test verifying `pointerDown`-style tables resolve identically.
- `src/tools/builtin/useSelectTool.ts` — replace `legacyOnDown`, `pointer.onClick`, and `dblTap.onTap` shims with declarative routes that consume the new `event` parameter and the new `pointerDown` channel.
- `src/tools/builtin/useSelectTool.test.tsx` — no behavior change, but verify the migrated tool's onDoubleTap callback still fires with the raw event.
- `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md` — append a Phase 4.5 follow-up section documenting `pointerDown` and the `event` parameter on `ActionFn` / continuations.

**Not modified:**

- `src/tools/routing/defineViewportTool.ts` — `ViewportPhaseDef` is a `Pick` over `PhaseDef` and intentionally does NOT include `pointerDown` (viewport tools don't have body-hit classifiers). No change needed.

---

## Task 1: Extend `PhaseDef` with `pointerDown` and update lookup smoke test

**Files:**

- Modify: `src/tools/routing/types.ts`
- Modify: `src/tools/routing/lookup.test.ts`

The `pointerDown` field reuses `RouteTable<TScratch>` — same key grammar (target kinds, modifier sub-tables) as `click` and `drag` route tables. No new lookup engine code; the existing `resolveRoute` works unchanged. This task is the smallest possible "schema lights up" step before the translator wires it up in Task 2.

- [ ] **Step 1: Add the `pointerDown` field to `PhaseDef`**

Edit `src/tools/routing/types.ts`. After the existing `click?: RouteTable<TScratch>;` line in `PhaseDef`, insert:

```ts
/** Pre-threshold classifier route. Runs synchronously on pointerdown,
 *  before the dispatcher distinguishes click vs. drag. Use this for
 *  classification gestures that need to mutate scratch *before* the
 *  drag pipeline starts — e.g. select tool determining whether a hit
 *  belongs to the existing selection ("drag will move all") or not
 *  ("drag will move just this one").
 *
 *  Semantics:
 *  - Return `begin(spec)` to open engaged phase with scratch. The
 *    spec's `onMove`/`onRelease` will fire if the dispatcher escalates
 *    to drag; otherwise the next click handler runs normally with the
 *    prepared scratch visible.
 *  - Return `apply(ops)` or `commit(ops)` to finish the gesture
 *    immediately (rare).
 *  - Return `none()` or omit to pass through to threshold-gated
 *    click/drag classification.
 *
 *  Phase 4.5 (factory completeness). Predates the imperative
 *  `pointer.onDown` channel that useSelectTool used through Phase 3. */
pointerDown?: RouteTable<TScratch>;
```

- [ ] **Step 2: Verify nothing broke**

```bash
cd /Users/mike/src/weasel
npx tsc --noEmit
```

Expected: clean. The new field is optional; no existing tool defines it, so type-check passes.

- [ ] **Step 3: Add a smoke test that `pointerDown` route tables go through `resolveRoute`**

Append to `src/tools/routing/lookup.test.ts`:

```ts
describe('resolveRoute against a pointerDown-shaped table', () => {
  it('same precedence rules apply (exact > subkind > base > universal)', () => {
    const onRect = vi.fn();
    const onAny  = vi.fn();
    // pointerDown tables are RouteTable<TScratch> just like click/drag,
    // so resolveRoute treats them identically. This test pins that
    // contract: changing PhaseDef.pointerDown's value type would have
    // to update this expectation.
    const table: RouteTable<void> = {
      'rect': onRect as ActionFn<void>,
      '*':    onAny  as ActionFn<void>,
    };
    expect(resolveRoute(table, nodeHit('rect'), noMods)).toBe(onRect);
    expect(resolveRoute(table, nodeHit('text'), noMods)).toBe(onAny);
  });
});
```

- [ ] **Step 4: Run the lookup tests**

```bash
npx vitest run src/tools/routing/lookup.test.ts
```

Expected output (last lines):
```
Tests  9 passed (9)
```

The eight pre-existing tests plus one new test.

- [ ] **Step 5: Commit**

```bash
git add src/tools/routing/types.ts src/tools/routing/lookup.test.ts
git commit -m "$(cat <<'EOF'
feat(routing): PhaseDef.pointerDown field for pre-threshold classifiers

Adds a pointerDown route table to PhaseDef. Reuses RouteTable<TScratch>
so the existing four-level lookup precedence applies unchanged. Wiring
through defineTool lands in Task 2; this commit is type-only plus a
smoke test that pinpoints the resolveRoute contract.

Phase 4.5 of the declarative routing rollout — closes gap #1 from
Phase 3 Task 3's migration report.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire `pointerDown` through `defineTool` translator

**Files:**

- Modify: `src/tools/routing/defineTool.ts`
- Modify: `src/tools/routing/defineTool.test.ts`

The translator gains an `onDown` builder analogous to the existing `onClick` builder. It runs the route table and applies the result via `applyResult`. The dispatcher already invokes `pointer.onDown` before threshold-gated drag; no dispatcher change needed.

- [ ] **Step 1: Write the failing test first (TDD)**

Append to `src/tools/routing/defineTool.test.ts`:

```ts
describe('defineTool — pointerDown route', () => {
  it('emits a pointer.onDown handler when initial.pointerDown is defined', () => {
    const tool = defineTool({
      id: 'test',
      initial: {
        pointerDown: { 'rect': () => claim() },
      },
    });
    expect(tool.pointer?.onDown).toBeDefined();
  });

  it('omits pointer.onDown when no pointerDown route table is defined', () => {
    const tool = defineTool({
      id: 'test',
      initial: { click: { '*': () => apply([stubOp]) } },
    });
    expect(tool.pointer?.onDown).toBeUndefined();
  });

  it('pointerDown action fires before any threshold gate (sets scratch via begin)', () => {
    const tool = defineTool<{ classification: string }>({
      id: 'test',
      initial: {
        pointerDown: {
          'rect': () => begin({
            scratch: { classification: 'in-selection' },
          }),
        },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    tool.pointer?.onDown?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect((ctx as { scratch: unknown }).scratch).toEqual({ classification: 'in-selection' });
  });

  it('pointerDown returning none falls through (pass)', () => {
    const tool = defineTool({
      id: 'test',
      initial: {
        pointerDown: { 'rect': () => ({ kind: 'none' as const }) },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    const result = tool.pointer?.onDown?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect(result).toBe('pass');
  });

  it('engaged.pointerDown routes when scratch is set', () => {
    const onAnchorDown = vi.fn(() => claim());
    const tool = defineTool<{ anchors: number[] }>({
      id: 'pen',
      initial: {
        pointerDown: { 'empty': () => begin({ scratch: { anchors: [] } }) },
      },
      engaged: {
        pointerDown: { '*': onAnchorDown },
      },
    });
    const ctx = buildCtx();
    // First down opens engaged phase
    tool.pointer?.onDown?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    // Second down — now engaged
    tool.pointer?.onDown?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    expect(onAnchorDown).toHaveBeenCalledTimes(1);
  });
});
```

Note `claim` is already imported at the top of the file; `apply`, `begin`, `commit`, `cancel`, `hold` are too. No new imports required.

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run src/tools/routing/defineTool.test.ts
```

Expected: the new tests fail with `tool.pointer?.onDown` being `undefined` (the existing translator only emits `onClick`).

- [ ] **Step 3: Implement `onDown` in the translator**

Edit `src/tools/routing/defineTool.ts`. Inside the `defineTool` body, after the existing `onClick` builder block (around line 87), insert:

```ts
// Build pointer.onDown handler from pointerDown route table. Mirrors
// onClick but runs at pointerdown (pre-threshold). Returns 'pass' for
// unrouted targets and for routes that return none(), so the
// dispatcher can continue to its threshold-gated click vs. drag
// classification.
const onDown = def.initial.pointerDown || def.engaged?.pointerDown
  ? (_e: PointerEvent, ctx: ToolCtx<TScratch>): 'claim' | 'pass' => {
      const phase = phaseOf(ctx);
      if (!phase.pointerDown) return 'pass';
      if (!ctx.target) return 'pass';
      let action = resolveRoute(phase.pointerDown, ctx.target, ctx.modifiers);
      // Universal fallback for empty hits — mirrors onClick semantics
      // so engaged-phase '*' routes (e.g. pen's empty-canvas anchor
      // add) respond to pointerdown on background.
      if (!action && ctx.target.category === 'empty') {
        const star = phase.pointerDown['*'];
        if (typeof star === 'function') action = star;
      }
      if (!action) return 'pass';
      return applyResult(ctx, action(ctx));
    }
  : undefined;
```

Then update the `pointer:` key in the returned Tool object (around line 166). Change:

```ts
pointer: onClick ? { onClick } : undefined,
```

to:

```ts
pointer: (onClick || onDown)
  ? { ...(onClick ? { onClick } : {}), ...(onDown ? { onDown } : {}) }
  : undefined,
```

The spread-then-conditional pattern keeps `onClick`/`onDown` independently optional on the resulting `Tool.pointer` shape, matching the dispatcher's expectation that either / both can be absent.

- [ ] **Step 4: Run to confirm pass**

```bash
npx vitest run src/tools/routing/defineTool.test.ts
```

Expected: all tests pass — both the original 9 and the 5 new pointerDown tests.

- [ ] **Step 5: Run the full routing test suite as a regression check**

```bash
npx vitest run src/tools/routing/
```

Expected: every routing test passes.

- [ ] **Step 6: Commit**

```bash
git add src/tools/routing/defineTool.ts src/tools/routing/defineTool.test.ts
git commit -m "$(cat <<'EOF'
feat(routing): defineTool emits pointer.onDown from pointerDown routes

The factory now translates PhaseDef.pointerDown into a pointer.onDown
handler on the returned Tool, mirroring the existing onClick builder
exactly. Empty-hit universal fallback ('*') applies the same way it
does for onClick so engaged-phase catch-alls work. begin(spec) from
a pointerDown route sets scratch before the dispatcher's threshold-
gated drag pipeline runs, unblocking useSelectTool's pre-drag
classifier in Task 4.

Phase 4.5 Task 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Thread raw `event` through `ActionFn` and `BeginSpec` continuations

**Files:**

- Modify: `src/tools/routing/result.ts`
- Modify: `src/tools/routing/types.ts`
- Modify: `src/tools/routing/defineTool.ts`
- Modify: `src/tools/routing/defineTool.test.ts`

Today the dispatcher already passes the raw event to every translator branch (`_e: PointerEvent` is in scope for `onClick`, `onDragStart`, `onDragMove`, `onDragEnd`, `onDown` after Task 2; `e: KeyboardEvent` for `onDown`/`onUp` keyboard; `_e: WheelEvent` for `onWheel`). The translator just doesn't propagate it. This task plumbs it through.

The `event` parameter is **optional** on the user-facing types so existing route tables (which take only `ctx`) continue to type-check. Untyped because the union (`PointerEvent | KeyboardEvent | WheelEvent`) varies by channel; consumers cast as needed.

- [ ] **Step 1: Update `ActionFn` to accept an optional event**

Edit `src/tools/routing/types.ts`:

```ts
// Change:
export type ActionFn<TScratch> = (ctx: ToolCtx<TScratch>) => Result<TScratch>;

// To:
export type ActionFn<TScratch> = (
  ctx: ToolCtx<TScratch>,
  event?: PointerEvent | KeyboardEvent | WheelEvent,
) => Result<TScratch>;
```

- [ ] **Step 2: Update `BeginSpec` continuations to accept an optional event**

Edit `src/tools/routing/result.ts`:

```ts
// Change:
export interface BeginSpec<TScratch> {
  scratch: TScratch;
  thresholdPx?: number;
  onMove?:    (ctx: ToolCtx<TScratch>) => Result<TScratch>;
  onRelease?: (ctx: ToolCtx<TScratch>) => Result<TScratch>;
  onCancel?:  (ctx: ToolCtx<TScratch>) => void | Result<TScratch>;
}

// To:
export interface BeginSpec<TScratch> {
  scratch: TScratch;
  thresholdPx?: number;
  onMove?:    (ctx: ToolCtx<TScratch>, event?: PointerEvent) => Result<TScratch>;
  onRelease?: (ctx: ToolCtx<TScratch>, event?: PointerEvent) => Result<TScratch>;
  onCancel?:  (ctx: ToolCtx<TScratch>, event?: PointerEvent) => void | Result<TScratch>;
}
```

Continuations only fire on pointer events (pointermove / pointerup / pointercancel), so the type is narrowed to `PointerEvent` — not the broader `ActionFn` union.

- [ ] **Step 3: Thread the event through the translator**

Edit `src/tools/routing/defineTool.ts`. Every translator branch that calls `action(ctx)` or `activeSpec.onX(ctx)` needs to pass the event as a second argument.

In the `onClick` builder (around line 85):

```ts
// Before:
return applyResult(ctx, action(ctx));

// After:
return applyResult(ctx, action(ctx, _e));
```

Same change in the `onDown` builder added in Task 2 (around the equivalent line):

```ts
return applyResult(ctx, action(ctx, _e));
```

Same change in `onDragStart`:

```ts
return applyResult(ctx, action(ctx, _e));
```

In `onDragMove`:

```ts
// Before:
return applyResult(ctx, activeSpec.onMove(ctx));

// After:
return applyResult(ctx, activeSpec.onMove(ctx, _e));
```

In `onDragEnd`:

```ts
return applyResult(ctx, activeSpec.onRelease(ctx, _e));
```

In `onDragCancel` — note this branch receives only ctx today (no event from the dispatcher's onCancel hook). Leave it as `activeSpec.onCancel(ctx)`; the dispatcher doesn't pass a pointer event into cancel paths (pointercancel is dispatched via the same `onCancel(ctx)` signature). The `event` parameter on the user-facing `onCancel` type is optional so this stays valid:

```ts
const r = activeSpec.onCancel(ctx);  // unchanged
```

In the keyboard builder (around line 135):

```ts
// Before:
return applyResult(ctx, action(ctx));

// After:
return applyResult(ctx, action(ctx, e));
```

In the wheel handler (around line 195):

```ts
// Before:
return applyResult(ctx, action(ctx));

// After:
return applyResult(ctx, action(ctx, _e));
```

In the `dblTap.onTap` handler (around line 180):

```ts
// Before:
return applyResult(ctx, action(ctx));

// After:
return applyResult(ctx, action(ctx, _e));
```

- [ ] **Step 4: Add a test that the event reaches an ActionFn**

Append to `src/tools/routing/defineTool.test.ts`:

```ts
describe('defineTool — raw event in ActionFn', () => {
  it('passes the raw PointerEvent to a click ActionFn', () => {
    const seen: Array<PointerEvent | KeyboardEvent | WheelEvent | undefined> = [];
    const tool = defineTool({
      id: 'test',
      initial: {
        click: {
          'rect': (_ctx, e) => {
            seen.push(e);
            return claim();
          },
        },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    const evt = new MouseEvent('click') as unknown as PointerEvent;
    tool.pointer?.onClick?.(evt, ctx as never);
    expect(seen[0]).toBe(evt);
  });

  it('passes the raw PointerEvent to a dblTap ActionFn', () => {
    const seen: Array<PointerEvent | KeyboardEvent | WheelEvent | undefined> = [];
    const tool = defineTool({
      id: 'test',
      initial: {
        dblTap: {
          'rect': (_ctx, e) => {
            seen.push(e);
            return claim();
          },
        },
      },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    const evt = new MouseEvent('click') as unknown as PointerEvent;
    tool.dblTap?.onTap?.(evt, ctx as never);
    expect(seen[0]).toBe(evt);
  });

  it('passes the raw PointerEvent to BeginSpec.onMove and onRelease', () => {
    const moveEvents: Array<PointerEvent | undefined> = [];
    const releaseEvents: Array<PointerEvent | undefined> = [];
    const tool = defineTool<{ x: number }>({
      id: 'test',
      initial: {
        drag: () => begin({
          scratch: { x: 0 },
          onMove: (_ctx, e) => {
            moveEvents.push(e);
            return hold({ x: 1 });
          },
          onRelease: (_ctx, e) => {
            releaseEvents.push(e);
            return commit([stubOp]);
          },
        }),
      },
    });
    const ctx = buildCtx();
    tool.drag?.onStart?.(new MouseEvent('mousedown') as unknown as PointerEvent, ctx as never);
    const moveEvt = new MouseEvent('mousemove') as unknown as PointerEvent;
    tool.drag?.onMove?.(moveEvt, ctx as never);
    expect(moveEvents[0]).toBe(moveEvt);
    const upEvt = new MouseEvent('mouseup') as unknown as PointerEvent;
    tool.drag?.onEnd?.(upEvt, ctx as never);
    expect(releaseEvents[0]).toBe(upEvt);
  });

  it('existing ActionFns that ignore the event parameter still work', () => {
    // The whole point of making `event` optional: ActionFns written
    // before Phase 4.5 (taking only `ctx`) must continue to compile and
    // behave identically.
    const tool = defineTool({
      id: 'test',
      initial: { click: { '*': (ctx) => apply([stubOp]) } },
    });
    const ctx = buildCtx({ target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} } });
    tool.pointer?.onClick?.(new MouseEvent('click') as unknown as PointerEvent, ctx as never);
    expect(ctx.applyOps).toHaveBeenCalledWith([stubOp]);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/tools/routing/
```

Expected: all routing tests pass, including the 4 new ones.

- [ ] **Step 6: Full typecheck — make sure no existing tool breaks**

```bash
npx tsc --noEmit
```

Expected: clean. Existing tools' `ActionFn`s take only `ctx` — TypeScript permits the call site to pass a second arg the function ignores, so type-check stays green.

- [ ] **Step 7: Full test suite as a regression gate**

```bash
npx vitest run
```

Expected: all ~2475 tests pass (or whatever the current baseline is) — the change is additive on the ActionFn signature.

- [ ] **Step 8: Commit**

```bash
git add src/tools/routing/result.ts src/tools/routing/types.ts src/tools/routing/defineTool.ts src/tools/routing/defineTool.test.ts
git commit -m "$(cat <<'EOF'
feat(routing): optional raw event parameter on ActionFn and continuations

ActionFn<TScratch> now accepts an optional second parameter — the raw
PointerEvent / KeyboardEvent / WheelEvent the dispatcher already had in
scope. BeginSpec.onMove / onRelease / onCancel similarly accept an
optional PointerEvent.

The parameter is optional so existing route tables that take only ctx
compile unchanged. Unblocks Phase 4.5 Task 4: useSelectTool's
dblTap.onTap shim (which forwards the raw event to onDoubleTap) and
move-gesture begin (which reads clientX/clientY off the event)
become real declarative routes.

Phase 4.5 Task 3 — closes gap #2 from Phase 3 Task 3's migration
report.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Replace useSelectTool's imperative shims with declarative routes

**Files:**

- Modify: `src/tools/builtin/useSelectTool.ts`
- Modify: `src/tools/builtin/useSelectTool.test.tsx`

Three imperative shims survived Phase 3 because of the gaps now closed: `legacyOnDown`, `pointer.onClick` collapse-handler, and `dblTap.onTap`. Each becomes a declarative route. The Phase 3 drag shim around `useMove`/`useResize`/`useRotate` (lines ~938-1002) stays as-is — Phase 5 Task 1 will revisit it via the `beginAt` adapter pattern from Phase 3's deferred work.

This task does NOT touch `previewPose` / `previewBounds` / `previewIds` / `overlay` / `initScratch` — those are not part of `ToolDef` and continue to live on the returned `Tool` via the spread-patch idiom.

- [ ] **Step 1: Add a `pointerDown` route table to the `defineTool` call**

In `useSelectTool.ts`, locate the `defineTool<SelectScratch>({...})` call (around line 879). Replace the `initial: {}` line with the route tables that subsume `legacyOnDown`'s body-hit / empty branches.

The trick: `legacyOnDown` needs `options.pickBest` / `pickEveryFn` / `adapter` / `options.bringToFrontOnSelect` in closure scope, all of which are available where `defineTool` is called inside `useMemo`. Define route handlers as arrow functions inside the same `useMemo` body.

Concretely, replace `initial: {},` with:

```ts
initial: {
  // pointerDown: body-hit classifier. Decides whether the upcoming
  // gesture will move the existing selection (hit is part of it) or
  // a freshly-clicked id, and primes scratch so the imperative drag
  // shim below knows which case to handle. Mirrors legacyOnDown's
  // pre-routing body-hit / empty branches exactly.
  pointerDown: {
    '*': (ctx) => {
      const sel = ctx.selection.current;
      const top = options.pickBest
        ? options.pickBest(ctx.worldX, ctx.worldY, ctx.modifiers.alt, sel)
        : (() => {
            const ids = pickEveryFn(ctx.worldX, ctx.worldY);
            if (ids.length === 0) return null;
            return pickTopMostHit(ids, adapter) ?? ids[0];
          })();
      if (top !== null) {
        const preClick = sel;
        const hitAlreadySelected = preClick.includes(top as NodeId);
        const isExtend = ctx.modifiers.shift || ctx.modifiers.meta;
        const deferClick = hitAlreadySelected && preClick.length > 1 && !isExtend;
        if (!deferClick) ctx.selection.applyClick(top as NodeId, ctx.modifiers);
        if ((options.bringToFrontOnSelect ?? true) && !isExtend) {
          const reorderable = adapter as unknown as {
            getChildren?: (parentId: string | null) => string[];
            setChildOrder?: (parentId: string | null, ids: string[]) => void;
          };
          if (reorderable.getChildren && reorderable.setChildOrder) {
            dispatchApplyBatch(adapter, [createReorderOp({ ids: [top], direction: 'front' })], 'Bring to front');
          }
        }
        const moveIds: string[] = hitAlreadySelected && preClick.length > 0 ? [...preClick] : [top];
        return begin({
          scratch: { kind: 'move' as const, ids: moveIds, deferredClickId: deferClick ? top : null },
        });
      }
      // Empty: defer clear to onClick.
      return begin({ scratch: { kind: 'area' as const } });
    },
    'empty': (ctx) => {
      // Explicit empty key in case '*' wouldn't fire on EmptyHit — the
      // routing lookup treats 'empty' specially (no '*' fall-through),
      // so we duplicate the empty-branch here.
      return begin({ scratch: { kind: 'area' as const } });
    },
  },

  // click: deferred-clear / deferred-collapse. Runs only on sub-
  // threshold release (the dispatcher's click classification). Reads
  // scratch primed by pointerDown above. Returns claim() so the
  // ambient slot doesn't double-handle.
  click: {
    '*': (ctx) => {
      if (ctx.scratch.kind === 'area' && !ctx.modifiers.shift && !ctx.modifiers.meta) {
        ctx.selection.clear();
      } else if (ctx.scratch.kind === 'move' && ctx.scratch.deferredClickId) {
        ctx.selection.applyClick(ctx.scratch.deferredClickId as NodeId, ctx.modifiers);
      }
      return claim();
    },
    'empty': (ctx) => {
      if (!ctx.modifiers.shift && !ctx.modifiers.meta) {
        ctx.selection.clear();
      }
      return claim();
    },
  },

  // dblTap: forward to the consumer's onDoubleTap callback. The raw
  // event is now available as the second ActionFn parameter (Phase 4.5
  // Task 3), so this route no longer needs an imperative shim.
  dblTap: {
    '*': (ctx, e) => {
      const cb = onDoubleTapRef.current;
      if (!cb) return none();
      const evt = e as PointerEvent;
      const ids = pickEveryRef.current(ctx.worldX, ctx.worldY);
      cb({ worldX: ctx.worldX, worldY: ctx.worldY, ids, event: evt });
      return claim();
    },
  },
},
```

You'll need to add `begin`, `claim`, `none` to the imports at the top of the file alongside `defineTool` and `ActionFn`:

```ts
import { defineTool, begin, claim, none } from '../routing';
```

- [ ] **Step 2: Delete the imperative shims that the route tables replaced**

Remove:

1. The `legacyOnDown` constant declaration (currently around lines 795-869).
2. The `pointer: { onDown: legacyOnDown, onClick: ... }` block in the returned Tool spread (currently around lines 910-923).
3. The `dblTap: { onTap: ... }` block in the returned Tool spread (currently around lines 925-936).

The returned Tool spread keeps everything else (the imperative `drag` block, `overlay`, `previewPose`, `previewBounds`, `previewIds`, `initScratch`, `cursor: 'default'`).

After the deletions, the `defineTool` call's output already carries `pointer.onDown` / `pointer.onClick` / `dblTap.onTap` from the route tables in Step 1, so they don't need to be patched back in.

- [ ] **Step 3: Verify the comment block at line ~775-794 is now stale**

The current comment block ("Imperative shims — partial pre-routing carry-over...") describes shims that no longer exist for pointer/dblTap. Replace it with:

```ts
// Imperative drag shim — Phase 3 Task 4 left this in place to keep
// useMove/useResize/useRotate behavior unchanged. Phase 5 Task 1
// migrates it to declarative routes via the beginAt adapter pattern
// (each gesture primitive grows a thin wrapper that returns a
// begin(spec) Result wrapping its internal state machine). The other
// shims (pointer.onDown, pointer.onClick, dblTap.onTap) were closed in
// Phase 4.5 — see the route tables in the defineTool call below.
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Run useSelectTool tests**

```bash
npx vitest run src/tools/builtin/useSelectTool
```

Expected: all existing tests pass. Behavior was preserved; the imperative shims were 1:1 ports.

- [ ] **Step 6: Add a targeted test that onDoubleTap still receives the raw event**

The dblTap shim used to forward `e: PointerEvent` directly; the new declarative route receives it through the optional `event` parameter. Pin that contract:

Append to `src/tools/builtin/useSelectTool.test.tsx`:

```tsx
describe('useSelectTool — declarative dblTap forwards raw event', () => {
  it('passes the raw PointerEvent to onDoubleTap', () => {
    const onDoubleTap = vi.fn();
    // ... render the hook with onDoubleTap, dispatch a dblTap on a body
    //     point, assert onDoubleTap.mock.calls[0][0].event is the
    //     PointerEvent instance from the dispatcher. Match the test
    //     style of the existing dblTap test (which currently asserts
    //     event presence through the imperative shim).
    // ... See sibling tests for the renderHook + adapter scaffolding pattern.
    expect(onDoubleTap).toHaveBeenCalled();
    const call = onDoubleTap.mock.calls[0]?.[0] as { event: PointerEvent } | undefined;
    expect(call?.event).toBeInstanceOf(Event);
  });
});
```

(The skeleton above leaves the dispatch-scaffolding cells empty because the existing test file already establishes the pattern; the implementer fills in the dispatch helper call to match. If the existing tests assert this exact behavior through the imperative shim, this step becomes "verify the existing test still passes" and the new test is unnecessary.)

- [ ] **Step 7: Run the test you just added**

```bash
npx vitest run src/tools/builtin/useSelectTool
```

Expected: pass.

- [ ] **Step 8: Smoke test in the demo**

```bash
npm run dev
```

Open the kit demo. Switch to Select tool. Manually verify:

- Click a rect → selects it.
- Click empty → clears the selection.
- Shift-click another rect → adds to selection.
- Double-click a text node → consumer's `onDoubleTap` fires (e.g. enters text edit in the Swillustrator demo).
- Drag a rect → moves it.
- Drag a rect that's part of a multi-selection → moves the whole set.
- Drag empty → marquee.

If any regression: the route handlers' control flow probably diverged from `legacyOnDown`. Diff the two carefully — same `pickBest` vs `pickEveryFn` ordering, same `hitAlreadySelected` predicate, same `deferClick` predicate.

- [ ] **Step 9: Commit**

```bash
git add src/tools/builtin/useSelectTool.ts src/tools/builtin/useSelectTool.test.tsx
git commit -m "$(cat <<'EOF'
feat(select): replace pointer/dblTap imperative shims with declarative routes

Phase 4.5 closed the two factory gaps that forced useSelectTool to
patch imperative handlers back onto the routing-factory Tool. Now:

- pointer.onDown comes from a pointerDown route table on initial. The
  body-hit classifier (hitAlreadySelected, deferClick, bring-to-front,
  pickBest fallthrough) lives in a single route handler that returns
  begin(spec) with the classified scratch. Behavior identical to
  legacyOnDown.
- pointer.onClick comes from a click route table that reads the scratch
  primed by pointerDown and applies the deferred-clear / deferred-
  collapse rules.
- dblTap.onTap comes from a dblTap route table that uses the new raw-
  event parameter on ActionFn to forward the PointerEvent to the
  consumer's onDoubleTap callback.

The imperative `drag` block (useMove/useResize/useRotate switch) is
unchanged — Phase 5 Task 1 migrates it via the beginAt adapter pattern.

Phase 4.5 Task 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Document Phase 4.5 surface in the design spec

**Files:**

- Modify: `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`

The spec's `PhaseDef` block (around line 128) and `ActionFn` type (line 153) currently describe the pre-Phase-4.5 shape. Add a follow-up section that records what changed without rewriting the original blocks (the original is a design artifact; the follow-up is the as-shipped delta).

- [ ] **Step 1: Append a Phase 4.5 follow-up section**

At the end of the spec, after the existing `## Acceptance` section, insert:

```markdown
## Phase 4.5 follow-up: factory completeness (shipped 2026-05-12)

Phase 3 Task 3's migration report surfaced two structural gaps in the
factory surface. Phase 4.5 closed both before the Phase 5 tool
migrations started.

### `PhaseDef.pointerDown`

`PhaseDef` now has a `pointerDown?: RouteTable<TScratch>` field
alongside `click` / `dblTap` / `drag`:

```ts
interface PhaseDef<TScratch> {
  click?:        RouteTable<TScratch>;
  dblTap?:       RouteTable<TScratch>;
  drag?:         RouteTable<TScratch> | ActionFn<TScratch>;
  pointerDown?:  RouteTable<TScratch>;   // NEW in 4.5
  // ...
}
```

Semantics: a `pointerDown` route runs synchronously on pointerdown,
before the dispatcher's threshold-gated click vs. drag classification.
Returning `begin(spec)` primes scratch for subsequent handlers in the
same gesture (the typical use). Returning `apply` / `commit` finishes
the gesture immediately (rare). Returning `none()` (or omitting the
route) passes through to the threshold-gated pipeline.

Used by `useSelectTool` to classify the body-hit gesture: "this rect
belongs to the existing selection so the drag will move the whole
set" vs. "this rect is a fresh hit so the drag will move just this
one." Replaces the imperative `legacyOnDown` shim.

`ViewportPhaseDef` intentionally does NOT include `pointerDown` — the
`Pick` derivation in `types.ts` lists only `wheel | keyDown | keyUp |
cursor | overlay | claimsAll`. Viewport tools have no body-hit
classifier need.

### Raw event parameter on `ActionFn` and continuations

`ActionFn<TScratch>` now accepts an optional second parameter — the
raw DOM event that triggered the route. Same for `BeginSpec`'s
`onMove` / `onRelease` / `onCancel`:

```ts
type ActionFn<TScratch> = (
  ctx: ToolCtx<TScratch>,
  event?: PointerEvent | KeyboardEvent | WheelEvent,
) => Result<TScratch>;

interface BeginSpec<TScratch> {
  scratch: TScratch;
  thresholdPx?: number;
  onMove?:    (ctx: ToolCtx<TScratch>, event?: PointerEvent) => Result<TScratch>;
  onRelease?: (ctx: ToolCtx<TScratch>, event?: PointerEvent) => Result<TScratch>;
  onCancel?:  (ctx: ToolCtx<TScratch>, event?: PointerEvent) => void | Result<TScratch>;
}
```

The parameter is optional so existing route tables that take only
`ctx` continue to compile and behave identically. Authors opt in by
adding the second parameter when they need the raw event — typically
to forward to a consumer callback (e.g. `useSelectTool.onDoubleTap`'s
contract includes the `PointerEvent` for downstream coordinate work)
or to read `clientX`/`clientY` directly when `ctx.point` (world coords)
isn't the right space.

Continuation parameters narrow the type to `PointerEvent` — `onMove` /
`onRelease` / `onCancel` only ever fire on pointer events.

### Out of scope for Phase 4.5

- The legacy `drag` shim in `useSelectTool` around
  `useMove`/`useResize`/`useRotate` — Phase 5 Task 1 migrates it via
  the `beginAt` adapter pattern.
- Phase 3b resize/rotate affordance integration through the factory —
  unchanged from the original Phase 3 scope.
```

- [ ] **Step 2: Verify the spec still renders cleanly**

```bash
# Sanity check the file isn't malformed by previewing the new section's
# headings and structure.
grep -n "^##" /Users/mike/src/weasel/docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md | tail -10
```

Expected: the new section heading `## Phase 4.5 follow-up: factory completeness (shipped 2026-05-12)` is present and at the end.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md
git commit -m "$(cat <<'EOF'
docs(routing): record Phase 4.5 factory-completeness surface in spec

Documents the two additions to the routing factory:
- PhaseDef.pointerDown route table for pre-threshold classifiers.
- Optional raw event parameter on ActionFn and BeginSpec
  continuations.

Both addressed gaps from Phase 3 Task 3's migration report. Spec now
reflects the as-shipped surface, leaving the original design blocks
intact as design history.

Phase 4.5 Task 5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4.5 done-criteria

- [ ] `PhaseDef.pointerDown` exists in `types.ts` and is wired through `defineTool` (Tasks 1, 2).
- [ ] `ActionFn` and `BeginSpec` continuations carry an optional event parameter (Task 3).
- [ ] `useSelectTool` has zero imperative pointer / dblTap shims; the only remaining imperative block is the `drag` shim deferred to Phase 5 Task 1 (Task 4).
- [ ] Spec records the new surface (Task 5).
- [ ] `npx tsc --noEmit && npx vitest run` clean.
- [ ] Manual smoke pass in the kit demo: click, shift-click, alt-click, double-click, drag rect, drag empty all behave identically to pre-4.5 useSelectTool.

## Self-review notes (for the implementer)

- **`event` parameter is intentionally a union, not generic.** Making `ActionFn` generic over event type (`ActionFn<TScratch, TEvent>`) would force every route table to commit to a single event type at the table level, which doesn't match the call sites — click/down/dblTap fire `PointerEvent`, key fires `KeyboardEvent`, wheel fires `WheelEvent`. The union lets a single `ActionFn` type cover all channels; consumers narrow with a single cast at the use site.
- **`onCancel` does NOT receive the event.** Cancel can originate from pointercancel (has a PointerEvent), window blur (no event), or programmatic cancel (no event). Keeping the cancel signature event-free avoids forcing callers to handle the undefined case in normal pointercancel flow. The optional `event?: PointerEvent` parameter on the user-facing type is forward-compatible — a future task can plumb the event through pointercancel-originated cancels without a breaking change.
- **`pointerDown` returning `begin(spec)` with no continuations is the typical case.** The classifier just primes scratch; the subsequent click vs. drag pipeline reads it. Don't be tempted to "complete the gesture" inside the pointerDown route — that defeats the threshold gate.
- **The Task 4 `pointerDown.'*'` route covers EmptyHit explicitly.** The routing lookup's `'*'` does NOT match empty hits by design (see `lookup.ts:27-28` and the `defineTool` `onClick` empty fallback). The Task 4 route table includes both `'*'` and `'empty'` keys, matching how `defineTool.ts:80-83` falls back for clicks.
- **Don't touch `defineViewportTool`.** The `Pick` over `PhaseDef` intentionally omits `pointerDown`; viewport tools have no body-hit classifier need. If a viewport tool needs a pointerdown hook, that's a separate design question.
- **The dblTap test in Task 4 Step 6 is partly aspirational** — the file's existing dispatch helpers may or may not already cover dblTap. If the existing useSelectTool test file doesn't have a dblTap fixture, replicate the click-fixture pattern with `tool.dblTap?.onTap?.(...)` direct invocation, the same way the routing factory's own tests do.
