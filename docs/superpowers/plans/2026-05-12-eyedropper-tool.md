# Eyedropper tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `useEyedropperTool` — a kit-native, declarative tool that calls `onPick(color)` when the user clicks a scene node, looked up via consumer-supplied `colorOf(id)`. Engages either as a sticky palette tool (`I`) or as a momentary hotkey-slot tool while `Alt` is held. Wire it into Swillustrator's fill/stroke swatches as the forcing demo.

**Architecture:** Declarative `defineTool<null>` from `src/tools/routing`. Click route table maps every node kind (`rect`, `text`, `path`, `*`) to a single `pickFromNode` action that reads `ctx.target.id`, calls `colorOf`, and forwards to `onPick`. Empty-click is `none()`. Latest-callback refs hold `onPick` / `colorOf` so the memoized tool body doesn't rebuild on every re-render. The tool declares both `keybinding: { key: 'I' }` and `hotkey: 'alt'`; consumers can override either to `null`.

**Tech Stack:** TypeScript, React, weasel kit declarative routing (`defineTool`), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-12-eyedropper-tool-design.md`.

---

## File map

- New: `src/tools/builtin/useEyedropperTool.ts`
- New: `src/tools/builtin/useEyedropperTool.test.ts`
- New: `src/icons/EyedropperIcon.tsx`
- Modify: `src/icons/index.ts` — export `EyedropperIcon`.
- Modify: `src/tools/builtin/index.ts` — export `useEyedropperTool`, `UseEyedropperToolOptions`.
- Modify: `apps/swillustrator/src/App.tsx` — wire into the tool registry.
- Modify: `docs/TODO.md` — strike the eyedropper-stub deferral, if present.

---

## Task 1: Confirm spec is committed

**Files:**
- Read-only: `docs/superpowers/specs/2026-05-12-eyedropper-tool-design.md`

- [ ] **Step 1.1: Verify the spec exists and is on disk**

```
ls /Users/mike/src/weasel/docs/superpowers/specs/2026-05-12-eyedropper-tool-design.md
```

Expected: file exists, non-zero size. If missing, write it from the design doc accompanying this plan before proceeding.

- [ ] **Step 1.2: Re-read the spec's "Design decisions" section**

These are the five locked-in answers driving every later step:

1. **Samples scene node color** via consumer `colorOf(id)`. Not pixel-mode.
2. **Writes to consumer callback** `onPick(color)`. Not an op.
3. **Dual-slot:** `keybinding: { key: 'I' }` + `hotkey: 'alt'`, both overridable to `null`.
4. **Cursor:** `'crosshair'`.
5. **Gesture:** click only. No drag binding.

Any divergence from these in implementation requires updating the spec first.

---

## Task 2: `EyedropperIcon` asset

**Files:**
- New: `src/icons/EyedropperIcon.tsx`
- Modify: `src/icons/index.ts`

- [ ] **Step 2.1: Read an existing icon for the shape conventions**

```
cat /Users/mike/src/weasel/src/icons/HandIcon.tsx
```

Note the props signature (`IconProps`), the `_base` import / sizing pattern, the `displayName`, and the export style (`export default`).

- [ ] **Step 2.2: Create `src/icons/EyedropperIcon.tsx`**

Draw a small dropper outline at viewBox `0 0 16 16`: a diagonal stem from upper-right to lower-left with a bulb at one end. Match the stroke / fill conventions used by the other icons (single-color stroke, no fill, `currentColor`). Mirror the `IconProps` signature and `displayName` from `HandIcon.tsx`. Keep total path length short — this is an outline icon.

- [ ] **Step 2.3: Export from `src/icons/index.ts`**

Add the line:

```ts
export { default as EyedropperIcon } from './EyedropperIcon';
```

Place it alphabetically next to `HandIcon` (between `EllipseIcon` and `HandIcon` is a reasonable spot — check the existing ordering first).

- [ ] **Step 2.4: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

---

## Task 3: Hook + tests (TDD)

**Files:**
- New: `src/tools/builtin/useEyedropperTool.ts`
- New: `src/tools/builtin/useEyedropperTool.test.ts`

- [ ] **Step 3.1: Read references**

```
cat /Users/mike/src/weasel/src/tools/builtin/useDeleteTool.ts
cat /Users/mike/src/weasel/src/tools/builtin/useHandTool.test.ts | head -60
```

- `useDeleteTool` is the closest shape: a tiny `defineTool` with a single-channel route table and no scratch. Mirror its `useMemo` + `defineTool` skeleton.
- `useHandTool.test.ts` shows the test harness: `renderHook` for the hook itself, `makeCtx` for a synthetic `ToolCtx`, and direct invocation of the returned tool's channel handlers. The dispatcher is not involved — these are unit tests against the `Tool` record's pointer / drag handlers.

- [ ] **Step 3.2: Write the failing tests at `src/tools/builtin/useEyedropperTool.test.ts`**

Mirror the harness from `useHandTool.test.ts` (the `makeCtx` helper + `renderHook`). Build a small `makeCtxWithTarget(target: HitResult)` helper that returns a `ToolCtx<null>` with `scratch: null` and a settable `target`.

Test list (each is a single `it(...)` block):

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEyedropperTool } from './useEyedropperTool';
import type { HitResult } from '../routing/hitResult';
import type { ToolCtx } from '../types';

function makeCtx(target: HitResult): ToolCtx<null> {
  return {
    worldX: 0, worldY: 0,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    target,
    selection: {} as never,
    adapter: null,
    applyOps: vi.fn(),
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    canvasRect: new DOMRect(),
    scratch: null,
  };
}

const nodeHit = (id = 'r1', kind = 'rect'): HitResult => ({
  category: 'node', kind, id: id as never, pose: {}, data: {},
});
const emptyHit = (): HitResult => ({ category: 'empty', kind: 'empty' });

describe('useEyedropperTool', () => {
  it('declares id, I keybinding, alt hotkey, crosshair cursor', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null }),
    );
    expect(result.current.id).toBe('eyedropper');
    expect(result.current.keybinding).toEqual({ key: 'I' });
    expect(result.current.hotkey).toBe('alt');
    // cursor is a resolver function from defineTool; call it with a minimal ctx.
    const cursor = typeof result.current.cursor === 'function'
      ? result.current.cursor(makeCtx(emptyHit()))
      : result.current.cursor;
    expect(cursor).toBe('crosshair');
  });

  it('click on a rect hit calls onPick with colorOf(id)', () => {
    const onPick = vi.fn();
    const colorOf = vi.fn((id: string) => id === 'r1' ? '#ff0000' : null);
    const { result } = renderHook(() => useEyedropperTool({ onPick, colorOf }));
    const ctx = makeCtx(nodeHit('r1', 'rect'));
    const decision = result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(decision).toBe('claim');
    expect(colorOf).toHaveBeenCalledWith('r1');
    expect(onPick).toHaveBeenCalledWith('#ff0000');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('click on a text hit routes through the same action', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#123456' }),
    );
    const ctx = makeCtx(nodeHit('t1', 'text'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).toHaveBeenCalledWith('#123456');
  });

  it('click on a path hit routes through the same action', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#abcdef' }),
    );
    const ctx = makeCtx(nodeHit('p1', 'path'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).toHaveBeenCalledWith('#abcdef');
  });

  it('click on an unknown node kind falls through to the * route', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#000' }),
    );
    const ctx = makeCtx(nodeHit('x1', 'sprite'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).toHaveBeenCalledWith('#000');
  });

  it('colorOf returning null forwards null to onPick', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => null }),
    );
    const ctx = makeCtx(nodeHit('r1', 'rect'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('click on empty does NOT call onPick', () => {
    const onPick = vi.fn();
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick, colorOf: () => '#fff' }),
    );
    const ctx = makeCtx(emptyHit());
    const decision = result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick).not.toHaveBeenCalled();
    // none() resolves to a 'pass' decision in the routing factory.
    expect(decision).toBe('pass');
  });

  it('drag channel is unbound (no onStart)', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null }),
    );
    // defineTool only attaches drag handlers when at least one drag route exists.
    // No drag routes here → tool.drag is undefined.
    expect(result.current.drag).toBeUndefined();
  });

  it('hotkey: null override removes the hotkey trigger', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null, hotkey: null }),
    );
    expect(result.current.hotkey).toBeUndefined();
  });

  it('keybinding: null override removes the keybinding', () => {
    const { result } = renderHook(() =>
      useEyedropperTool({ onPick: () => {}, colorOf: () => null, keybinding: null }),
    );
    expect(result.current.keybinding).toBeUndefined();
  });

  it('uses the latest onPick / colorOf via refs (no stale closure)', () => {
    const onPick1 = vi.fn();
    const onPick2 = vi.fn();
    const colorOf1 = () => '#111';
    const colorOf2 = () => '#222';
    const { result, rerender } = renderHook(
      ({ onPick, colorOf }) => useEyedropperTool({ onPick, colorOf }),
      { initialProps: { onPick: onPick1, colorOf: colorOf1 } },
    );
    rerender({ onPick: onPick2, colorOf: colorOf2 });
    const ctx = makeCtx(nodeHit('r1', 'rect'));
    result.current.pointer!.onClick!(new Event('click') as PointerEvent, ctx);
    expect(onPick1).not.toHaveBeenCalled();
    expect(onPick2).toHaveBeenCalledWith('#222');
  });
});
```

