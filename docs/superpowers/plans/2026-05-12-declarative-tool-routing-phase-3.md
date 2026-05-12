# Declarative tool routing — Phase 3 (useSelectTool migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `useSelectTool` from its imperative `defineTool` block to the declarative `defineTool` factory shipped in Phase 1. The largest exercise of the new schema — validates target-keyed routing (rect/text/path/empty), drag-route discrimination (rect→move vs. empty→marquee), modifier sub-tables (shift-extend, alt-clone), multi-shape engaged phase (move vs. marquee), dblTap routing (enterTextEdit/enterAnchorEdit), and cursor phase override.

**Scope decision:** This plan migrates click + dblTap + drag-move + drag-marquee + modifier sub-tables. **Resize and rotate affordance integration is deferred to Phase 3b** — those exercise the affordance-hit path through the factory, which is a separate concern best handled after the rest of the select-tool migration validates the basics. Splitting reduces this plan from ~12 tasks to ~7 and keeps each one bite-sized.

**Architecture:** `useSelectTool` composes multiple gesture primitives (`useMove`, `useAreaSelect`). The migration introduces **beginAt adapter methods** on each primitive — small wrappers that take a `ToolCtx` and return a `begin(spec)` Result with the primitive's onStart/onMove/onEnd wired into the spec's continuation closures. The migrated `useSelectTool` calls the appropriate `beginAt` from its drag-route table based on target kind. The primitives themselves keep their existing internal state machines; the adapters are thin wrappers.

**Tech Stack:** TypeScript, React 18+, Vitest. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`.
**Predecessors:**
- Phase 1 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-1.md`
- Phase 2 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-2.md`

---

### File map

**Modified:**

- `src/interactions/gestures/move/move.ts` — add `beginAt(ctx, ids)` method to the `useMove` return value.
- `src/interactions/gestures/area-select/areaSelect.ts` — add `beginAt(ctx)` method to the `useAreaSelect` return value.
- `src/tools/builtin/useSelectTool.ts` — replace the imperative `defineTool` block with `defineTool` from `/routing` + route tables + `beginAt` calls.
- `src/tools/builtin/useSelectTool.test.tsx` — existing tests pass against the migrated tool; add tests for modifier-sub-table behaviors and cursor states.

**Out of scope for Phase 3 (defer to Phase 3b):**

- Resize affordance integration via `useResize`
- Rotate affordance integration via `useRotate`
- Multi-resize union behavior

---

## Task 1: Add `beginAt` adapter to `useMove`

**Files:**

- Modify: `src/interactions/gestures/move/move.ts`
- Modify (test): `src/interactions/gestures/move/move.test.ts`

The `useMove` hook today exposes `start`/`move`/`end`/`cancel` methods. Add a `beginAt(ctx, ids)` method that returns a `begin(spec)` Result wrapping those methods as continuation closures.

- [ ] **Step 1: Inspect the current `useMove` return shape**

```bash
cd /Users/mike/src/weasel
grep -n "export function useMove\|return {" src/interactions/gestures/move/move.ts | head -10
```

Confirm the return is an object with `start`/`move`/`end`/`cancel` methods (and possibly an `overlay` RenderLayer).

- [ ] **Step 2: Write the failing test**

```ts
// Append to src/interactions/gestures/move/move.test.ts:
import { begin } from '../../../tools/routing';
import type { Result } from '../../../tools/routing';

describe('useMove.beginAt', () => {
  it('returns a begin Result with continuation closures', () => {
    // ... build adapter + render hook ...
    const move = result.current;
    const ctx = buildToolCtx({ point: { x: 10, y: 20 }, modifiers: noMods });
    const r: Result<{ kind: 'move'; ids: string[] }> = move.beginAt(ctx, ['a', 'b']);
    expect(r.kind).toBe('begin');
    if (r.kind === 'begin') {
      expect(r.spec.scratch).toEqual({ kind: 'move', ids: ['a', 'b'] });
      expect(r.spec.onMove).toBeDefined();
      expect(r.spec.onRelease).toBeDefined();
      expect(r.spec.onCancel).toBeDefined();
    }
  });

  it('calling onMove from the spec forwards to move.move()', () => {
    // ... verify the wrapper calls the primitive's move method ...
  });

  it('calling onRelease from the spec ends the move and returns cancel()', () => {
    // ... verify ...
  });
});
```

- [ ] **Step 3: Run to verify fail**

```bash
npm test -- src/interactions/gestures/move/move.test
```

Expected: new tests fail (beginAt undefined).

- [ ] **Step 4: Implement `beginAt`**

In `move.ts`, add to the return object:

```ts
import { begin, hold, cancel as cancelAction, type Result } from '../../../tools/routing';
import type { ToolCtx } from '../../../tools/types';

