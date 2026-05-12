# Tool Primitive Phase 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the kit's built-in **generic** Tool catalogue: `select`, `insert`, and four always-on action tools (`delete`, `nudge`, `undoRedo`, `duplicate`). Each is a hook (`useFooTool(...)`) that wraps the existing same-named gesture/action hook(s) and returns a `Tool` record consumable by `useTools`.

**Architecture:** Each built-in tool lives in `src/tools/builtin/use*Tool.ts` as a React hook. Internally it calls the existing gesture/action hooks (`useMove`, `useResize`, etc.) and synthesizes a `Tool` record whose channel handlers close over the resulting controllers. `useSelectTool` wraps four hooks (move/resize/rotate/areaSelect) and uses `scratch` to remember which sub-gesture was engaged at pointer-down so `drag.*` handlers route to the right controller. Action tools declare `keybinding: 'Backspace'` etc. and run their existing logic in `keyboard.onDown`.

`<Canvas>` gains a "dedupe rule": when `tools` is set, any legacy gesture/action hook whose Tool is registered (by id) is suppressed in the legacy passthrough path. This prevents double-firing during the migration window.

**Tech Stack:** TypeScript, React 19, Vitest, jsdom.

**Reference spec:** `docs/specs/2026-05-03-tool-primitive-design.md` (especially "Built-in tool catalogue" and "Phase 2: built-in tools").

**Reference Phase 1 plan:** `docs/plans/2026-05-03-tool-primitive-phase-1.md` (substrate already merged: `Tool`, `ToolCtx`, `useTools`, `useKeybindings`, dispatcher, Canvas `tools` prop).

**Out of scope (Phase 2b/2c):**
- `hand` tool — depends on viewport spec, deferred to Phase 2b.
- Pen, text, insert-rect cookbook tools — Phase 2c.
- Swillustrator demo — Phase 2c.
- Migrating existing demos off `gestures={...}` / `tool="select"` props — happens in Phase 3.
- Removing `useMove` / `useResize` / etc. from public API — Phase 4.

---

## Architectural decisions (locked before this plan)

These are decided. Don't relitigate them in implementation:

1. **Pattern A: hook-returning-Tool.** Each built-in is a React hook that internally calls the underlying gesture/action hooks and returns a `Tool` record. Userland: `const select = useSelectTool(adapter, opts); useTools({ registry: { select, insert }, alwaysOn: [del, nudge, undoRedo, dupe] })`.

2. **Hit-test helpers come via tool options**, not via ToolCtx or adapter extension. `useSelectTool(adapter, { hitBody, boundsOf, handleHitRadius, ... })` — same prop shape as today's `<Canvas>`.

3. **Selection-on-pointerdown** is preserved as-is for `select` (calls `selection.applyClick` inside `pointer.onDown` for body hits). [See memory: revisiting this is a low-priority follow-up.]

4. **Action tools own their keybindings** via `Tool.keybinding`. The dispatcher fires them on key-down. The Canvas gates off the legacy hook's keybinding wiring when the same id is in `tools.alwaysOn`.

5. **Cursor on `select` is `'default'`**, on `insert` is `'crosshair'` — set via the tool's `cursor` field. No registry-level overrides in this phase.

---

## File Structure

### New files

```
src/tools/builtin/useDeleteTool.ts          # always-on, Backspace/Delete
src/tools/builtin/useDeleteTool.test.ts
src/tools/builtin/useNudgeTool.ts           # always-on, arrow keys
src/tools/builtin/useNudgeTool.test.ts
src/tools/builtin/useUndoRedoTool.ts        # always-on, mod+z / mod+shift+z
src/tools/builtin/useUndoRedoTool.test.ts
src/tools/builtin/useDuplicateTool.ts       # always-on, mod+d
src/tools/builtin/useDuplicateTool.test.ts
src/tools/builtin/useInsertTool.ts          # active-slot, drag-to-insert
src/tools/builtin/useInsertTool.test.ts
src/tools/builtin/useSelectTool.ts          # active-slot, wraps move/resize/rotate/areaSelect
src/tools/builtin/useSelectTool.test.ts
src/tools/builtin/index.ts                  # barrel
```

### Modified files

```
src/tools/index.ts                          # re-export builtin/*
src/canvas/Canvas.tsx                       # legacy-hook dedupe when tools is set
src/canvas/Canvas.test.tsx                  # tests for the dedupe rule
src/index.ts                                # already re-exports tools/* — no change needed
```

### Why this shape

- **`builtin/` subdir** keeps each tool focused (one file per tool). Phase 1's substrate stays at `src/tools/` top-level.
- **One file per tool** — they share no internal state and have different test surfaces. Co-locating wouldn't save anything.
- **Action tools first, then `useInsertTool`, then `useSelectTool`** — order is deliberate. Action tools establish the always-on pattern, `useInsertTool` is the simplest active-slot tool, and `useSelectTool` is the most complex (4 sub-controllers + scratch routing) so it lands last.

---

## Conventions used in tasks

- All commits prefix with `feat(tools):` (or `test(tools):` / `fix(tools):` where appropriate).
- Tests use `pointerEvent`/`keyboardEvent` synthesizers from `src/tools/dispatcher.test.ts` if needed (jsdom workaround).
- Implementation imports types as `import type { Tool, ToolCtx } from '../types'` (note: from `../types`, since these files live in `src/tools/builtin/`).
- All ops use existing `createTransformOp`/`createDeleteOp`/`createInsertOp`/`createSetSelectionOp` factories. Don't invent new op kinds.
- "Run tests" steps: prefer `pnpm vitest run <path>` over `pnpm test` for speed; final integration step at end runs full `pnpm test && pnpm typecheck`.

---

## Task 1: `useDeleteTool` — always-on Backspace/Delete

**Files:**
- Create: `src/tools/builtin/useDeleteTool.ts`
- Create: `src/tools/builtin/useDeleteTool.test.ts`

`useDeleteTool` wraps the existing `useDelete` action hook. The legacy hook auto-binds `Backspace`/`Delete` to the document; the Tool version *only* exposes a `keyboard.onDown` handler and lets the dispatcher fire it. Tool record id: `'delete'`. Keybinding: `'Backspace'` (the Tool also handles `'Delete'` inside its handler since we can only declare one keybinding string).

- [ ] **Step 1: Read the existing useDelete hook to confirm its API**

```
src/interactions/actions/delete/delete.ts
```

Confirm: signature is `useDelete(adapter, options)` returning `{ deleteSelection(): string[] }`. The Tool wrapper calls `deleteSelection()` from inside `keyboard.onDown`.

- [ ] **Step 2: Write the failing test**

