# Active Colors Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift swillustrator's active-paint state into a kit-registered "active-colors" tool that owns the state, exposes a single imperative `api`, and publishes it to the React subtree via context. Scene-write helpers (`applyFillToSelection` / `applyStrokeToSelection` / `applyStrokeWidthToSelection`) move from `App.tsx` onto the api.

**Architecture:** A new `useActiveColorsTool(opts)` hook returns `{ tool, api }`. The `Tool` registers D / X / Shift-X / `/` via `initial.keyDown` in the ambient list of the kit dispatcher. The `api` is the existing `ActiveColorsApi` plus three scene-write methods that delegate to the App's `updateSelected` helper (passed in as a dep). A new `<ActiveColorsProvider value={api}>` + `useActiveColors()` give UI components the api without prop-drilling. Non-React tools (eyedropper) still receive the api directly at construction.

**Tech Stack:** TypeScript, React 19, Vitest, `@orochi235/weasel` (the kit), `defineTool` + `claim` from `src/tools/routing`.

**Spec:** `docs/superpowers/specs/2026-05-16-active-colors-tool-design.md`

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.ts` | create | Hook returning `{ tool, api }`; owns state + scene-write methods + Tool definition |
| `apps/swillustrator/src/tools/activeColors/ActiveColorsContext.tsx` | create | `<ActiveColorsProvider>` + `useActiveColors()` |
| `apps/swillustrator/src/tools/activeColors/index.ts` | create | Barrel: re-exports the hook, provider, and context-hook |
| `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts` | create | Vitest covering keybinding routes + scene-write op shapes |
| `apps/swillustrator/src/useActiveColors.ts` | delete | Replaced by the new hook |
| `apps/swillustrator/src/App.tsx` | modify | Hook swap, provider wrap, drop scene-write closures, drop 4× `useAction`, strip props from `<RightSidebar>` |
| `apps/swillustrator/src/ActiveSwatches.tsx` | modify | Props collapse to `{ compact? }`; body reads context |

---

## Task 1: Worktree + scaffolding

**Files:**
- Create dir: `apps/swillustrator/src/tools/activeColors/`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/mike/src/weasel/apps/swillustrator/src/tools/activeColors
```

- [ ] **Step 2: Create empty `index.ts` barrel**

Write `apps/swillustrator/src/tools/activeColors/index.ts`:

```ts
export { useActiveColorsTool, type ActiveColorsApi, type UseActiveColorsToolOptions } from './useActiveColorsTool';
export { ActiveColorsProvider, useActiveColors } from './ActiveColorsContext';
```

- [ ] **Step 3: No commit yet** — the named exports don't exist, so committing now would leave the tree broken. Proceed to Task 2.

---

## Task 2: Port the state hook body into `useActiveColorsTool` (active-paint cluster only)

**Files:**
- Create: `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.ts`
- Read for reference: `apps/swillustrator/src/useActiveColors.ts` (entire file)

This task lifts the *existing* state-management body of `useActiveColors` into the new file, but **omits the four `useAction(...)` registrations** (those move to the Tool in Task 4) and **does not yet add scene-write methods** (Task 3). The hook this task ships does not return a Tool yet — it returns `{ api }` so unit tests can exercise it.

- [ ] **Step 1: Write the test**

Write `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveColorsTool } from './useActiveColorsTool';

const noopUpdateSelected = () => {};

describe('useActiveColorsTool — state cluster', () => {
  it('reset returns fill to white and stroke to black', () => {
    const { result } = renderHook(() =>
      useActiveColorsTool({ updateSelected: noopUpdateSelected }),
    );
    act(() => {
      result.current.api.setFillColor('#123456ff');
      result.current.api.setStrokeColor('#abcdefff');
      result.current.api.reset();
    });
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
    expect(result.current.api.stroke).toEqual({ kind: 'solid', color: '#000000ff' });
  });

  it('swap exchanges fill and stroke', () => {
    const { result } = renderHook(() =>
      useActiveColorsTool({ updateSelected: noopUpdateSelected }),
    );
    act(() => {
      result.current.api.setFillColor('#aaaaaaff');
      result.current.api.setStrokeColor('#bbbbbbff');
      result.current.api.swap();
    });
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#bbbbbbff' });
    expect(result.current.api.stroke).toEqual({ kind: 'solid', color: '#aaaaaaff' });
  });

  it('swapFocus toggles focused side', () => {
    const { result } = renderHook(() =>
      useActiveColorsTool({ updateSelected: noopUpdateSelected }),
    );
    expect(result.current.api.focused).toBe('fill');
    act(() => result.current.api.swapFocus());
    expect(result.current.api.focused).toBe('stroke');
    act(() => result.current.api.swapFocus());
    expect(result.current.api.focused).toBe('fill');
  });

  it('toggleFocusedNone flips between solid and none', () => {
    const { result } = renderHook(() =>
      useActiveColorsTool({ updateSelected: noopUpdateSelected }),
    );
    act(() => result.current.api.toggleFocusedNone());
    expect(result.current.api.fill).toEqual({ kind: 'none' });
    act(() => result.current.api.toggleFocusedNone());
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
  });
});
```