// ... inside useMove, in the return statement:

const beginAt = (ctx: ToolCtx, ids: readonly string[]): Result<{ kind: 'move'; ids: readonly string[] }> => {
  // Start the internal move state machine.
  start({
    ids,
    worldX: ctx.point.x,
    worldY: ctx.point.y,
    clientX: ctx.screenPoint?.x ?? 0,
    clientY: ctx.screenPoint?.y ?? 0,
  });
  return begin({
    scratch: { kind: 'move' as const, ids },
    onMove: (ctx) => {
      move({
        worldX: ctx.point.x,
        worldY: ctx.point.y,
        clientX: ctx.screenPoint?.x ?? 0,
        clientY: ctx.screenPoint?.y ?? 0,
        modifiers: ctx.modifiers,
      });
      return hold(ctx.scratch);
    },
    onRelease: () => {
      end();
      // useMove emits its own applyOps internally on end — the tool's
      // onRelease just exits the engaged phase.
      return cancelAction();
    },
    onCancel: () => {
      cancel();
    },
  });
};

return { start, move, end, cancel, overlay, beginAt };
```

(Adapt the parameter names — the actual `start`/`move`/`end` may differ slightly; preserve the existing internal API.)

- [ ] **Step 5: Verify tests pass**

```bash
npm test -- src/interactions/gestures/move/move.test
```

All pass.

- [ ] **Step 6: Commit**

```bash
git add src/interactions/gestures/move/move.ts src/interactions/gestures/move/move.test.ts
git commit -m "feat(move): beginAt adapter for declarative tool routing

Returns a begin(spec) Result wrapping useMove's internal start/move/
end/cancel as continuation closures. Lets useSelectTool's route table
call move.beginAt(ctx, ids) directly from its drag handler instead of
imperative dispatch. No behavioral change; useMove's internal state
machine is unchanged."
```

---

## Task 2: Add `beginAt` adapter to `useAreaSelect`

**Files:**

- Modify: `src/interactions/gestures/area-select/areaSelect.ts`
- Modify (test): existing area-select test file.

Same pattern as Task 1 but for marquee area-select.

- [ ] **Step 1: Inspect the current shape**

```bash
grep -n "export function useAreaSelect\|return {" /Users/mike/src/weasel/src/interactions/gestures/area-select/areaSelect.ts | head -5
```

- [ ] **Step 2: Write the failing test**

```ts
describe('useAreaSelect.beginAt', () => {
  it('returns a begin Result with continuation closures', () => {
    // ... ctx with point + modifiers ...
    const r = areaSelect.beginAt(ctx);
    expect(r.kind).toBe('begin');
  });

  it('forwards onMove to areaSelect.move()', () => { ... });
  it('onRelease ends the area-select and returns cancel()', () => { ... });
});
```

- [ ] **Step 3: Implement**

```ts
const beginAt = (ctx: ToolCtx): Result<{ kind: 'area' }> => {
  start(ctx.point.x, ctx.point.y, ctx.modifiers);
  return begin({
    scratch: { kind: 'area' as const },
    onMove: (ctx) => {
      move(ctx.point.x, ctx.point.y, ctx.modifiers);
      return hold(ctx.scratch);
    },
    onRelease: () => {
      end();
      return cancelAction();
    },
    onCancel: () => cancel(),
  });
};

return { start, move, end, cancel, overlay, beginAt };
```

- [ ] **Step 4: Verify pass + commit**

```bash
npm test -- src/interactions/gestures/area-select
git add src/interactions/gestures/area-select/
git commit -m "feat(area-select): beginAt adapter for declarative tool routing