```ts
// src/tools/builtin/useDeleteTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeleteTool } from './useDeleteTool';
import type { ToolCtx } from '../types';

function makeCtx(): ToolCtx {
  return {
    worldX: 0,
    worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: ['a'], applyClick: () => {}, set: () => {}, clear: () => {} } as any,
    adapter: {},
    applyBatch: vi.fn(),
    scratch: undefined,
  };
}

function keyEvent(key: string): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key });
  return e;
}

describe('useDeleteTool', () => {
  it('returns a Tool with id "delete" and keybinding "Backspace"', () => {
    const adapter = { getSelection: () => ['a'], getNode: () => ({ id: 'a' }), applyOps: vi.fn() } as any;
    const { result } = renderHook(() => useDeleteTool(adapter));
    expect(result.current.id).toBe('delete');
    expect(result.current.keybinding).toBe('Backspace');
    expect(result.current.keyboard?.onDown).toBeDefined();
  });

  it('claims Backspace and Delete; passes other keys', () => {
    const adapter = { getSelection: () => ['a'], getNode: () => ({ id: 'a' }), applyOps: vi.fn() } as any;
    const { result } = renderHook(() => useDeleteTool(adapter));
    expect(result.current.keyboard!.onDown!(keyEvent('Backspace'), makeCtx())).toBe('claim');
    expect(result.current.keyboard!.onDown!(keyEvent('Delete'), makeCtx())).toBe('claim');
    expect(result.current.keyboard!.onDown!(keyEvent('a'), makeCtx())).toBe('pass');
  });

  it('invokes adapter delete when Backspace is pressed with selection', () => {
    const applyOps = vi.fn();
    const adapter = {
      getSelection: () => ['a', 'b'],
      getNode: (id: string) => ({ id }),
      applyOps,
    } as any;
    const { result } = renderHook(() => useDeleteTool(adapter));
    act(() => {
      result.current.keyboard!.onDown!(keyEvent('Backspace'), makeCtx());
    });
    expect(applyOps).toHaveBeenCalledTimes(1);
    const ops = applyOps.mock.calls[0][0];
    expect(ops.length).toBeGreaterThan(0);
  });

  it('does nothing on empty selection', () => {
    const applyOps = vi.fn();
    const adapter = {
      getSelection: () => [],
      getNode: () => null,
      applyOps,
    } as any;
    const { result } = renderHook(() => useDeleteTool(adapter));
    result.current.keyboard!.onDown!(keyEvent('Backspace'), makeCtx());
    expect(applyOps).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/tools/builtin/useDeleteTool.test.ts`
Expected: FAIL — `useDeleteTool` not found.

- [ ] **Step 4: Implement**

```ts
// src/tools/builtin/useDeleteTool.ts
import { useMemo } from 'react';
import { useDelete, type DeleteAdapter, type UseDeleteOptions } from '../../interactions/actions/delete/delete';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

export interface UseDeleteToolOptions extends UseDeleteOptions {}

/** Always-on Tool wrapping `useDelete`. Declares its own keybinding
 *  (`Backspace`); also handles `Delete` inside the handler since `Tool.keybinding`
 *  is single-valued. The legacy hook's document-level keybinding is suppressed
 *  by `<Canvas>` when this Tool's id (`'delete'`) appears in `tools.alwaysOn`. */
export function useDeleteTool(
  adapter: DeleteAdapter,
  options: UseDeleteToolOptions = {},
): Tool<undefined> {
  // bindKeyboard: false — the Tool owns its keybinding via the dispatcher.
  const ctl = useDelete(adapter, { ...options, bindKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'delete',
        keybinding: 'Backspace',
        keyboard: {
          onDown: (e) => {
            if (e.key !== 'Backspace' && e.key !== 'Delete') return 'pass';
            ctl.deleteSelection();
            return 'claim';
          },
        },
      }),
    [ctl],
  );
}
```

- [ ] **Step 5: Verify the legacy hook supports `bindKeyboard: false`**

Read `src/interactions/actions/delete/delete.ts` and check `UseDeleteOptions`. If `bindKeyboard` is not yet an option, add it (default true, preserves existing behavior). If it's already there, skip this step.

If you need to add it:

```ts
// src/interactions/actions/delete/delete.ts — locate UseDeleteOptions, add:
/** When false, the hook does NOT attach its own document keybinding; the
 *  consumer drives `deleteSelection()` directly. Default: true. */
bindKeyboard?: boolean;

// And in the keybinding effect, gate on:
if (bindKeyboard === false) return;
```

- [ ] **Step 6: Run tests to verify pass**

Run: `pnpm vitest run src/tools/builtin/useDeleteTool.test.ts`
Expected: PASS (4/4).

- [ ] **Step 7: Run full typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/tools/builtin/useDeleteTool.ts src/tools/builtin/useDeleteTool.test.ts src/interactions/actions/delete/delete.ts
git commit -m "feat(tools): useDeleteTool — always-on Backspace/Delete wrapping useDelete"
```

---

## Task 2: `useNudgeTool` — always-on arrow keys

**Files:**
- Create: `src/tools/builtin/useNudgeTool.ts`
- Create: `src/tools/builtin/useNudgeTool.test.ts`

Wraps `useNudge`. Tool id: `'nudge'`. Keybinding: `'ArrowUp'` declared (the handler also handles ArrowDown/Left/Right). Reads `e.shiftKey` for large-step.

- [ ] **Step 1: Confirm `useNudge` API**

Read `src/interactions/actions/nudge/nudge.ts`. Signature: `useNudge<TPose>(adapter, options) → { nudge(direction, large?) }`. `direction` is `'up' | 'down' | 'left' | 'right'`. `large` is bool.

If the hook auto-binds keyboard, add `enableKeyboard` (or `bindKeyboard`) option mirroring Task 1 step 5.

- [ ] **Step 2: Write the failing test**

```ts
// src/tools/builtin/useNudgeTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNudgeTool } from './useNudgeTool';
import type { ToolCtx } from '../types';

function makeCtx(): ToolCtx {
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: ['a'] } as any,
    adapter: {},
    applyBatch: vi.fn(),
    scratch: undefined,
  };
}

function keyEvent(key: string, shiftKey = false): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key, shiftKey });
  return e;
}

const noopAdapter = {
  getSelection: () => ['a'],
  getPose: () => ({ x: 0, y: 0 }),
  applyOps: vi.fn(),
} as any;