- [ ] **Step 2: Run test (expect to fail with import error)**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts
```

Expected: FAIL — `Failed to resolve import "./useActiveColorsTool"`.

- [ ] **Step 3: Write the hook (state cluster only — no tool, no scene writes)**

Write `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.ts`:

```ts
/**
 * Hook owner of swillustrator's active-paint state (fill / stroke /
 * focus) plus the scene-write methods that propagate paint to the
 * current selection. Returns `{ tool, api }` — the Tool registers
 * keybindings (D / X / Shift-X / `/`) in the kit's ambient list; the
 * api is the single imperative surface for any color-change caller
 * (UI via React context, other tools via direct closure).
 *
 * Lifted from the old `useActiveColors` hook (state cluster) and from
 * `App.tsx`'s applyFillToSelection / applyStrokeToSelection /
 * applyStrokeWidthToSelection closures (scene-write cluster). Adding
 * a method here is the supported way to extend the color-change API.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ActivePaint } from '../../ActiveSwatches';
import {
  DEFAULT_FILL,
  DEFAULT_STROKE,
  getAlpha01,
  mergeAlphaFromPrev,
  toHex8,
  withAlpha01,
} from '../../ActiveSwatches';
import type { Obj } from '../../poseUpdate';

export interface ActiveColorsApi {
  // Active-paint state
  fill: ActivePaint;
  stroke: ActivePaint;
  focused: 'fill' | 'stroke';
  setFill: (p: ActivePaint) => void;
  setStroke: (p: ActivePaint) => void;
  setFocused: (p: ActivePaint) => void;
  setFocus: (which: 'fill' | 'stroke') => void;
  setFillColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setFocusedColor: (color: string) => void;
  focusedAlpha: number;
  setFocusedAlpha: (alpha01: number) => void;
  swap: () => void;
  swapFocus: () => void;
  toggleFocusedNone: () => void;
  toggleFocusedTransparent: () => void;
  reset: () => void;
  // Scene-write routing (filled in by Task 3).
  applyFillToSelection: (color: string) => void;
  applyStrokeToSelection: (color: string) => void;
  applyStrokeWidthToSelection: (w: number) => void;
}

export interface UseActiveColorsToolOptions {
  initialFill?: ActivePaint;
  initialStroke?: ActivePaint;
  initialFocus?: 'fill' | 'stroke';
  /** Scene-write seam: matches App.tsx's `updateSelected(patch, label?)`.
   *  The hook delegates each `apply*ToSelection` call through here so
   *  the existing undo capture + label semantics carry through. */
  updateSelected: (patch: (o: Obj) => Obj, label?: string) => void;
}

export function useActiveColorsTool(opts: UseActiveColorsToolOptions): {
  api: ActiveColorsApi;
} {
  const [fill, setFill] = useState<ActivePaint>(opts.initialFill ?? DEFAULT_FILL);
  const [stroke, setStroke] = useState<ActivePaint>(opts.initialStroke ?? DEFAULT_STROKE);
  const [focused, setFocus] = useState<'fill' | 'stroke'>(opts.initialFocus ?? 'fill');

  const fillRef = useRef(fill); fillRef.current = fill;
  const strokeRef = useRef(stroke); strokeRef.current = stroke;
  const focusedRef = useRef(focused); focusedRef.current = focused;

  const setFocused = useCallback((p: ActivePaint) => {
    if (focusedRef.current === 'fill') setFill(p);
    else setStroke(p);
  }, []);

  const setFillColor = useCallback((color: string) => {
    const prev = fillRef.current.kind === 'solid' ? fillRef.current.color : '#ffffffff';
    setFill({ kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) });
  }, []);
  const setStrokeColor = useCallback((color: string) => {
    const prev = strokeRef.current.kind === 'solid' ? strokeRef.current.color : '#000000ff';
    setStroke({ kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) });
  }, []);
  const setFocusedColor = useCallback((color: string) => {
    const which = focusedRef.current;
    if (which === 'fill') {
      const prev = fillRef.current.kind === 'solid' ? fillRef.current.color : '#ffffffff';
      setFill({ kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) });
    } else {
      const prev = strokeRef.current.kind === 'solid' ? strokeRef.current.color : '#000000ff';
      setStroke({ kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) });
    }
  }, []);

  const focusedPaint = focused === 'fill' ? fill : stroke;
  const focusedAlpha = focusedPaint.kind === 'solid' ? getAlpha01(focusedPaint.color) : 1;
  const setFocusedAlpha = useCallback((alpha01: number) => {
    const which = focusedRef.current;
    const cur = which === 'fill' ? fillRef.current : strokeRef.current;
    if (cur.kind !== 'solid') return;
    const next: ActivePaint = { kind: 'solid', color: withAlpha01(toHex8(cur.color), alpha01) };
    if (which === 'fill') setFill(next); else setStroke(next);
  }, []);

  const swap = useCallback(() => {
    const f = fillRef.current;
    const s = strokeRef.current;
    setFill(s);
    setStroke(f);
  }, []);
  const swapFocus = useCallback(() => {
    setFocus((cur) => (cur === 'fill' ? 'stroke' : 'fill'));
  }, []);
  const toggleFocusedNone = useCallback(() => {
    const which = focusedRef.current;
    const cur = which === 'fill' ? fillRef.current : strokeRef.current;
    const next: ActivePaint = cur.kind === 'none'
      ? (which === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE)
      : { kind: 'none' };
    if (which === 'fill') setFill(next); else setStroke(next);
  }, []);
  const toggleFocusedTransparent = useCallback(() => {
    const which = focusedRef.current;
    const cur = which === 'fill' ? fillRef.current : strokeRef.current;
    const next: ActivePaint = cur.kind === 'transparent'
      ? (which === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE)
      : { kind: 'transparent' };
    if (which === 'fill') setFill(next); else setStroke(next);
  }, []);
  const reset = useCallback(() => {
    setFill(DEFAULT_FILL);
    setStroke(DEFAULT_STROKE);
  }, []);

  // Stubs filled in by Task 3 (kept here so the api shape is stable).
  const applyFillToSelection = useCallback((_color: string) => {}, []);
  const applyStrokeToSelection = useCallback((_color: string) => {}, []);
  const applyStrokeWidthToSelection = useCallback((_w: number) => {}, []);
  void opts.updateSelected;

  const api = useMemo<ActiveColorsApi>(() => ({
    fill, stroke, focused,
    setFill, setStroke, setFocused, setFocus,
    setFillColor, setStrokeColor, setFocusedColor,
    focusedAlpha, setFocusedAlpha,
    swap, swapFocus, toggleFocusedNone, toggleFocusedTransparent, reset,
    applyFillToSelection, applyStrokeToSelection, applyStrokeWidthToSelection,
  }), [
    fill, stroke, focused,
    setFocused, setFillColor, setStrokeColor, setFocusedColor,
    focusedAlpha, setFocusedAlpha,
    swap, swapFocus, toggleFocusedNone, toggleFocusedTransparent, reset,
    applyFillToSelection, applyStrokeToSelection, applyStrokeWidthToSelection,
  ]);

  return { api };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel && git add apps/swillustrator/src/tools/activeColors/useActiveColorsTool.ts apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts && git commit -m "feat(swill): scaffold useActiveColorsTool state cluster