Same shape as Task 1's useMove.beginAt — returns a begin(spec) Result
wrapping the internal area-select state machine as continuation
closures."
```

---

## Task 3: Migrate `useSelectTool`'s click + dblTap routing

**Files:**

- Modify: `src/tools/builtin/useSelectTool.ts`

Replace the click + dblTap blocks (today inside the imperative `defineTool({ pointer, dblTap, drag, ... })` call) with route tables under `defineTool({ initial: { click, dblTap, drag, ... } })`. **Drag wiring lands in Task 4** — Task 3 just gets the phase-free routes working first.

This task expects the imperative useSelectTool's drag block to remain temporarily during the migration. We'll wire drag to the new shape in Task 4. To keep typecheck clean, ship the new factory call with drag delegating to the old imperative handlers via a temporary shim.

- [ ] **Step 1: Inspect the current `defineTool` call**

```bash
cd /Users/mike/src/weasel
sed -n '850,900p' src/tools/builtin/useSelectTool.ts
```

Identify the click (pointer.onDown / onClick) handler and the dblTap handler. Note what state they read/mutate.

- [ ] **Step 2: Switch the factory call to the routing variant**

At the top of `useSelectTool.ts`, change:

```ts
import { defineTool } from '../defineTool';
```

to:

```ts
import { defineTool, apply } from '../routing';
```

(The new defineTool lives at `@orochi235/weasel/routing` per Phase 1, but internal imports use the relative path.)

- [ ] **Step 3: Add click and dblTap routes**

Inside the `defineTool` call, replace the pointer block (which today reads hit-test results and decides what to do) with:

```ts
initial: {
  click: {
    'rect': (ctx) => apply([setSelectionOp([ctx.target.id])], 'Select'),
    'text': (ctx) => apply([setSelectionOp([ctx.target.id])], 'Select'),
    'path': (ctx) => apply([setSelectionOp([ctx.target.id])], 'Select'),
    'empty': () => apply([setSelectionOp([])], 'Deselect'),
  },
  dblTap: {
    'text': enterTextEdit,
    'path': enterAnchorEdit,
    'rect': enterRectEdit,    // delegates to onDoubleTap callback for back-compat
  },
  // drag stays imperative-style for now; wired declaratively in Task 4.
  drag: legacyDragHandlers,
},
```

`setSelectionOp` is `createSetSelectionOp` from `core/ops/select`. The `enterTextEdit` / `enterAnchorEdit` / `enterRectEdit` actions are shared functions defined elsewhere in the file (or inlined here). They invoke the consumer's `onDoubleTap` callback for back-compat.

The temporary `legacyDragHandlers` shim adapts the existing drag block to the new factory's drag-as-route-table-or-function shape. Concrete:

```ts
const legacyDragHandlers: ActionFn = (ctx) => {
  // ... invoke the existing imperative drag.onStart logic, returning
  //     a begin Result with continuation closures that call the existing
  //     drag.onMove / drag.onEnd / drag.onCancel.
};
```

This is intentionally awkward — Task 4 replaces it with real declarative routing.

- [ ] **Step 4: Typecheck + run useSelectTool tests**

```bash
npm run typecheck
npm test -- src/tools/builtin/useSelectTool
```

Both pass. Existing tests cover click + dblTap + drag behaviors; the migration is supposed to preserve them.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useSelectTool.ts
git commit -m "feat(select): migrate click + dblTap to declarative routing

Replaces the imperative pointer + dblTap blocks with route tables.
Click on rect/text/path → select that id; empty → deselect. dblTap
on text/path/rect → invoke the consumer's onDoubleTap callback for
back-compat (existing dblTap behavior preserved). Drag stays
imperative via a temporary shim; Task 4 wires it declaratively."
```

---

## Task 4: Migrate `useSelectTool`'s drag routing

**Files:**

- Modify: `src/tools/builtin/useSelectTool.ts`

Replace the temporary `legacyDragHandlers` shim from Task 3 with a real route table that dispatches to `move.beginAt(...)` or `areaSelect.beginAt(...)` based on target kind.

- [ ] **Step 1: Replace the drag block with a routing table**