describe('useNudgeTool', () => {
  it('declares id "nudge" and an arrow keybinding', () => {
    const { result } = renderHook(() => useNudgeTool(noopAdapter, { translatePose: (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy }) }));
    expect(result.current.id).toBe('nudge');
    expect(result.current.keybinding).toBe('ArrowUp');
  });

  it('claims arrow keys; passes others', () => {
    const { result } = renderHook(() => useNudgeTool(noopAdapter, { translatePose: (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy }) }));
    for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      expect(result.current.keyboard!.onDown!(keyEvent(k), makeCtx())).toBe('claim');
    }
    expect(result.current.keyboard!.onDown!(keyEvent('a'), makeCtx())).toBe('pass');
  });

  it('translates by step on plain arrow; by largeStep on shift+arrow', () => {
    const applyOps = vi.fn();
    const adapter = {
      getSelection: () => ['a'],
      getPose: () => ({ x: 10, y: 10 }),
      applyOps,
    } as any;
    const { result } = renderHook(() =>
      useNudgeTool(adapter, {
        step: 1,
        largeStep: 10,
        translatePose: (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy }),
      }),
    );
    result.current.keyboard!.onDown!(keyEvent('ArrowRight'), makeCtx());
    result.current.keyboard!.onDown!(keyEvent('ArrowRight', true), makeCtx());
    expect(applyOps).toHaveBeenCalledTimes(2);
    // First call: dx=1
    // Second call: dx=10
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/tools/builtin/useNudgeTool.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// src/tools/builtin/useNudgeTool.ts
import { useMemo } from 'react';
import { useNudge, type NudgeAdapter, type UseNudgeOptions } from '../../interactions/actions/nudge/nudge';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

const KEY_TO_DIR: Record<string, 'up' | 'down' | 'left' | 'right' | undefined> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export interface UseNudgeToolOptions<TPose> extends UseNudgeOptions<TPose> {}

export function useNudgeTool<TPose>(
  adapter: NudgeAdapter<TPose>,
  options: UseNudgeToolOptions<TPose>,
): Tool<undefined> {
  const ctl = useNudge(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'nudge',
        keybinding: 'ArrowUp',
        keyboard: {
          onDown: (e) => {
            const dir = KEY_TO_DIR[e.key];
            if (!dir) return 'pass';
            ctl.nudge(dir, e.shiftKey);
            return 'claim';
          },
        },
      }),
    [ctl],
  );
}
```

- [ ] **Step 5: If needed, add `enableKeyboard: false` support to useNudge**

Mirror Task 1 step 5 if not present. Default true.

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm vitest run src/tools/builtin/useNudgeTool.test.ts && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/useNudgeTool.ts src/tools/builtin/useNudgeTool.test.ts src/interactions/actions/nudge/nudge.ts
git commit -m "feat(tools): useNudgeTool — always-on arrow keys wrapping useNudge"
```

---

## Task 3: `useUndoRedoTool` — always-on Mod+Z / Mod+Shift+Z

**Files:**
- Create: `src/tools/builtin/useUndoRedoTool.ts`
- Create: `src/tools/builtin/useUndoRedoTool.test.ts`

Wraps `useUndoRedo`. Tool id: `'undoRedo'`. Keybinding declared as `'meta+z'` (note: mac convention; the handler treats `meta` and `ctrl` interchangeably so both Mac and Win/Linux work).

- [ ] **Step 1: Confirm useUndoRedo API**

Read `src/interactions/actions/undo-redo/undoRedo.ts`. Signature: `useUndoRedo(adapter, options) → { undo(): boolean; redo(): boolean }`. Add `bindKeyboard: false` option if not present (mirror Task 1 step 5).

- [ ] **Step 2: Write the failing test**

```ts
// src/tools/builtin/useUndoRedoTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUndoRedoTool } from './useUndoRedoTool';
import type { ToolCtx } from '../types';

function makeCtx(): ToolCtx {
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [] } as any,
    adapter: {},
    applyBatch: vi.fn(),
    scratch: undefined,
  };
}

function keyEvent(key: string, opts: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {}): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key, metaKey: false, ctrlKey: false, shiftKey: false, ...opts });
  return e;
}

describe('useUndoRedoTool', () => {
  const adapter = { undo: vi.fn(() => true), redo: vi.fn(() => true) } as any;

  it('declares id "undoRedo"', () => {
    const { result } = renderHook(() => useUndoRedoTool(adapter));
    expect(result.current.id).toBe('undoRedo');
  });

  it('meta+z calls undo; meta+shift+z calls redo', () => {
    adapter.undo.mockClear(); adapter.redo.mockClear();
    const { result } = renderHook(() => useUndoRedoTool(adapter));
    result.current.keyboard!.onDown!(keyEvent('z', { metaKey: true }), makeCtx());
    expect(adapter.undo).toHaveBeenCalledTimes(1);
    result.current.keyboard!.onDown!(keyEvent('z', { metaKey: true, shiftKey: true }), makeCtx());
    expect(adapter.redo).toHaveBeenCalledTimes(1);
  });

  it('ctrl+z works the same as meta+z (cross-platform)', () => {
    adapter.undo.mockClear();
    const { result } = renderHook(() => useUndoRedoTool(adapter));
    result.current.keyboard!.onDown!(keyEvent('z', { ctrlKey: true }), makeCtx());
    expect(adapter.undo).toHaveBeenCalledTimes(1);
  });

  it('plain z passes', () => {
    const { result } = renderHook(() => useUndoRedoTool(adapter));
    expect(result.current.keyboard!.onDown!(keyEvent('z'), makeCtx())).toBe('pass');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/tools/builtin/useUndoRedoTool.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

```ts
// src/tools/builtin/useUndoRedoTool.ts
import { useMemo } from 'react';
import { useUndoRedo, type UndoRedoAdapter, type UseUndoRedoOptions } from '../../interactions/actions/undo-redo/undoRedo';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

export interface UseUndoRedoToolOptions extends UseUndoRedoOptions {}