- [ ] **Step 3.3: Run failing tests**

```
npx vitest run src/tools/builtin/useEyedropperTool.test.ts
```

Expected: every test fails with "Cannot find module './useEyedropperTool'" (file doesn't exist yet).

- [ ] **Step 3.4: Implement `src/tools/builtin/useEyedropperTool.ts`**

```ts
import { useMemo, useRef, createElement } from 'react';
import { defineTool, claim, none } from '../routing';
import type { ActionFn } from '../routing';
import type { Tool, HotkeyTrigger } from '../types';
import type { KeyBinding } from 'interactions/actions/useKeybinding';
import { EyedropperIcon } from '../../icons';

export interface UseEyedropperToolOptions {
  /** Called when the user picks a color. `null` means "no node was hit
   *  with a color" — currently only reachable when `colorOf` returns null
   *  on a real hit; empty-click is a no-op in v1. */
  onPick: (color: string | null) => void;

  /** Map a node id to a color string, or `null` if the node has no color
   *  to sample. Called on click with `ctx.target.id`. */
  colorOf: (id: string) => string | null;

  /** Override the default `{ key: 'I' }` keybinding. Pass `null` to omit
   *  the keybinding entirely (palette-only or hotkey-only wiring). */
  keybinding?: KeyBinding | null;

  /** Override the default `'alt'` hotkey trigger. Pass `null` to omit. */
  hotkey?: HotkeyTrigger | null;
}

/**
 * Eyedropper. Click a node to sample its color; the consumer's `onPick`
 * callback decides where the color goes. Engages as a sticky active-slot
 * tool (`I` keybinding) and as a momentary hotkey-slot tool while Alt
 * is held — consumers can override either trigger to `null`.
 *
 * Pure-read tool — does NOT mutate the scene. v1 is click-only; drag is
 * unbound (a future drag-to-sample option is additive).
 */
export function useEyedropperTool(opts: UseEyedropperToolOptions): Tool<null> {
  const onPickRef = useRef(opts.onPick);
  onPickRef.current = opts.onPick;
  const colorOfRef = useRef(opts.colorOf);
  colorOfRef.current = opts.colorOf;

  return useMemo(() => {
    const pickFromNode: ActionFn<null> = (ctx) => {
      if (ctx.target?.category !== 'node') return none();
      const color = colorOfRef.current(ctx.target.id);
      onPickRef.current(color);
      return claim();
    };

    const onEmptyClick: ActionFn<null> = () => none();

    // Resolve overrides. The spec says `null` => omit; defineTool reads
    // these directly into the returned Tool, and the registry treats
    // `undefined` as "no trigger." Convert null → undefined here.
    const keybinding =
      opts.keybinding === null ? undefined : (opts.keybinding ?? { key: 'I' });
    const hotkey =
      opts.hotkey === null ? undefined : (opts.hotkey ?? 'alt');

    return defineTool<null>({
      id: 'eyedropper',
      keybinding,
      hotkey,
      cursor: 'crosshair',
      presentation: {
        label: 'Eyedropper',
        icon: createElement(EyedropperIcon),
        group: 'view',
      },
      initial: {
        click: {
          rect:  pickFromNode,
          text:  pickFromNode,
          path:  pickFromNode,
          '*':   pickFromNode,
          empty: onEmptyClick,
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.keybinding, opts.hotkey]);
}
```

Notes:
- `keybinding` / `hotkey` are the only deps in the memo array. `onPick` / `colorOf` are held through refs so re-renders don't rebuild the Tool record. This matches `useRectTool`'s `createRef` pattern.
- `useMemo` deps deliberately exclude `opts.onPick` and `opts.colorOf` — the eslint disable is intentional and is the same accommodation `useRectTool.ts` and `useSelectTool.ts` make.

- [ ] **Step 3.5: Run tests until green**

```
npx vitest run src/tools/builtin/useEyedropperTool.test.ts
```

Expected: all 11 tests pass. If "click on empty" returns `'claim'` instead of `'pass'`, double-check that `none()` resolves to a `'pass'` decision in `applyResult` (it does — see `defineTool.ts` lines 109 / `case 'none'`).

If the test "uses the latest onPick / colorOf via refs" fails because the memo isn't rebuilding when those change, that's fine — the refs are the load-bearing piece, not the memo. The test exercises ref behavior, not memo behavior.

- [ ] **Step 3.6: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

---

## Task 4: Kit barrel export

**Files:**
- Modify: `src/tools/builtin/index.ts`

- [ ] **Step 4.1: Add the export**

Append:

```ts
export {
  useEyedropperTool,
  type UseEyedropperToolOptions,
} from './useEyedropperTool';
```

Place it alphabetically near `useHandTool` (e.g. after the `useEllipseTool` line and before `useLineTool`, mirroring the existing ordering).

- [ ] **Step 4.2: Verify it surfaces from the package barrel**

```
grep -n "useEyedropperTool" /Users/mike/src/weasel/src/index.ts /Users/mike/src/weasel/src/tools/builtin/index.ts
```

Expected: one hit in `tools/builtin/index.ts`. If `src/index.ts` re-exports from `tools/builtin/*` via a wildcard, no further change is needed; if it lists tools by name, append `useEyedropperTool` there too.

- [ ] **Step 4.3: Build check**

```
npx tsc --noEmit && npx vitest run src/tools/builtin/useEyedropperTool.test.ts
```

Expected: both clean.

---

## Task 5: Swillustrator integration

**Files:**
- Modify: `apps/swillustrator/src/App.tsx`

- [ ] **Step 5.1: Read current tool wiring**

```
grep -n "useHandTool\|useTools\|registry:" /Users/mike/src/weasel/apps/swillustrator/src/App.tsx
```

Identify (a) where the existing tools are constructed (`const hand = useHandTool();` around line 743), and (b) the `useTools({ active, registry, ambient })` call (around line 934).

- [ ] **Step 5.2: Add the eyedropper hook above the `useTools` call**

After `const hand = useHandTool();` (line 743 area), add:

```tsx
// Eyedropper — clicks any shape, writes the sampled color into whichever
// swatch is currently focused. Alt-hold engages it momentarily on top
// of any active tool; pressing `I` makes it the active tool until
// switched away. Alt-drag still routes to clone (clone claims at
// drag.onStart, eyedropper at pointer.click — they don't collide).
const eyedropper = useEyedropperTool({
  colorOf: (id) => {
    const obj = itemsRef.current.find((o) => o.id === id);
    if (!obj) return null;
    if (obj.kind === 'rect' || obj.kind === 'path') {
      return obj.fill || obj.stroke || null;
    }
    if (obj.kind === 'text') {
      const f = obj.style?.fill;
      return f && f.fill === 'solid' ? f.color : null;
    }
    return null;
  },
  onPick: (color) => {
    if (color == null) return;
    if (focusedSwatchRef.current === 'fill') {
      setActiveFill({ kind: 'solid', color });
    } else {
      setActiveStroke({ kind: 'solid', color });
    }
  },
});
```

If the `obj.style?.fill` access doesn't typecheck (the `TextObj` style shape may not match exactly), check the actual TextObj definition in App.tsx (search for `interface TextObj`) and adjust the field path. The intent is "if it's a solid-color text fill, return the color string; otherwise null."

- [ ] **Step 5.3: Add to the tools registry**

Update the `useTools(...)` call (around line 934). Change:

```tsx
const tools = useTools({
  active: 'select',
  registry: { select, lasso, insert, ellipse, line, polygon, star, pen, pencil, hand, text },
  ambient: [wheelZoom, wheelPan, keyZoom, clone],
});
```

to:

```tsx
const tools = useTools({
  active: 'select',
  registry: { select, lasso, insert, ellipse, line, polygon, star, pen, pencil, hand, text, eyedropper },
  ambient: [wheelZoom, wheelPan, keyZoom, clone],
});
```

- [ ] **Step 5.4: Add the import**

Add `useEyedropperTool` to the import from the kit's tools barrel near the other `useXxxTool` imports at the top of `App.tsx`. Match the existing import shape (named import from the kit package alias).

- [ ] **Step 5.5: Typecheck the app**

```
cd /Users/mike/src/weasel && npx tsc --noEmit
```

Expected: clean. If there's a `tsconfig` per app, also:

```
cd /Users/mike/src/weasel/apps/swillustrator && npx tsc --noEmit
```

- [ ] **Step 5.6: Smoke-test in the dev server**

```
cd /Users/mike/src/weasel && npm run dev
```

Open the Swillustrator dev URL. Draw two rects of distinguishable colors (e.g. red and blue) using the rect tool. Then:

1. Click the **fill** swatch in the sidebar to focus it.
2. Press `I`. Cursor becomes a crosshair.
3. Click the red rect → fill swatch turns red. The active-fill display in the sidebar updates.
4. Press `V` to switch back to select.
5. Hold `Alt`. Cursor becomes a crosshair (eyedropper engaged via hotkey).
6. Click the blue rect → fill swatch turns blue.
7. Release `Alt`. Cursor returns to select.
8. With `Alt` held, drag from the blue rect → it clones (clone tool still wins on drag). Release `Alt` before/after drag finishes — clone completes normally.
9. Focus the **stroke** swatch (click it). Press `I`. Click a rect → stroke swatch updates instead of fill.

All nine steps should work without console errors.

---

## Task 6: Strike the deferral note

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 6.1: Search for an eyedropper TODO entry**

```
grep -n -i "eyedropper" /Users/mike/src/weasel/docs/TODO.md
```

If a line exists (e.g. "eyedropper-stub" deferred from Phase 2a), mark it shipped with a strikethrough or move it under a "Shipped" section, matching the file's existing conventions. If no entry exists, skip this task.

---

## Task 7: Full prepublish gate

**Files:**
- No code changes; verification only.

- [ ] **Step 7.1: Run the release-equivalent gate**

```
cd /Users/mike/src/weasel && npm run prepublishOnly
```

This runs `tsc --noEmit && vitest run && tsup build` (matches CI's release gate). Expected: all green. If `vitest run` alone passed in earlier tasks but `prepublishOnly` fails on typecheck, fix the typecheck error in `useEyedropperTool.ts` or the App.tsx wiring — don't ship a tool that passes tests but breaks the build.

- [ ] **Step 7.2: Confirm test count delta**

```
npx vitest run src/tools/builtin/useEyedropperTool.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: 11 tests pass (matching Task 3.2's `it(...)` count).

---

## Done criteria

- All seven tasks above complete and checked off.
- `npm run prepublishOnly` clean.
- New file `src/tools/builtin/useEyedropperTool.ts` exists and exports `useEyedropperTool` + `UseEyedropperToolOptions`.
- 11 new tests in `useEyedropperTool.test.ts`, all green.
- New icon `EyedropperIcon` exported from `src/icons/index.ts`.
- Swillustrator dev-server smoke test passes the nine steps in Task 5.6.

## Follow-ups (out of scope; record only)

- Pixel-mode sampling (`getImageData`) — additive option on `useEyedropperTool`, or a parallel hook `useEyedropperFromPixelsTool`.
- Drag-to-sample with live preview — adds `drag` route + `onPreview` callback. Spec's existing `onPick` signature is unchanged.
- Rich cursor with swatch chip — depends on drag-preview being in place.
- `clickEmptyToClear?: boolean` option — flip the `none()` on empty-click into `onPick(null)`.
- Kit demo card (`demo/demos/EyedropperDemo.tsx`) — small standalone demo showing the alt-hotkey path. Skip unless the demo lattice gains a dedicated slot.