```ts
initial: {
  // click + dblTap from Task 3 unchanged
  drag: {
    'rect': (ctx) => {
      // Determine which ids to move. If the hit id is already selected,
      // move the whole selection; otherwise click-then-drag (deferred
      // click semantics — apply the click on release).
      const ids = computeMoveIds(ctx);
      return move.beginAt(ctx, ids);
    },
    'text': (ctx) => move.beginAt(ctx, computeMoveIds(ctx)),
    'path': (ctx) => move.beginAt(ctx, computeMoveIds(ctx)),
    'empty': (ctx) => areaSelect.beginAt(ctx),
  },
},
```

`computeMoveIds(ctx)` mirrors the existing select-tool's "deferred click vs. multi-move" logic:

```ts
const computeMoveIds = (ctx: ToolCtx): string[] => {
  const hitId = ctx.target.category === 'node' ? ctx.target.id : null;
  if (!hitId) return [];
  const selected = ctx.selection.current.map(String);
  // If the hit is already selected, move the entire selection.
  if (selected.includes(hitId)) return selected;
  // Otherwise move just the hit id; defer the click-to-select to release.
  return [hitId];
};
```

- [ ] **Step 2: Drop the temporary `legacyDragHandlers` shim**

Remove the imperative drag block left in place from Task 3.

- [ ] **Step 3: Typecheck + tests**

```bash
npm run typecheck
npm test -- src/tools/builtin/useSelectTool
```

Pass.

- [ ] **Step 4: Smoke test in the demo**

```bash
npm run dev
```

Open the kit demo. Switch to Select tool. Verify:
- Click a rect → selects.
- Click empty → deselects.
- Drag a rect → moves it.
- Drag empty → marquee select.
- Drag a rect that's already part of a multi-selection → moves the whole selection.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useSelectTool.ts
git commit -m "feat(select): migrate drag to declarative routing via beginAt adapters

Drag routes by target kind: rect/text/path → move.beginAt(ids); empty
→ areaSelect.beginAt. Each gesture primitive's continuation closures
attach at begin time, so the engaged-phase route tables don't need a
scratch.kind switch. Behavior preserved (multi-select-aware move,
deferred click semantics)."
```

---

## Task 5: Add modifier sub-tables (shift-extend, alt-clone)

**Files:**

- Modify: `src/tools/builtin/useSelectTool.ts`

The select tool today reads `ctx.modifiers` imperatively to determine "shift-click extends selection" vs. "alt-click clones" vs. "plain click sets selection." Migrate to modifier sub-tables in the click routes.

- [ ] **Step 1: Replace click routes with modifier sub-tables**

```ts
import { mods } from '../routing';

// ...

click: {
  'rect': {
    [mods()]:      (ctx) => apply([setSelectionOp([ctx.target.id])], 'Select'),
    [mods('shift')]: (ctx) => apply([toggleSelectionOp(ctx.target.id, ctx.selection.current)], 'Toggle in selection'),
    [mods('alt')]:   (ctx) => apply([cloneNodeOp(ctx.target.id)], 'Clone'),
  },
  'text': {
    [mods()]:      (ctx) => apply([setSelectionOp([ctx.target.id])], 'Select'),
    [mods('shift')]: (ctx) => apply([toggleSelectionOp(ctx.target.id, ctx.selection.current)], 'Toggle in selection'),
  },
  'path': {
    [mods()]:      (ctx) => apply([setSelectionOp([ctx.target.id])], 'Select'),
    [mods('shift')]: (ctx) => apply([toggleSelectionOp(ctx.target.id, ctx.selection.current)], 'Toggle in selection'),
  },
  'empty': {
    [mods()]:        () => apply([setSelectionOp([])], 'Deselect'),
    [mods('shift')]: () => none(),   // shift-click empty doesn't deselect — keeps the prior set
  },
},
```

`toggleSelectionOp` is a new helper — emits a `createSetSelectionOp` with the toggled set. `cloneNodeOp` is an existing op factory.

- [ ] **Step 2: Verify modifier sub-table behavior in tests**

The existing useSelectTool tests probably cover shift-click-extend; verify they still pass. If new behaviors weren't tested, add tests.

- [ ] **Step 3: Smoke test**

Verify in the dev demo:
- Plain click rect → selects only that.
- Shift-click another rect → adds to selection.
- Shift-click an already-selected rect → removes from selection.
- Alt-click a rect → clones it (consumer-defined behavior; verify by stub if no clone tool wired).
- Shift-click empty → doesn't change selection (current behavior).
- Plain click empty → deselects.

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/useSelectTool.ts
git commit -m "feat(select): modifier sub-tables for shift-extend / alt-clone

Click routes now use modifier sub-tables ([mods()] / [mods('shift')]
/ [mods('alt')]) instead of inline ctx.modifiers branching. Existing
behaviors preserved: shift-click toggles in selection, alt-click
clones, plain click sets selection. shift-click on empty no longer
deselects."
```