export function useUndoRedoTool(
  adapter: UndoRedoAdapter,
  options: UseUndoRedoToolOptions = {},
): Tool<undefined> {
  const ctl = useUndoRedo(adapter, { ...options, bindKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'undoRedo',
        keybinding: 'meta+z',
        keyboard: {
          onDown: (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod || e.key.toLowerCase() !== 'z') return 'pass';
            if (e.shiftKey) ctl.redo();
            else ctl.undo();
            return 'claim';
          },
        },
      }),
    [ctl],
  );
}
```

- [ ] **Step 5: Add `bindKeyboard: false` to useUndoRedo if needed**

Mirror Task 1 step 5.

- [ ] **Step 6: Run + typecheck**

Run: `pnpm vitest run src/tools/builtin/useUndoRedoTool.test.ts && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/useUndoRedoTool.ts src/tools/builtin/useUndoRedoTool.test.ts src/interactions/actions/undo-redo/undoRedo.ts
git commit -m "feat(tools): useUndoRedoTool — always-on Mod+Z / Mod+Shift+Z"
```

---

## Task 4: `useDuplicateTool` — always-on Mod+D

**Files:**
- Create: `src/tools/builtin/useDuplicateTool.ts`
- Create: `src/tools/builtin/useDuplicateTool.test.ts`

Wraps `useDuplicate`. Tool id: `'duplicate'`. Keybinding: `'meta+d'`.

- [ ] **Step 1: Confirm useDuplicate API**

Read `src/interactions/actions/duplicate/duplicate.ts`. Signature: `useDuplicate<TPose>(adapter, options) → { duplicate(): void }`. Add `enableKeyboard: false` option if not present.

- [ ] **Step 2: Write failing test**

```ts
// src/tools/builtin/useDuplicateTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDuplicateTool } from './useDuplicateTool';
import type { ToolCtx } from '../types';

function makeCtx(): ToolCtx {
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: ['a'] } as any,
    adapter: {},
    applyBatch: vi.fn(),
    scratch: undefined,
  };
}

function keyEvent(key: string, opts: { metaKey?: boolean; ctrlKey?: boolean; preventDefault?: () => void } = {}): KeyboardEvent {
  const e = new Event('keydown') as KeyboardEvent;
  Object.assign(e, { key, metaKey: false, ctrlKey: false, preventDefault: () => {}, ...opts });
  return e;
}