Lifts the active-paint state body from useActiveColors.ts into the new
hook location; keybinding registration and scene-write methods land in
follow-up tasks."
```

---

## Task 3: Fill in the scene-write methods

**Files:**
- Modify: `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.ts`
- Modify: `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts`

- [ ] **Step 1: Extend the test**

Append to `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts`:

```ts
import type { Obj } from '../../poseUpdate';

describe('useActiveColorsTool — scene-write cluster', () => {
  it('applyFillToSelection routes through updateSelected with the "Set fill" label', () => {
    const calls: Array<{ patched: Partial<Obj>; label: string | undefined }> = [];
    const updateSelected = (patch: (o: Obj) => Obj, label?: string) => {
      const fake = { id: 'a', tool: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#ffffffff' } as unknown as Obj;
      calls.push({ patched: patch(fake), label });
    };
    const { result } = renderHook(() => useActiveColorsTool({ updateSelected }));
    act(() => result.current.api.applyFillToSelection('#ff0000ff'));
    expect(calls).toHaveLength(1);
    expect(calls[0].label).toBe('Set fill');
    expect((calls[0].patched as { fill?: string }).fill).toBe('#ff0000ff');
  });

  it('applyFillToSelection on a text obj writes into style.fill.color', () => {
    const calls: Array<Partial<Obj>> = [];
    const updateSelected = (patch: (o: Obj) => Obj) => {
      const fake = {
        id: 't', tool: 'text', x: 0, y: 0, width: 10, height: 10,
        style: { fill: { fill: 'solid' as const, color: '#000000ff' } },
      } as unknown as Obj;
      calls.push(patch(fake));
    };
    const { result } = renderHook(() => useActiveColorsTool({ updateSelected }));
    act(() => result.current.api.applyFillToSelection('#00ff00ff'));
    const next = calls[0] as { style?: { fill?: { color?: string } } };
    expect(next.style?.fill?.color).toBe('#00ff00ff');
  });

  it('applyStrokeWidthToSelection writes strokeWidth on non-text', () => {
    const calls: Array<Partial<Obj>> = [];
    const updateSelected = (patch: (o: Obj) => Obj) => {
      const fake = { id: 'a', tool: 'rect', strokeWidth: 1 } as unknown as Obj;
      calls.push(patch(fake));
    };
    const { result } = renderHook(() => useActiveColorsTool({ updateSelected }));
    act(() => result.current.api.applyStrokeWidthToSelection(5));
    expect((calls[0] as { strokeWidth?: number }).strokeWidth).toBe(5);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts
```

Expected: the three new tests fail (the stubs do nothing). The original four still pass.

- [ ] **Step 3: Implement the scene-write methods**

Replace the three stubbed `useCallback`s in `useActiveColorsTool.ts` with:

```ts
const applyFillToSelection = useCallback((color: string) => {
  const merge = (prev: string | undefined): string =>
    color.length === 9 ? color : mergeAlphaFromPrev(color, prev ?? '#ffffffff');
  opts.updateSelected((o) => {
    if (o.tool !== 'text') return { ...o, fill: merge(o.fill) };
    const prevFill = o.style?.fill;
    const prevColor = prevFill && prevFill.fill === 'solid' ? prevFill.color : undefined;
    const next = merge(prevColor);
    const nextFill = prevFill && prevFill.fill === 'solid'
      ? { ...prevFill, color: next }
      : { fill: 'solid' as const, color: next };
    return { ...o, style: { ...(o.style ?? {}), fill: nextFill } };
  }, 'Set fill');
}, [opts]);

const applyStrokeToSelection = useCallback((color: string) => {
  const merge = (prev: string | undefined): string =>
    color.length === 9 ? color : mergeAlphaFromPrev(color, prev ?? '#000000ff');
  opts.updateSelected(
    (o) => (o.tool !== 'text' ? { ...o, stroke: merge(o.stroke) } : o),
    'Set stroke',
  );
}, [opts]);

const applyStrokeWidthToSelection = useCallback((w: number) => {
  opts.updateSelected(
    (o) => (o.tool !== 'text' ? { ...o, strokeWidth: w } : o),
    'Set stroke width',
  );
}, [opts]);
```

Remove the `void opts.updateSelected;` line — it's no longer needed.

- [ ] **Step 4: Run — expect PASS**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel && git add apps/swillustrator/src/tools/activeColors/useActiveColorsTool.ts apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts && git commit -m "feat(swill): scene-write methods on ActiveColorsApi

apply{Fill,Stroke,StrokeWidth}ToSelection delegate through the caller-
supplied updateSelected, preserving text-obj style routing + alpha
round-trip + undo labels exactly as App.tsx did before."
```

---

## Task 4: Add the Tool with keyDown handlers

**Files:**
- Modify: `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.ts`
- Modify: `apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts`

- [ ] **Step 1: Add the tool test**

Append:

```ts
import { dispatchKeyDown } from '../../testUtils/dispatchKeyDown'; // helper added below

describe('useActiveColorsTool — Tool keybindings', () => {
  it("'d' resets fill and stroke", () => {
    const { result } = renderHook(() => useActiveColorsTool({ updateSelected: noopUpdateSelected }));
    act(() => result.current.api.setFillColor('#123456ff'));
    act(() => dispatchKeyDown(result.current.tool, { key: 'd' }));
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#ffffffff' });
  });

  it("'x' swaps fill and stroke", () => {
    const { result } = renderHook(() => useActiveColorsTool({ updateSelected: noopUpdateSelected }));
    act(() => {
      result.current.api.setFillColor('#aaaaaaff');
      result.current.api.setStrokeColor('#bbbbbbff');
    });
    act(() => dispatchKeyDown(result.current.tool, { key: 'x' }));
    expect(result.current.api.fill).toEqual({ kind: 'solid', color: '#bbbbbbff' });
  });

  it("'shift+x' swaps focused side", () => {
    const { result } = renderHook(() => useActiveColorsTool({ updateSelected: noopUpdateSelected }));
    expect(result.current.api.focused).toBe('fill');
    act(() => dispatchKeyDown(result.current.tool, { key: 'x', shift: true }));
    expect(result.current.api.focused).toBe('stroke');
  });

  it("'/' toggles focused-none", () => {
    const { result } = renderHook(() => useActiveColorsTool({ updateSelected: noopUpdateSelected }));
    act(() => dispatchKeyDown(result.current.tool, { key: '/' }));
    expect(result.current.api.fill).toEqual({ kind: 'none' });
  });
});
```

- [ ] **Step 2: Write the test-utility helper**

Write `apps/swillustrator/src/testUtils/dispatchKeyDown.ts` (create the `testUtils` directory if absent):

```ts
/**
 * Test helper: invoke a Tool's keyDown route for a given key + modifiers.
 * Bypasses the full dispatcher and only validates that the tool's own
 * channel maps the binding. Sufficient for unit tests asserting which
 * api method fires on which key.
 */
import type { AnyTool } from '@orochi235/weasel';

interface KeyEvent {
  key: string;
  shift?: boolean;
  meta?: boolean;
  alt?: boolean;
  ctrl?: boolean;
}

export function dispatchKeyDown(tool: AnyTool, ev: KeyEvent): void {
  const channel = (tool as unknown as {
    keyboard?: { onKeyDown?: (ctx: unknown) => unknown };
    def?: { initial?: { keyDown?: Record<string, (ctx: unknown) => unknown> } };
  });
  const handler = channel.def?.initial?.keyDown?.[ev.key];
  if (!handler) return;
  handler({
    modifiers: {
      shift: ev.shift ?? false,
      meta: ev.meta ?? false,
      alt: ev.alt ?? false,
      ctrl: ev.ctrl ?? false,
    },
  });
}
```

- [ ] **Step 3: Run — expect FAIL**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts
```

Expected: the four new tests fail — `result.current.tool` is undefined.

- [ ] **Step 4: Add the Tool to the hook**

In `useActiveColorsTool.ts`, add at the top of the file (with the other imports). `defineTool` and `claim` live on the `routing` subpath:

```ts
import { defineTool, claim } from '@orochi235/weasel/routing';
import type { Tool } from '@orochi235/weasel';
```

Inside the hook body, after `applyStrokeWidthToSelection`, build the tool:

```ts
// Refs so the keyDown closures see the latest api setters without
// re-creating the tool on every render.
const apiRef = useRef<ActiveColorsApi | null>(null);

const tool = useMemo<Tool<null>>(() => defineTool<null>({
  id: 'active-colors',
  presentation: {
    label: 'Active colors',
    group: 'view',
  },
  initial: {
    keyDown: {
      d: () => { apiRef.current?.reset(); return claim(); },
      x: (ctx: { modifiers: { shift: boolean } }) => {
        if (ctx.modifiers.shift) apiRef.current?.swapFocus();
        else apiRef.current?.swap();
        return claim();
      },
      '/': () => { apiRef.current?.toggleFocusedNone(); return claim(); },
    },
  },
}), []);
```

Change the `return` to:

```ts
apiRef.current = api;
return { tool, api };
```

Update the return-type annotation to:

```ts
export function useActiveColorsTool(opts: UseActiveColorsToolOptions): {
  tool: Tool<null>;
  api: ActiveColorsApi;
} {
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts
```

Expected: 11 passed.

- [ ] **Step 6: Commit**

```bash
cd /Users/mike/src/weasel && git add apps/swillustrator/src/tools/activeColors/useActiveColorsTool.ts apps/swillustrator/src/tools/activeColors/useActiveColorsTool.test.ts apps/swillustrator/src/testUtils/dispatchKeyDown.ts && git commit -m "feat(swill): register active-colors Tool with D/X/Shift-X/// keybindings

The Tool sits in the kit's ambient list and dispatches the four keys
through initial.keyDown. Replaces the free-floating useAction calls
that the old useActiveColors hook registered."
```

---

## Task 5: ActiveColorsContext + provider + consumer hook

**Files:**
- Create: `apps/swillustrator/src/tools/activeColors/ActiveColorsContext.tsx`
- Create: `apps/swillustrator/src/tools/activeColors/ActiveColorsContext.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ActiveColorsProvider, useActiveColors } from './ActiveColorsContext';
import type { ActiveColorsApi } from './useActiveColorsTool';

function Consumer() {
  const colors = useActiveColors();
  return <span data-testid="focus">{colors.focused}</span>;
}

const fakeApi = {
  fill: { kind: 'solid', color: '#ffffffff' },
  stroke: { kind: 'solid', color: '#000000ff' },
  focused: 'stroke' as const,
  // all method props no-op for the rendering test
  setFill: () => {}, setStroke: () => {}, setFocused: () => {}, setFocus: () => {},
  setFillColor: () => {}, setStrokeColor: () => {}, setFocusedColor: () => {},
  focusedAlpha: 1, setFocusedAlpha: () => {},
  swap: () => {}, swapFocus: () => {}, toggleFocusedNone: () => {},
  toggleFocusedTransparent: () => {}, reset: () => {},
  applyFillToSelection: () => {}, applyStrokeToSelection: () => {},
  applyStrokeWidthToSelection: () => {},
} satisfies ActiveColorsApi;

describe('ActiveColorsContext', () => {
  it('useActiveColors reads from the surrounding provider', () => {
    const { getByTestId } = render(
      <ActiveColorsProvider value={fakeApi}>
        <Consumer />
      </ActiveColorsProvider>,
    );
    expect(getByTestId('focus').textContent).toBe('stroke');
  });

  it('useActiveColors throws when called outside a provider', () => {
    const orig = console.error;
    console.error = () => {};
    expect(() => render(<Consumer />)).toThrow(/ActiveColorsProvider/);
    console.error = orig;
  });
});
```

- [ ] **Step 2: Run — expect FAIL (import resolution)**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/tools/activeColors/ActiveColorsContext.test.tsx
```

- [ ] **Step 3: Write the context**

`apps/swillustrator/src/tools/activeColors/ActiveColorsContext.tsx`:

```tsx
/**
 * React context publisher for `ActiveColorsApi`. Wrap the UI subtree
 * in `<ActiveColorsProvider value={api}>` once near the root; any
 * descendant that needs to read or mutate active paint calls
 * `useActiveColors()`. Throws when used outside a provider to surface
 * misconfiguration loudly rather than producing silent no-ops.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { ActiveColorsApi } from './useActiveColorsTool';

const ActiveColorsContext = createContext<ActiveColorsApi | null>(null);

export function ActiveColorsProvider(props: {
  value: ActiveColorsApi;
  children: ReactNode;
}) {
  return (
    <ActiveColorsContext.Provider value={props.value}>
      {props.children}
    </ActiveColorsContext.Provider>
  );
}

export function useActiveColors(): ActiveColorsApi {
  const v = useContext(ActiveColorsContext);
  if (!v) {
    throw new Error(
      'useActiveColors must be used inside <ActiveColorsProvider>',
    );
  }
  return v;
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd /Users/mike/src/weasel && npx vitest run apps/swillustrator/src/tools/activeColors/ActiveColorsContext.test.tsx
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel && git add apps/swillustrator/src/tools/activeColors/ActiveColorsContext.tsx apps/swillustrator/src/tools/activeColors/ActiveColorsContext.test.tsx && git commit -m "feat(swill): ActiveColorsProvider + useActiveColors context hook"
```

---

## Task 6: Wire `useActiveColorsTool` into App.tsx (state + tool registration)

**Files:**
- Modify: `apps/swillustrator/src/App.tsx`

This task swaps the hook call, registers the tool in the kit's ambient list, and wraps the JSX subtree in the provider. **It does not yet** delete the existing prop chain (Task 8) or the old `useAction` calls (those came from `useActiveColors.ts`, which still exists in this task). Leaving both in place during this task gives a working app to commit; the prop chain is dismantled in Tasks 7-8.

- [ ] **Step 1: Locate the existing `useActiveColors` call**

Find in App.tsx (currently around line 425):

```ts
const colors = useActiveColors({ ...optional initial state... });
```

- [ ] **Step 2: Replace the import**

Change:

```ts
import { useActiveColors } from './useActiveColors';
```

to:

```ts
import { useActiveColorsTool, ActiveColorsProvider } from './tools/activeColors';
```

- [ ] **Step 3: Replace the hook call**

```ts
const { tool: activeColorsTool, api: colors } = useActiveColorsTool({
  updateSelected,
});
```

Note: `updateSelected` is declared *after* this line in App.tsx today. Move the `useActiveColorsTool` call to *after* the `updateSelected` declaration (around line 1953). All references to `colors.*` that already exist further down continue to work.

- [ ] **Step 4: Add the tool to the tools array**

Locate the `tools` array passed to `<Canvas tools={tools} />`. Append `activeColorsTool` to it.

If the tools are split into active / ambient buckets (look for `useTools({ active, ambient, registry })` or similar), put `activeColorsTool` in the **ambient** bucket alongside `deleteTool`, `nudgeTool`, etc.

- [ ] **Step 5: Wrap the rendered tree in the provider**

In the App's JSX return, wrap the outermost layout (typically `<div className="swill-app">`) so every consumer can `useActiveColors()`:

```tsx
return (
  <ActiveColorsProvider value={colors}>
    <div className="swill-app">
      ...existing...
    </div>
  </ActiveColorsProvider>
);
```

- [ ] **Step 6: Type-check**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit
```

Expected: no new errors (pre-existing errors in App.tsx are acceptable; verify their count is unchanged).

- [ ] **Step 7: Run all swill tests**

```bash
cd /Users/mike/src/weasel && npm run test:swill
```

Expected: all green.

- [ ] **Step 8: Smoke test the dev server**

```bash
cd /Users/mike/src/weasel/apps/swillustrator && npm run dev
```

In a browser tab on the dev URL:
- Press `D` — fill should reset to white, stroke to black.
- Press `X` — fill and stroke swap colors.
- Press `Shift+X` — focused swatch toggles between fill and stroke (visually).
- Press `/` — focused swatch toggles to/from `none`.

If all four work, the new tool is live. Stop the dev server.

- [ ] **Step 9: Commit**

```bash
cd /Users/mike/src/weasel && git add apps/swillustrator/src/App.tsx && git commit -m "feat(swill): mount useActiveColorsTool + ActiveColorsProvider

Tool registers in the ambient list; provider wraps the app tree. The
old useActiveColors hook + its useAction registrations remain
co-mounted for this commit — Task 8's prop strip removes them."
```

---

## Task 7: Migrate `ActiveSwatches` to context

**Files:**
- Modify: `apps/swillustrator/src/ActiveSwatches.tsx`

- [ ] **Step 1: Read the current file**

Open `apps/swillustrator/src/ActiveSwatches.tsx`. Note the current `ActiveSwatchesProps` (6 active-color fields + `compact?`).

- [ ] **Step 2: Replace the props interface**

Change:

```ts
export interface ActiveSwatchesProps {
  fill: ActivePaint;
  stroke: ActivePaint;
  focused: 'fill' | 'stroke';
  onChangeFill: (next: ActivePaint) => void;
  onChangeStroke: (next: ActivePaint) => void;
  onFocus: (which: 'fill' | 'stroke') => void;
  compact?: boolean;
}
```

to:

```ts
export interface ActiveSwatchesProps {
  /** Render a smaller variant for use inside a properties panel row.
   *  Default false (full-size, suitable for the tool palette). */
  compact?: boolean;
}
```

- [ ] **Step 3: Add the context import**

Add at the top:

```ts
import { useActiveColors } from './tools/activeColors';
```

- [ ] **Step 4: Rewrite the component body to consume context**

Change the destructure at the top of `ActiveSwatches(p: ActiveSwatchesProps)`:

```ts
export function ActiveSwatches(p: ActiveSwatchesProps) {
  const colors = useActiveColors();
  const fillColor = colors.fill.kind === 'solid' ? toHex6(colors.fill.color) : '#ffffff';
  const strokeColor = colors.stroke.kind === 'solid' ? toHex6(colors.stroke.color) : '#000000';
  const fillPrev = colors.fill.kind === 'solid' ? colors.fill.color : '#ffffffff';
  const strokePrev = colors.stroke.kind === 'solid' ? colors.stroke.color : '#000000ff';
  ...
```

Throughout the body, replace:
- `p.fill` → `colors.fill`
- `p.stroke` → `colors.stroke`
- `p.focused` → `colors.focused`
- `p.onChangeFill(next)` → `colors.setFill(next)`
- `p.onChangeStroke(next)` → `colors.setStroke(next)`
- `p.onFocus(which)` → `colors.setFocus(which)`

Keep `p.compact` as-is — it's the only remaining prop.

- [ ] **Step 5: Update every `<ActiveSwatches ... />` call site**

Grep for usages:

```bash
cd /Users/mike/src/weasel && grep -rn "<ActiveSwatches" apps/swillustrator/src --include="*.tsx"
```

For each call site (typically in `App.tsx`, possibly in the Properties panel or Defaults panel), remove the six color-related props. Only `compact` (if present) should remain:

Before:
```tsx
<ActiveSwatches
  fill={p.activeFill}
  stroke={p.activeStroke}
  focused={p.focusedSwatch}
  onChangeFill={p.setActiveFill}
  onChangeStroke={p.setActiveStroke}
  onFocus={p.setFocusedSwatch}
  compact
/>
```

After:
```tsx
<ActiveSwatches compact />
```

- [ ] **Step 6: Type-check**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit
```

Expected: at most pre-existing errors; no new ones in ActiveSwatches.tsx.

- [ ] **Step 7: Run swill tests**

```bash
cd /Users/mike/src/weasel && npm run test:swill
```

Expected: all green.

- [ ] **Step 8: Smoke test**

```bash
cd /Users/mike/src/weasel/apps/swillustrator && npm run dev
```

In a browser tab: clicking either swatch focuses it, clicking again opens the OS color picker, shift-click toggles none. Stop the server.

- [ ] **Step 9: Commit**

```bash
cd /Users/mike/src/weasel && git add apps/swillustrator/src/ActiveSwatches.tsx apps/swillustrator/src/App.tsx && git commit -m "refactor(swill): ActiveSwatches reads from ActiveColorsProvider

Drops the six color-related props (now context-driven); keeps the
\`compact?\` flag. All call sites simplify accordingly."
```

---

## Task 8: Strip color props from `RightSidebar` and migrate its panels

**Files:**
- Modify: `apps/swillustrator/src/App.tsx`

`RightSidebar` currently takes ~17 props related to active paint + scene writes. They all collapse into context.

- [ ] **Step 1: Remove props from the `RightSidebarProps` interface**

In App.tsx, locate `interface RightSidebarProps` (around line 2585). Delete these members:

```ts
fillColor: string;
setFillColor: (s: string) => void;
strokeColor: string;
setStrokeColor: (s: string) => void;
strokeWidth: number;
setStrokeWidth: (n: number) => void;
activeFill: ActivePaint;
activeStroke: ActivePaint;
setActiveFill: (p: ActivePaint) => void;
setActiveStroke: (p: ActivePaint) => void;
focusedSwatch: 'fill' | 'stroke';
setFocusedSwatch: (which: 'fill' | 'stroke') => void;
applyFillToSelection: (color: string) => void;
applyStrokeToSelection: (color: string) => void;
applyStrokeWidthToSelection: (w: number) => void;
focusedAlpha: number;
setFocusedAlpha: (alpha01: number) => void;
```

- [ ] **Step 2: Remove the matching prop passes**

Find the JSX `<RightSidebar ...>` instantiation (around line 2470). Remove these prop passes:

```tsx
fillColor={fillColor}
setFillColor={setFillColor}
strokeColor={strokeColor}
setStrokeColor={setStrokeColor}
strokeWidth={strokeWidth}
setStrokeWidth={setStrokeWidth}
activeFill={activeFill}
activeStroke={activeStroke}
setActiveFill={setActiveFill}
setActiveStroke={setActiveStroke}
focusedSwatch={focusedSwatch}
setFocusedSwatch={setFocusedSwatch}
applyFillToSelection={applyFillToSelection}
applyStrokeToSelection={applyStrokeToSelection}
applyStrokeWidthToSelection={applyStrokeWidthToSelection}
focusedAlpha={colors.focusedAlpha}
setFocusedAlpha={colors.setFocusedAlpha}
```

- [ ] **Step 3: Have each panel inside RightSidebar consume context**

Inside the `RightSidebar` function body, add at the top:

```ts
const colors = useActiveColors();
```

(Add `useActiveColors` to the `./tools/activeColors` import already added in Task 6.)

Throughout `RightSidebar`'s JSX, replace prop references:

- `p.activeFill` → `colors.fill`
- `p.activeStroke` → `colors.stroke`
- `p.setActiveFill` → `colors.setFill`
- `p.setActiveStroke` → `colors.setStroke`
- `p.focusedSwatch` → `colors.focused`
- `p.setFocusedSwatch` → `colors.setFocus`
- `p.fillColor` → `colors.fill.kind === 'solid' ? colors.fill.color : '#ffffffff'`
- `p.strokeColor` → `colors.stroke.kind === 'solid' ? colors.stroke.color : '#000000ff'`
- `p.setFillColor` → `colors.setFillColor`
- `p.setStrokeColor` → `colors.setStrokeColor`
- `p.applyFillToSelection` → `colors.applyFillToSelection`
- `p.applyStrokeToSelection` → `colors.applyStrokeToSelection`
- `p.applyStrokeWidthToSelection` → `colors.applyStrokeWidthToSelection`
- `p.focusedAlpha` → `colors.focusedAlpha`
- `p.setFocusedAlpha` → `colors.setFocusedAlpha`

For `strokeWidth` / `setStrokeWidth`: these aren't on the api. They are tool-config state. Decide per-call-site whether they should reference the App-level `strokeWidth` state (still passed in via a remaining prop) or migrate elsewhere. **For this task, keep `strokeWidth` and `setStrokeWidth` as props** — they're orthogonal to active-colors.

- [ ] **Step 4: Delete the now-unused scene-write closures in App.tsx**

Delete the three closures:

```ts
const applyFillToSelection = (color: string): void => { ... };
const applyStrokeToSelection = (color: string): void => { ... };
const applyStrokeWidthToSelection = (w: number): void => { ... };
```

(They lived around lines 1991-2015 before this PR.)

- [ ] **Step 5: Statusbar references**

The status bar reads `fillColor` and `strokeColor` (around line 2528). Replace with:

```tsx
<span>fill: {colors.fill.kind === 'solid' ? colors.fill.color : colors.fill.kind}</span>
<span>stroke: {colors.stroke.kind === 'solid' ? colors.stroke.color : colors.stroke.kind}</span>
```

- [ ] **Step 6: Type-check**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit
```

Fix any remaining `p.activeFill`-style references the search/replace missed.

- [ ] **Step 7: Run swill tests + dev smoke**

```bash
cd /Users/mike/src/weasel && npm run test:swill
cd /Users/mike/src/weasel/apps/swillustrator && npm run dev
```

In the browser:
- Selection panel: change Fill / Stroke / Stroke Width — undo (Cmd+Z) restores prior values.
- Colors panel: clicking a swatch routes to focused fill or stroke; primary-mode applies to selection, defaults-mode sets active paint.
- Opacity slider in Selection panel still works (read alpha from focused side).

- [ ] **Step 8: Commit**

```bash
cd /Users/mike/src/weasel && git add apps/swillustrator/src/App.tsx && git commit -m "refactor(swill): RightSidebar reads active-paint state from context

Drops ~17 props that duplicated the api now reachable via
useActiveColors(). Status bar and scene-write closures also collapse."
```

---

## Task 9: Rewire `useEyedropperTool` through `api.setFocusedColor`

**Files:**
- Modify: `apps/swillustrator/src/App.tsx`

- [ ] **Step 1: Locate the eyedropper wiring**

Find `useEyedropperTool({` (around line 1221). Current `onPick`:

```ts
onPick: (color) => {
  if (color !== null) {
    if (focusedSwatch === 'fill') setActiveFill({ kind: 'solid', color });
    else setActiveStroke({ kind: 'solid', color });
  }
},
```

- [ ] **Step 2: Replace with the api method**

```ts
onPick: (color) => {
  if (color !== null) colors.setFocusedColor(color);
},
```

The `focusedSwatch === 'fill' ? ... : ...` branch is now encapsulated inside `setFocusedColor`.

- [ ] **Step 3: Verify any other tool that mutates active paint**

```bash
cd /Users/mike/src/weasel && grep -n "setActiveFill\|setActiveStroke\|setFocusedSwatch" apps/swillustrator/src/App.tsx
```

After Task 8 these references should all be gone *except* inside the `useEyedropperTool` call site you just edited. Confirm clean.

- [ ] **Step 4: Type-check + dev smoke**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit
cd /Users/mike/src/weasel/apps/swillustrator && npm run dev
```

In the browser: pick a node, press `I` (eyedropper), click a colored node — focused swatch absorbs that color. Alt+click does the same as a momentary hotkey.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/src/weasel && git add apps/swillustrator/src/App.tsx && git commit -m "refactor(swill): eyedropper writes through ActiveColorsApi.setFocusedColor"
```

---

## Task 10: Delete the old `useActiveColors.ts`

**Files:**
- Delete: `apps/swillustrator/src/useActiveColors.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
cd /Users/mike/src/weasel && grep -rn "from './useActiveColors'\|from '\\./useActiveColors'\|from '../../useActiveColors'" apps/swillustrator/src 2>/dev/null
```

Expected: no results.

- [ ] **Step 2: Delete the file**

```bash
rm /Users/mike/src/weasel/apps/swillustrator/src/useActiveColors.ts
```

- [ ] **Step 3: Type-check + test**

```bash
cd /Users/mike/src/weasel && npx tsc --noEmit && npm run test:swill
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/src/weasel && git add -A apps/swillustrator/src/useActiveColors.ts && git commit -m "chore(swill): delete legacy useActiveColors.ts

Replaced by apps/swillustrator/src/tools/activeColors/."
```

---

## Task 11: Release-gate + push

- [ ] **Step 1: Run the full prepublish gate (per repo memory)**

```bash
cd /Users/mike/src/weasel && npm run prepublishOnly
```

Expected: `tsc --noEmit` + `vitest run` + `tsup build` all pass. Address any failures by amending the relevant prior task's commit.

- [ ] **Step 2: Push**

```bash
cd /Users/mike/src/weasel && git push origin main
```

- [ ] **Step 3: Confirm push succeeded** — output should report the new commits landed on `origin/main`.

---

## Done check

After Task 11, verify against the spec:

- [ ] `useActiveColorsTool` exists; returns `{ tool, api }`; covers the full ActiveColorsApi.
- [ ] Tool is in the ambient list; D / X / Shift-X / `/` keybindings flow through `initial.keyDown` (no `useAction` calls left for these in the codebase).
- [ ] `<ActiveColorsProvider>` wraps the App tree; `useActiveColors()` is the consumer hook.
- [ ] `applyFillToSelection` / `applyStrokeToSelection` / `applyStrokeWidthToSelection` live on the api; the App-level closures are gone.
- [ ] `ActiveSwatches` takes only `compact?`.
- [ ] `RightSidebarProps` is ~17 members shorter; no `activeFill / setActiveFill / fillColor / setFillColor / …` left.
- [ ] Eyedropper pick routes through `api.setFocusedColor`.
- [ ] `useActiveColors.ts` deleted.
- [ ] `npm run test:swill` and `npm run prepublishOnly` both pass.