---

## Task 6: Cursor + tests + smoke

**Files:**

- Modify: `src/tools/builtin/useSelectTool.ts`
- Modify: `src/tools/builtin/useSelectTool.test.tsx`

useSelectTool's cursor today is `'default'` (or omitted). Engaged cursor may differ depending on what's mid-drag — but most consumers leave it as `'default'` throughout. Phase 3 keeps cursor minimal; if a phase override is desired (e.g. `'move'` during a drag), add it now.

- [ ] **Step 1: Add cursor + final tests**

Top-level cursor stays `'default'` (or whatever the current value is). If you want a drag-active cursor:

```ts
cursor: 'default',
engaged: {
  cursor: (ctx) => {
    if (ctx.scratch?.kind === 'move') return 'move';
    if (ctx.scratch?.kind === 'area') return 'crosshair';
    return 'default';
  },
},
```

- [ ] **Step 2: Add tests for the new routing surface**

```tsx
describe('useSelectTool — declarative routing', () => {
  it('shift-click on selected rect removes from selection', () => { ... });
  it('shift-click on empty preserves selection', () => { ... });
  it('alt-click clones the rect', () => { ... });
  it('drag on empty starts marquee', () => { ... });
  it('drag on rect starts move', () => { ... });
});
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Baseline ~2475 passing must hold (plus any new tests added). No regressions in dependent demos.

- [ ] **Step 4: Smoke test all useSelectTool consumers in demos**

`#scene`, `#move`, `#resize`, `#multi-select`, `#actions`, plus Swillustrator. The migration is supposed to be behavior-preserving across all of them.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useSelectTool.ts src/tools/builtin/useSelectTool.test.tsx
git commit -m "feat(select): cursor phase override + test coverage for routing

engaged.cursor switches to 'move' / 'crosshair' based on scratch.kind.
Tests cover the new modifier-sub-table semantics, drag routing by
target kind, and dblTap routing. Existing useSelectTool tests
continue to pass — migration is behavior-preserving."
```

---

## Self-review notes (for the implementer)

- **Resize/rotate affordance integration is Phase 3b.** Don't try to migrate those in Phase 3. The existing imperative paths can stay as a separate `pointer` channel on the Tool that survives alongside the declarative routing — or be temporarily disabled — for the duration of Phase 3.
- **`beginAt` adapter pattern** is the central technical idea. Each gesture primitive grows a thin wrapper that converts its imperative `start/move/end/cancel` into a `begin(spec)` Result. The wrapper does NOT change the primitive's internal state machine.
- **`scratch.kind` discriminator preserved**. The current useSelectTool already uses a `kind: 'move' | 'resize' | 'rotate' | 'area'` discriminator on scratch; the migration keeps that, because each gesture primitive's `beginAt` returns scratch tagged with the kind.
- **Modifier sub-tables** replace inline `ctx.modifiers.shift` branching. The factory's lookup engine handles the rest. If the existing behavior depended on three-or-more modifier combinations not expressible in the 8-key set, drop to function form per-route as the escape hatch.
- **Tests are the safety net.** This is the largest migration so far — every existing useSelectTool test must continue to pass. If a test fails, debug the migration rather than rewrite the test.
- **The `legacyDragHandlers` shim in Task 3** is a deliberate ugly intermediate state. Don't ship code in that state to anyone; Task 4 cleans it up. The shim exists so each task can land independently as a commit.