describe('useDuplicateTool', () => {
  it('declares id "duplicate" and meta+d keybinding', () => {
    const adapter = { getSelection: () => ['a'], getNode: () => ({ id: 'a' }), cloneNode: (o: any) => ({ ...o, id: 'a2' }), applyOps: vi.fn() } as any;
    const { result } = renderHook(() => useDuplicateTool(adapter, {}));
    expect(result.current.id).toBe('duplicate');
    expect(result.current.keybinding).toBe('meta+d');
  });

  it('claims meta+d / ctrl+d; passes plain d', () => {
    const adapter = { getSelection: () => ['a'], getNode: () => ({ id: 'a' }), cloneNode: (o: any) => ({ ...o, id: 'a2' }), applyOps: vi.fn() } as any;
    const { result } = renderHook(() => useDuplicateTool(adapter, {}));
    expect(result.current.keyboard!.onDown!(keyEvent('d', { metaKey: true }), makeCtx())).toBe('claim');
    expect(result.current.keyboard!.onDown!(keyEvent('d', { ctrlKey: true }), makeCtx())).toBe('claim');
    expect(result.current.keyboard!.onDown!(keyEvent('d'), makeCtx())).toBe('pass');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/tools/builtin/useDuplicateTool.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

```ts
// src/tools/builtin/useDuplicateTool.ts
import { useMemo } from 'react';
import { useDuplicate, type DuplicateAdapter, type UseDuplicateOptions } from '../../interactions/actions/duplicate/duplicate';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

export interface UseDuplicateToolOptions<TPose> extends UseDuplicateOptions<TPose> {}

export function useDuplicateTool<TPose>(
  adapter: DuplicateAdapter<TPose>,
  options: UseDuplicateToolOptions<TPose> = {},
): Tool<undefined> {
  const ctl = useDuplicate(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'duplicate',
        keybinding: 'meta+d',
        keyboard: {
          onDown: (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod || e.key.toLowerCase() !== 'd') return 'pass';
            ctl.duplicate();
            return 'claim';
          },
        },
      }),
    [ctl],
  );
}
```

- [ ] **Step 5: Add `enableKeyboard: false` to useDuplicate if needed**

- [ ] **Step 6: Run + typecheck**

Run: `pnpm vitest run src/tools/builtin/useDuplicateTool.test.ts && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/useDuplicateTool.ts src/tools/builtin/useDuplicateTool.test.ts src/interactions/actions/duplicate/duplicate.ts
git commit -m "feat(tools): useDuplicateTool — always-on Mod+D"
```

---

## Task 5: `useInsertTool` — active-slot drag-to-insert

**Files:**
- Create: `src/tools/builtin/useInsertTool.ts`
- Create: `src/tools/builtin/useInsertTool.test.ts`

Wraps `useInsert`. Tool id: `'insert'`. Active-slot tool — no keybinding declared by default (consumer can override via `useKeybindings({ overrides: { i: 'insert' } })`). Cursor: `'crosshair'`.

This is the simplest *active-slot* tool: empty-space drag → call `useInsert` controller.

Channels:
- `pointer.onDown`: stash `{ kind: 'insert' }` in scratch (no controller call yet — wait for threshold).
- `drag.onStart`: `ctl.start(worldX, worldY, modifiers)`.
- `drag.onMove`: `ctl.move(worldX, worldY, modifiers)`.
- `drag.onEnd`: `ctl.end()`.
- `drag.onCancel`: `ctl.cancel()`.

Note: `useInsert` already does its own threshold internally (its `start` enters a 'pending' state, `move` promotes to 'active'). With the dispatcher's threshold gate ahead of it, by the time we call `ctl.start` it's safe to fire it as a single drag-start. We call `ctl.start()` from `drag.onStart` (post-threshold) for clarity.

- [ ] **Step 1: Confirm useInsert API**

Read `src/interactions/gestures/insert/insert.ts`. Signature: `useInsert<TNode, TPose>(adapter, options) → InsertController { start, move, end, cancel, isInserting, overlay }`.

- [ ] **Step 2: Write failing test**

```ts
// src/tools/builtin/useInsertTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInsertTool } from './useInsertTool';
import type { ToolCtx } from '../types';

function makeCtx(over: Partial<ToolCtx> = {}): ToolCtx {
  return {
    worldX: 10, worldY: 20,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [] } as any,
    adapter: {},
    applyBatch: vi.fn(),
    scratch: undefined,
    ...over,
  };
}

function pe(): PointerEvent {
  const e = new Event('pointerdown') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
  return e;
}

describe('useInsertTool', () => {
  const adapter = {
    getSelection: () => [],
    applyOps: vi.fn(),
  } as any;
  const opts = {
    commitInsert: () => ({ id: 'new', x: 0, y: 0, w: 10, h: 10 }),
  } as any;

  it('declares id "insert" and crosshair cursor', () => {
    const { result } = renderHook(() => useInsertTool(adapter, opts));
    expect(result.current.id).toBe('insert');
    expect(result.current.cursor).toBe('crosshair');
  });

  it('claims drag.onStart and routes to insert controller', () => {
    const { result } = renderHook(() => useInsertTool(adapter, opts));
    const decision = result.current.drag!.onStart!(pe(), makeCtx());
    expect(decision).toBe('claim');
  });

  it('drag.onMove claims and forwards', () => {
    const { result } = renderHook(() => useInsertTool(adapter, opts));
    result.current.drag!.onStart!(pe(), makeCtx());
    const decision = result.current.drag!.onMove!(pe(), makeCtx({ worldX: 50, worldY: 60 }));
    expect(decision).toBe('claim');
  });

  it('drag.onEnd commits via the wrapped controller', () => {
    const commitInsert = vi.fn(() => ({ id: 'new' }));
    const adapter2 = { getSelection: () => [], applyOps: vi.fn() } as any;
    const { result } = renderHook(() => useInsertTool(adapter2, { commitInsert } as any));
    result.current.drag!.onStart!(pe(), makeCtx());
    result.current.drag!.onMove!(pe(), makeCtx({ worldX: 50, worldY: 60 }));
    result.current.drag!.onEnd!(pe(), makeCtx({ worldX: 50, worldY: 60 }));
    expect(commitInsert).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/tools/builtin/useInsertTool.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

```ts
// src/tools/builtin/useInsertTool.ts
import { useMemo } from 'react';
import { useInsert, type InsertAdapter, type UseInsertOptions } from '../../interactions/gestures/insert/insert';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

export interface UseInsertToolOptions<TPose> extends UseInsertOptions<TPose> {}

export function useInsertTool<TNode, TPose>(
  adapter: InsertAdapter<TNode>,
  options: UseInsertToolOptions<TPose>,
): Tool<undefined> {
  const ctl = useInsert<TNode, TPose>(adapter, options);

  return useMemo(
    () =>
      defineTool({
        id: 'insert',
        cursor: 'crosshair',
        drag: {
          onStart: (_e, ctx) => {
            ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onMove: (_e, ctx) => {
            ctl.move(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onEnd: () => {
            ctl.end();
            return 'claim';
          },
          onCancel: () => {
            ctl.cancel();
          },
        },
      }),
    [ctl],
  );
}
```

- [ ] **Step 5: Run + typecheck**

Run: `pnpm vitest run src/tools/builtin/useInsertTool.test.ts && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/tools/builtin/useInsertTool.ts src/tools/builtin/useInsertTool.test.ts
git commit -m "feat(tools): useInsertTool — active-slot drag-to-insert wrapping useInsert"
```

---

## Task 6: `useSelectTool` — active-slot wrapping move/resize/rotate/areaSelect

**Files:**
- Create: `src/tools/builtin/useSelectTool.ts`
- Create: `src/tools/builtin/useSelectTool.test.ts`

The big one. `useSelectTool` calls four hooks internally and synthesizes a Tool whose handlers route based on what was hit at pointer-down.

### Behavior

`pointer.onDown(e, ctx)`:
1. Run hit tests in priority order: rotate handle → resize handle → body → empty.
2. Stash result in `scratch`: `{ kind: 'rotate' | 'resize' | 'move' | 'area', target?: ... }`.
3. For body hits, also call `selection.applyClick(...)` immediately (preserve current Canvas behavior; see locked decision #3).
4. Return `'claim'` for all hits (rotate/resize/body/empty); the dispatcher will hold the gesture and fire `drag.onStart` when threshold crosses.

`drag.onStart(e, ctx)`:
- Read `scratch.kind`, call the matching controller's `start(...)`.
- For `'move'`: `move.start({ ids: selection.current, worldX, worldY, clientX: e.clientX, clientY: e.clientY })`.
- For `'resize'`: `resize.start(target.id, target.anchor, worldX, worldY)`.
- For `'rotate'`: `rotate.start({ id: target.id, worldX, worldY })`.
- For `'area'`: `areaSelect.start(worldX, worldY, modifiers)`.

`drag.onMove`/`onEnd`/`onCancel`: route to the controller named in `scratch.kind`.

`pointer.onClick`: if `scratch.kind === 'move'`, the click already selected the body in `pointer.onDown` — nothing to do. If `scratch.kind === 'area'`, no-op (sub-threshold marquee = no selection change). Other kinds: no-op.

### Options

`useSelectTool(adapter, options)` takes:
- `adapter` — must satisfy union of `MoveAdapter & ResizeAdapter & RotateAdapter & AreaSelectAdapter` (already true for current Canvas adapters).
- `options.hitBody(wx, wy) → string[]` — required.
- `options.boundsOf(id) → Bounds` — required.
- `options.handleHitRadius?: number` — default 8.
- `options.rotationHandleDistance?: number` — default 24.
- `options.move?: UseMoveOptions<TPose>` — passed to `useMove`.
- `options.resize?: UseResizeOptions<TPose>`
- `options.rotate?: UseRotateOptions<TPose>`
- `options.areaSelect?: UseAreaSelectOptions`

Cursor: `'default'`.

### Scratch shape

```ts
type SelectScratch =
  | { kind: 'idle' }
  | { kind: 'move'; ids: string[] }
  | { kind: 'resize'; targetId: string; anchor: ResizeAnchor }
  | { kind: 'rotate'; targetId: string }
  | { kind: 'area' };
```

`initScratch: () => ({ kind: 'idle' })`.

- [ ] **Step 1: Read all four wrapped hooks for adapter shapes**

Files to read for type imports:
- `src/interactions/gestures/move/move.ts` — `MoveAdapter`, `UseMoveOptions`, `MoveController`
- `src/interactions/gestures/resize/resize.ts` — `ResizeAdapter`, `UseResizeOptions`, `ResizeController`, `ResizeAnchor`
- `src/interactions/gestures/rotate/rotate.ts` — `RotateAdapter`, `UseRotateOptions`, `RotateController`
- `src/interactions/gestures/area-select/areaSelect.ts` — `AreaSelectAdapter`, `UseAreaSelectOptions`, `AreaSelectController`

Also read the existing handle-hit utilities the Canvas uses today:
- `src/interactions/handles/` (or wherever `cornerResizeHandles`, `hitCornerHandle`, `rotationHandle`, `hitRotationHandle` live — find them).

If the handle utilities aren't already exported from `src/index.ts`, note that — the tool file imports them from their internal paths.

- [ ] **Step 2: Write failing tests (focused)**

Don't try to test every channel route exhaustively — that's the dispatcher's job. Test that:
1. Tool record has correct id and cursor.
2. `pointer.onDown` over a body hit stashes `kind: 'move'` and calls `selection.applyClick`.
3. `pointer.onDown` over empty space stashes `kind: 'area'`.
4. `drag.onStart` after a body-hit calls `move.start` with the right ids.
5. `drag.onStart` after empty-hit calls `areaSelect.start`.
6. `drag.onMove` and `drag.onEnd` route by `scratch.kind`.

```ts
// src/tools/builtin/useSelectTool.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSelectTool } from './useSelectTool';
import type { ToolCtx } from '../types';

function pe(over: Partial<PointerEvent> = {}): PointerEvent {
  const e = new Event('pointerdown') as PointerEvent;
  Object.assign(e, { pointerId: 1, clientX: 100, clientY: 100, button: 0, ...over });
  return e;
}

function ctxOver(over: Partial<ToolCtx> = {}): ToolCtx {
  return {
    worldX: 50, worldY: 50,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    selection: { current: [], applyClick: vi.fn(), set: vi.fn(), clear: vi.fn() } as any,
    adapter: {},
    applyBatch: vi.fn(),
    scratch: { kind: 'idle' },
    ...over,
  };
}

const minimalAdapter = {
  getSelection: () => [],
  setSelection: vi.fn(),
  getNode: (id: string) => ({ id }),
  getNodes: () => [],
  getPose: (_id: string) => ({ x: 0, y: 0, w: 10, h: 10 }),
  applyOps: vi.fn(),
} as any;

describe('useSelectTool', () => {
  it('declares id "select" and default cursor', () => {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: () => ({ x: 0, y: 0, w: 10, h: 10 }),
      }),
    );
    expect(result.current.id).toBe('select');
    expect(result.current.cursor).toBe('default');
  });

  it('pointer.onDown over body stashes kind:move and selects', () => {
    const applyClick = vi.fn();
    const ctx = ctxOver({
      selection: { current: [], applyClick, set: vi.fn(), clear: vi.fn() } as any,
    });
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => ['hit-id'],
        boundsOf: () => ({ x: 0, y: 0, w: 10, h: 10 }),
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(ctx.scratch).toEqual(expect.objectContaining({ kind: 'move' }));
    expect(applyClick).toHaveBeenCalledWith('hit-id', ctx.modifiers);
  });

  it('pointer.onDown over empty stashes kind:area', () => {
    const ctx = ctxOver();
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        hitBody: () => [],
        boundsOf: () => ({ x: 0, y: 0, w: 10, h: 10 }),
      }),
    );
    result.current.pointer!.onDown!(pe(), ctx);
    expect(ctx.scratch).toEqual({ kind: 'area' });
  });

  // Additional drag.onStart routing tests follow the same shape; assert
  // that the right wrapped controller method ran by spying through the
  // adapter (which all four controllers use to apply ops). Asserting the
  // exact controller method requires mocking React hooks — out of scope.
  // The integration smoke test in Task 9 covers end-to-end routing.
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/tools/builtin/useSelectTool.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement (full)**

```ts
// src/tools/builtin/useSelectTool.ts
import { useMemo } from 'react';
import { useMove, type MoveAdapter, type UseMoveOptions } from '../../interactions/gestures/move/move';
import { useResize, type ResizeAdapter, type UseResizeOptions, type ResizeAnchor } from '../../interactions/gestures/resize/resize';
import { useRotate, type RotateAdapter, type UseRotateOptions } from '../../interactions/gestures/rotate/rotate';
import { useAreaSelect, type AreaSelectAdapter, type UseAreaSelectOptions } from '../../interactions/gestures/area-select/areaSelect';
import {
  cornerResizeHandles,
  hitCornerHandle,
  rotationHandle,
  hitRotationHandle,
} from '../../interactions/handles';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

interface Bounds { x: number; y: number; w: number; h: number }

export interface UseSelectToolOptions<TNode, TPose> {
  hitBody: (worldX: number, worldY: number) => string[];
  boundsOf: (id: string) => Bounds | null;
  handleHitRadius?: number;
  rotationHandleDistance?: number;
  move?: UseMoveOptions<TPose>;
  resize?: UseResizeOptions<TPose>;
  rotate?: UseRotateOptions<TPose>;
  areaSelect?: UseAreaSelectOptions;
}

type Adapter<TNode, TPose> = MoveAdapter<TNode, TPose>
  & ResizeAdapter<TNode, TPose>
  & RotateAdapter<TNode, TPose>
  & AreaSelectAdapter;

type SelectScratch =
  | { kind: 'idle' }
  | { kind: 'move'; ids: string[] }
  | { kind: 'resize'; targetId: string; anchor: ResizeAnchor }
  | { kind: 'rotate'; targetId: string }
  | { kind: 'area' };

export function useSelectTool<TNode extends { id: string }, TPose>(
  adapter: Adapter<TNode, TPose>,
  options: UseSelectToolOptions<TNode, TPose>,
): Tool<SelectScratch> {
  const move = useMove<TNode, TPose>(adapter, options.move ?? {});
  const resize = useResize<TNode, TPose>(adapter, options.resize ?? {});
  const rotate = useRotate<TNode, TPose>(adapter, options.rotate ?? {});
  const areaSelect = useAreaSelect(adapter, options.areaSelect ?? {});

  const handleHitRadius = options.handleHitRadius ?? 8;
  const rotationHandleDistance = options.rotationHandleDistance ?? 24;

  return useMemo(
    () =>
      defineTool<SelectScratch>({
        id: 'select',
        cursor: 'default',
        initScratch: () => ({ kind: 'idle' }),

        pointer: {
          onDown: (_e, ctx) => {
            const sel = ctx.selection.current;
            // 1. Rotate handle (when single selection)
            if (sel.length === 1) {
              const b = options.boundsOf(sel[0]);
              if (b) {
                const handle = rotationHandle(b, rotationHandleDistance);
                if (hitRotationHandle(handle, ctx.worldX, ctx.worldY, handleHitRadius)) {
                  ctx.scratch = { kind: 'rotate', targetId: sel[0] };
                  return 'claim';
                }
              }
            }
            // 2. Resize handles (when single selection)
            if (sel.length === 1) {
              const b = options.boundsOf(sel[0]);
              if (b) {
                for (const h of cornerResizeHandles(b)) {
                  if (hitCornerHandle(h, ctx.worldX, ctx.worldY, handleHitRadius)) {
                    ctx.scratch = { kind: 'resize', targetId: sel[0], anchor: h.anchor };
                    return 'claim';
                  }
                }
              }
            }
            // 3. Body hit
            const ids = options.hitBody(ctx.worldX, ctx.worldY);
            if (ids.length > 0) {
              ctx.selection.applyClick(ids[0], ctx.modifiers);
              const moveIds = ctx.selection.current.length > 0 ? ctx.selection.current : ids;
              ctx.scratch = { kind: 'move', ids: moveIds };
              return 'claim';
            }
            // 4. Empty → area-select
            ctx.scratch = { kind: 'area' };
            return 'claim';
          },
        },

        drag: {
          onStart: (e, ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move':
                move.start({ ids: s.ids, worldX: ctx.worldX, worldY: ctx.worldY, clientX: e.clientX, clientY: e.clientY });
                return 'claim';
              case 'resize':
                resize.start(s.targetId, s.anchor, ctx.worldX, ctx.worldY);
                return 'claim';
              case 'rotate':
                rotate.start({ id: s.targetId, worldX: ctx.worldX, worldY: ctx.worldY });
                return 'claim';
              case 'area':
                areaSelect.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              default:
                return 'pass';
            }
          },
          onMove: (e, ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move':
                move.move({ worldX: ctx.worldX, worldY: ctx.worldY, clientX: e.clientX, clientY: e.clientY, modifiers: ctx.modifiers });
                return 'claim';
              case 'resize':
                resize.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              case 'rotate':
                rotate.move({ worldX: ctx.worldX, worldY: ctx.worldY, modifiers: ctx.modifiers });
                return 'claim';
              case 'area':
                areaSelect.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              default:
                return 'pass';
            }
          },
          onEnd: (_e, ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move': move.end(); return 'claim';
              case 'resize': resize.end(); return 'claim';
              case 'rotate': rotate.end(); return 'claim';
              case 'area': areaSelect.end(); return 'claim';
              default: return 'pass';
            }
          },
          onCancel: (ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move': move.cancel(); break;
              case 'resize': resize.cancel(); break;
              case 'rotate': rotate.cancel(); break;
              case 'area': areaSelect.cancel(); break;
            }
          },
        },
      }),
    [move, resize, rotate, areaSelect, options.hitBody, options.boundsOf, handleHitRadius, rotationHandleDistance],
  );
}
```

- [ ] **Step 5: Verify handle utilities are importable from `'../../interactions/handles'`**

If the import path is wrong (the survey didn't pin them down — find them with `Grep` on `cornerResizeHandles`), update the import. If they're internal-only and not exported through a barrel, import from their actual file path. Don't restructure; just import directly.

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm vitest run src/tools/builtin/useSelectTool.test.ts && pnpm typecheck`
Expected: PASS (3/3 unit tests), clean.

If TypeScript complains about `Adapter<TNode, TPose>` intersection (some hook adapters may have conflicting overloads of the same method name), narrow the intersection by switching to a generic `unknown` cast inside the controller calls and letting userland's adapter satisfy each underlying hook's adapter interface separately. If you hit this, **stop and report** with the exact error.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/useSelectTool.ts src/tools/builtin/useSelectTool.test.ts
git commit -m "feat(tools): useSelectTool — wraps useMove/useResize/useRotate/useAreaSelect"
```

---

## Task 7: Builtin barrel + re-export

**Files:**
- Create: `src/tools/builtin/index.ts`
- Modify: `src/tools/index.ts`

- [ ] **Step 1: Write the barrel**

```ts
// src/tools/builtin/index.ts
export { useDeleteTool, type UseDeleteToolOptions } from './useDeleteTool';
export { useNudgeTool, type UseNudgeToolOptions } from './useNudgeTool';
export { useUndoRedoTool, type UseUndoRedoToolOptions } from './useUndoRedoTool';
export { useDuplicateTool, type UseDuplicateToolOptions } from './useDuplicateTool';
export { useInsertTool, type UseInsertToolOptions } from './useInsertTool';
export { useSelectTool, type UseSelectToolOptions } from './useSelectTool';
```

- [ ] **Step 2: Add to `src/tools/index.ts`**

Append (don't rewrite — Phase 1 already created this file):

```ts
// src/tools/index.ts — append at end
export * from './builtin';
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/index.ts src/tools/index.ts
git commit -m "feat(tools): builtin barrel — useSelectTool/useInsertTool/use{Delete,Nudge,UndoRedo,Duplicate}Tool"
```

---

## Task 8: Canvas legacy-hook dedupe

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Modify: `src/canvas/Canvas.test.tsx`

When `tools` is set, the existing legacy gesture/action wiring must be suppressed for any behavior whose Tool is registered. Otherwise: double-fire on Backspace (legacy `useDelete` keybinding + Tool dispatch), or move-via-tool *and* move-via-legacy-usePointerGestures concurrently.

### Dedupe rules

A Tool with id `X` in `tools.alwaysOn` suppresses the legacy keybinding for the matching action hook:
- `'delete'` → suppresses legacy delete keybinding
- `'nudge'` → suppresses legacy nudge keybinding
- `'undoRedo'` → suppresses legacy undoRedo keybinding
- `'duplicate'` → suppresses legacy duplicate keybinding

A Tool with id `X` in `tools.registry` (active-slot) suppresses legacy gesture wiring:
- `'select'` → suppresses legacy `move`/`resize`/`rotate`/`areaSelect` dispatch in `usePointerGestures`
- `'insert'` → suppresses legacy `insert` dispatch in `usePointerGestures`

For the gesture case, since `usePointerGestures` walks priority by *what's wired*, we suppress by passing `undefined` for the matching controllers when a select/insert Tool is in the registry.

### Implementation

The `tools` API needs to expose its registered ids to Canvas. Phase 1's `useTools` likely returns an api with `registry` and `alwaysOn`. Confirm by reading `src/tools/useTools.ts`. If not exposed, add a getter `tools.has(id: string): boolean` that checks both registry and alwaysOn.

- [ ] **Step 1: Read `useTools.ts` to find how to query registered ids**

If there's no `has(id)` API, add one:

```ts
// src/tools/useTools.ts — extend ToolsApi
has(id: string): boolean;
```

Implementation:

```ts
has(id: string) {
  return id in registryRef.current || alwaysOnRef.current.some(t => t.id === id);
}
```

(Names depend on the actual implementation — adapt to what's there.)

- [ ] **Step 2: Write failing tests for dedupe**

```tsx
// src/canvas/Canvas.test.tsx — append
import { useDeleteTool } from '../tools/builtin/useDeleteTool';
import { useSelectTool } from '../tools/builtin/useSelectTool';

describe('Canvas tools dedupe', () => {
  it('suppresses legacy delete keybinding when delete Tool is in alwaysOn', () => {
    // Setup: Canvas with both legacy `gestures={{ delete: { ... } }}` and a tools API
    // whose alwaysOn contains a 'delete' Tool. Press Backspace. Assert the legacy
    // hook's deleteSelection was NOT called (only the Tool fired).
    //
    // Implementation hint: use renderHook + render + fireEvent. Mock the legacy
    // delete adapter to count calls; mock the tool adapter separately.
  });

  it('suppresses legacy move/resize/rotate dispatch when select Tool is registered', () => {
    // Setup: Canvas with legacy gestures wired AND a tools API with 'select' in registry.
    // Pointerdown over a body. Assert the legacy move.start was NOT called (Tool's
    // pointer.onDown ran instead).
  });
});
```

(These tests are sketch — implementer fills in the assertions using Canvas's existing test patterns. The key check is that legacy paths are inert when a Tool covers the same behavior.)

- [ ] **Step 3: Run tests to verify failure**

Run: `pnpm vitest run src/canvas/Canvas.test.tsx`
Expected: FAIL on the two new tests.

- [ ] **Step 4: Implement dedupe in Canvas.tsx**

Find where each action hook is wired (per the survey, lines 823–832 for delete, 837–850 for nudge, 857 for undoRedo, 860–872 for duplicate). For each, change the gating expression:

```ts
// Before:
useDelete(adapter, { ...gestures?.delete, bindKeyboard: deleteEnabled });

// After:
useDelete(adapter, {
  ...gestures?.delete,
  bindKeyboard: deleteEnabled && !tools?.has('delete'),
});
```

Repeat for `nudge` (`enableKeyboard`), `undoRedo` (`bindKeyboard`), `duplicate` (`enableKeyboard`).

For gesture suppression, find the `usePointerGestures(...)` call (~line 1079). Change its arguments:

```ts
const moveCtl = move ? internalMove : undefined;
const resizeCtl = resize ? internalResize : undefined;
const rotateCtl = rotate ? internalRotate : undefined;
const insertCtl = insert ? internalInsert : undefined;
const areaSelectCtl = areaSelect ? internalAreaSelect : undefined;

const selectToolHandled = !!tools?.has('select');
const insertToolHandled = !!tools?.has('insert');

usePointerGestures({
  // ...other args...
  move: selectToolHandled ? undefined : moveCtl,
  resize: selectToolHandled ? undefined : resizeCtl,
  rotate: selectToolHandled ? undefined : rotateCtl,
  areaSelect: selectToolHandled ? undefined : areaSelectCtl,
  insert: insertToolHandled ? undefined : insertCtl,
});
```

(Exact prop names: confirm against current Canvas.tsx — they may differ slightly.)

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: full suite clean.

- [ ] **Step 6: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx src/tools/useTools.ts
git commit -m "feat(canvas): suppress legacy gesture/action wiring when matching Tool is registered"
```

---

## Task 9: End-to-end smoke test

**Files:**
- Create: `src/tools/builtin/integration.test.tsx`

End-to-end test: render `<Canvas tools={tools}>` with `useSelectTool` + `useDeleteTool` + a minimal scene. Simulate a pointerdown-drag-pointerup over a body and assert the object moved (transform op applied). Press Backspace and assert the object deleted.

This is the proof that all the wiring (tools → dispatcher → tool record → wrapped controller → adapter → ops) works end-to-end.

- [ ] **Step 1: Write the test**

```tsx
// src/tools/builtin/integration.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { useTools, useSelectTool, useDeleteTool, defineTool } from '../';
import { Canvas } from '../../canvas/Canvas';

// Use the same minimal-adapter pattern that other Canvas tests use; consult
// src/canvas/Canvas.test.tsx for setup boilerplate (scene, layers, hitBody,
// boundsOf, etc.).

describe('Phase 2a integration', () => {
  it('select tool drags an object → transform op applied', () => {
    // 1. Build adapter with one rectangle at (0, 0, 50, 50).
    // 2. Render <Canvas adapter={adapter} tools={tools} layers={{}} />
    //    where tools = useTools({ active: 'select', registry: { select: useSelectTool(...) } })
    // 3. Pointerdown at (25, 25), pointermove to (100, 100), pointerup.
    // 4. Assert applyOps was called with a Transform op moving the rect by (75, 75).
  });

  it('delete tool fires on Backspace and applies a delete op', () => {
    // 1. Build adapter with one selected rectangle.
    // 2. Render <Canvas adapter={adapter} tools={tools} layers={{}} />
    //    where tools = useTools({ active: 'select', registry: { select }, alwaysOn: [del] })
    // 3. fireEvent.keyDown(document, { key: 'Backspace' })
    // 4. Assert applyOps was called with a Delete op for the selected id.
  });
});
```

The implementer writes the actual setup based on existing test patterns in `src/canvas/Canvas.test.tsx`. The important assertions are:
- A move-via-tools-path actually mutates state (proves `useSelectTool` → `useMove` → `applyOps` chain works)
- Backspace via tools-path actually deletes (proves dispatcher → `useDeleteTool` → `useDelete` → `applyOps` chain works)
- The legacy paths did NOT also fire (proves dedupe works) — assert call count is exactly 1, not 2.

- [ ] **Step 2: Run, fix, run again until green**

Run: `pnpm vitest run src/tools/builtin/integration.test.tsx`

If failures, debug and fix. If a fundamental wiring bug surfaces (not just test-setup issues), **stop and report BLOCKED** — don't paper over with skipped tests.

- [ ] **Step 3: Run full suite**

Run: `pnpm test && pnpm typecheck`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/integration.test.tsx
git commit -m "test(tools): Phase 2a end-to-end — select drag + delete via tools path"
```

---

## Self-review notes

1. **Spec coverage:** Spec lists `select`, `hand`, `insert`, plus action tools (`deleteSelection`, `nudge`, `undoRedo`, `duplicate`). This plan ships everything except `hand` (Phase 2b — explicitly out of scope).
2. **Spec mentions `eyedropper-stub` in catalogue:** Shipped — see [eyedropper plan](../superpowers/plans/2026-05-12-eyedropper-tool.md).
3. **`useEditAnchors` not in this plan:** The spec's "select" wraps move/resize/rotate/areaSelect; editAnchors is a path-editing mode entered via double-click, conceptually a separate tool. Defer to Phase 2c (cookbook) or a later phase — flag if user wants it folded into select.
4. **Selection-on-pointerdown** is preserved per locked decision #3; memory-noted for revisit later.
5. **Dedupe scope:** Only suppresses behaviors covered by registered Tool ids. If userland leaves `useUndoRedoTool` out of `alwaysOn`, the legacy `useUndoRedo` keybinding stays active. This is intentional — it's a smooth-migration affordance, not a hard cutover.
6. **Order of tasks** (action tools before gesture tools) means each task lands a small, testable chunk; useSelectTool — the riskiest — comes after the pattern is proven.
