# Tool overlay channel implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Canvas's typed-per-gesture overlay machinery with a single overlay channel published by Tools — `Tool.overlay?: RenderLayer<unknown>`, enumerated by `tools.getActiveOverlays()`, appended to the layer pipeline by Canvas.

**Architecture:** Tools own their gesture rendering. Canvas hosts whatever the active+modifier+alwaysOn tools publish. Removes Canvas's closed list of overlay kinds (`insert`/`areaSelect`/`move`/`resize`/`rotate` props, `insertOverlay`/`areaSelectOverlay` slot configs, `buildInsertOverlayLayer` / `buildAreaSelectOverlayLayer`, the `move?.overlay?.poses.get(id)` pose-resolution closures). Move/resize/rotate ghosts render via the tool's overlay; scene draws committed state only. Theming migrates from slot config to tool option (`useInsertTool({ overlayStyle: {...} })`). Wide blast radius — ~25 files. Atomic commits per Tool wrapper + its tests.

**Tech Stack:** TypeScript, React, Vitest. No new dependencies.

**Predecessor specs:**
- `docs/specs/2026-05-03-tool-overlay-channel-design.md` (this plan implements)
- `docs/specs/2026-05-03-tool-primitive-design.md` (Tool primitive baseline)
- `docs/specs/2026-05-03-tool-primitive-phase-2c-design.md` (view-aware rendering)

---

## Pre-flight context for implementer subagents

Each task below dispatches a fresh subagent. The subagent should be told:

- The repo is `/Users/mike/src/weasel`. Work on `main` directly (project policy: breaking changes are free; `worktrees` not required for this plan since the spec calls for atomic per-task commits and the tasks are sequential).
- TDD discipline: write failing test → implement → tests pass → commit. One task per commit (or two if test/impl naturally split).
- The kit-wide `RenderLayer<TData>` type is defined in `src/core/layers/render.ts`; the `Tool<TScratch>` type lives in `src/tools/types.ts`.
- `Tool` records are typically returned from `useMemo` so their identity is stable across renders. Adding an `overlay` field needs to land inside the same `useMemo`.
- The pen tool (`useUserPenTool`) uses a `useReducer`-based force-render after every scratch mutation to trigger a Canvas repaint. Other Tool wrappers added in this plan that mutate scratch outside React state need the same pattern, OR they can rely on the gesture-controller's existing `useState` overlay (which is what `useInsert`, `useAreaSelect`, etc. already use — those mutate React state per move event, so the host re-renders naturally).
- After every task: `npm test -- --run` (must pass) and `npx tsc --noEmit` (must be clean).

---

## File structure

**Modify:**
- `src/tools/types.ts` — add `overlay?: RenderLayer<unknown>` to `Tool<TScratch>`.
- `src/tools/defineTool.ts` — no logic change; `defineTool` already passes through, but a defining-fixture test needs to assert the field round-trips.
- `src/tools/useTools.ts` — add `getActiveOverlays(): RenderLayer<unknown>[]` to `ToolsApi`.
- `src/tools/builtin/useInsertTool.ts` — accept `overlayStyle`, attach a `RenderLayer` reading `ctl.overlay`.
- `src/tools/builtin/useSelectTool.ts` — accept four per-mode `*OverlayStyle` options, attach a single `RenderLayer` that branches on the engaged sub-controller's overlay.
- `src/canvas/Canvas.tsx`:
  - Remove `insert`, `areaSelect`, `move`, `resize`, `rotate` props (and their `*Override` variables).
  - Remove `insertOverlay` / `areaSelectOverlay` slot configs from `LayersMap` and `STANDARD_SLOTS`.
  - Delete `buildInsertOverlayLayer` and `buildAreaSelectOverlayLayer`.
  - Replace `move?.overlay?.poses.get(id)` etc. in pose-resolution closures: scene draws committed state only.
  - In the `layers` useMemo, append `tools.getActiveOverlays()` after all standard-slot resolution.
- `src/index.ts` — drop `InsertOverlaySlotConfig`, `AreaSelectOverlaySlotConfig` from re-exports.
- `demo/demos/SwillustratorDemo.tsx` — remove `insertOverlay: {}` slot.
- `demo/demos/InsertDemo.tsx` — migrate from `tool="insert"` to `useInsertTool` + `useTools`.
- `demo/demos/ComposeDemo.tsx` — migrate from `tool={tool}` switch to `useSelectTool` + `useInsertTool` + `useTools`.
- `demo/demos/NestingDemo.tsx` — migrate from `move={move}` prop to a wrapping Tool (custom `useMoveTool` defined inline, or migrate to `useSelectTool`'s move sub-controller).

**Tests (add or modify):**
- `src/tools/defineTool.test.ts` — `overlay` round-trips.
- `src/tools/useTools.test.tsx` — `getActiveOverlays()` enumeration + ordering + filtering.
- `src/tools/builtin/useInsertTool.test.ts` — overlay layer renders when scratch has overlay state; respects `overlayStyle`; renders nothing when no gesture in flight.
- `src/tools/builtin/useSelectTool.test.ts` — overlay branches by sub-controller (area / move / resize / rotate).
- `src/canvas/Canvas.test.tsx` — replace `insert={ctl}` / `areaSelect={ctl}` integration tests with Tool-primitive equivalents; verify `getActiveOverlays()` output lands at the top of the layer pipeline.
- `demo/demos/swillustratorDemo.integration.test.tsx` — extend to assert insert-rect overlay rect appears mid-drag; area-select marquee appears mid-drag.

**Out of scope (deferred — already in spec):**
- Per-overlay z-positioning (`overlayPosition` field).
- Multiple overlays per Tool.
- Subscription / push model.
- Cursor migration (already through Tool primitive).

---

## Task 1: Add `overlay` field to `Tool<TScratch>`

**Files:**
- Modify: `src/tools/types.ts`
- Modify: `src/tools/defineTool.ts` (none — pass-through; just verify identity helper doesn't strip the field)
- Modify: `src/tools/defineTool.test.ts`

- [ ] **Step 1: Write failing test** — add to `src/tools/defineTool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defineTool } from './defineTool';
import type { RenderLayer } from '../core/layers/render';

describe('defineTool overlay field', () => {
  it('round-trips an overlay RenderLayer', () => {
    const layer: RenderLayer<unknown> = {
      id: 'overlay-x',
      label: 'Overlay X',
      space: 'screen',
      draw: () => {},
    };
    const tool = defineTool({ id: 't', overlay: layer });
    expect(tool.overlay).toBe(layer);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tools/defineTool.test.ts`
Expected: FAIL — `Tool<TScratch>` doesn't have `overlay`.

- [ ] **Step 3: Add field to `Tool<TScratch>`**

In `src/tools/types.ts`, after the `cursor` field on the `Tool` interface:

```ts
  /** Optional overlay layer rendered on top of the scene/chrome whenever
   *  this tool is in any active slot (active, modifier, or alwaysOn).
   *  The layer's `draw` function reads from this tool's scratch via React
   *  closure (re-evaluated each render). Return early from `draw` to render
   *  nothing — typically gated on a scratch field like
   *  `if (!scratch.overlay) return`. */
  overlay?: RenderLayer<unknown>;
```

Add the import at the top of the file:

```ts
import type { RenderLayer } from '../core/layers/render';
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --run src/tools/defineTool.test.ts && npx tsc --noEmit`
Expected: PASS, TS clean.

- [ ] **Step 5: Commit**

```bash
git add src/tools/types.ts src/tools/defineTool.test.ts
git commit -m "feat(tools): add Tool.overlay field for tool-published RenderLayer"
```

---

## Task 2: Add `getActiveOverlays()` to `ToolsApi`

**Files:**
- Modify: `src/tools/useTools.ts`
- Modify: `src/tools/useTools.test.tsx`

- [ ] **Step 1: Write failing tests** — add to `src/tools/useTools.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTools } from './useTools';
import { defineTool } from './defineTool';
import type { RenderLayer } from '../core/layers/render';

const mkLayer = (id: string): RenderLayer<unknown> => ({
  id, label: id, space: 'screen', draw: () => {},
});

describe('ToolsApi.getActiveOverlays', () => {
  it('returns overlay from active tool', () => {
    const a = defineTool({ id: 'a', overlay: mkLayer('a-ov') });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a } }));
    const out = result.current.getActiveOverlays();
    expect(out.map((l) => l.id)).toEqual(['a-ov']);
  });

  it('filters out tools with no overlay', () => {
    const a = defineTool({ id: 'a' });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a } }));
    expect(result.current.getActiveOverlays()).toEqual([]);
  });

  it('orders active, modifier, alwaysOn (in registration order)', () => {
    const a = defineTool({ id: 'a', overlay: mkLayer('a-ov') });
    const m = defineTool({ id: 'm', modifier: 'space', overlay: mkLayer('m-ov') });
    const w1 = defineTool({ id: 'w1', overlay: mkLayer('w1-ov') });
    const w2 = defineTool({ id: 'w2', overlay: mkLayer('w2-ov') });
    const { result, rerender } = renderHook(() =>
      useTools({ active: 'a', registry: { a, m }, alwaysOn: [w1, w2] }),
    );
    result.current.engageModifier('m');
    rerender();
    expect(result.current.getActiveOverlays().map((l) => l.id))
      .toEqual(['a-ov', 'm-ov', 'w1-ov', 'w2-ov']);
  });

  it('omits modifier overlay when not engaged', () => {
    const a = defineTool({ id: 'a', overlay: mkLayer('a-ov') });
    const m = defineTool({ id: 'm', modifier: 'space', overlay: mkLayer('m-ov') });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a, m } }));
    expect(result.current.getActiveOverlays().map((l) => l.id)).toEqual(['a-ov']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tools/useTools.test.tsx`
Expected: FAIL — `getActiveOverlays` doesn't exist.

- [ ] **Step 3: Implement `getActiveOverlays`**

In `src/tools/useTools.ts`:

1. Add to `ToolsApi`:

```ts
  /** All overlay layers from currently-engaged tools (active slot, modifier
   *  slot if engaged, all alwaysOn slot tools). Filters out tools with no
   *  `overlay` field. Order: active, then modifier (if engaged), then
   *  alwaysOn (registration order). */
  getActiveOverlays(): RenderLayer<unknown>[];
```

2. Import `RenderLayer`:

```ts
import type { RenderLayer } from '../core/layers/render';
```

3. Inside the returned object (after `has`):

```ts
    getActiveOverlays(): RenderLayer<unknown>[] {
      const out: RenderLayer<unknown>[] = [];
      const activeTool = registryRef.current[activeRef.current];
      if (activeTool?.overlay) out.push(activeTool.overlay);
      const mod = modifierRef.current ? registryRef.current[modifierRef.current] : null;
      if (mod?.overlay) out.push(mod.overlay);
      for (const t of alwaysOnRef.current) {
        if (t.overlay) out.push(t.overlay);
      }
      return out;
    },
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --run src/tools/useTools.test.tsx && npx tsc --noEmit`
Expected: PASS, TS clean.

- [ ] **Step 5: Commit**

```bash
git add src/tools/useTools.ts src/tools/useTools.test.tsx
git commit -m "feat(tools): add ToolsApi.getActiveOverlays for the overlay channel"
```

---

## Task 3: `useInsertTool` publishes its overlay

**Files:**
- Modify: `src/tools/builtin/useInsertTool.ts`
- Modify: `src/tools/builtin/useInsertTool.test.ts` (create if missing)

- [ ] **Step 1: Write failing tests** — add (or create) `src/tools/builtin/useInsertTool.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInsertTool } from './useInsertTool';
import type { InsertAdapter } from '../../core/adapters/types';

interface Pose { x: number; y: number; width: number; height: number }
const adapter: InsertAdapter<{ id: string }> = {
  insertNode: vi.fn(),
  commitInsert: ({ x, y, width, height }) => ({ id: 'r0', x, y, width, height } as any),
};

function ctxStub() {
  return {
    save: vi.fn(), restore: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(),
    setLineDash: vi.fn(), scale: vi.fn(), translate: vi.fn(),
    fillStyle: '', strokeStyle: '', lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('useInsertTool overlay', () => {
  it('publishes a RenderLayer on the Tool record', () => {
    const { result } = renderHook(() => useInsertTool<any, Pose>(adapter));
    expect(result.current.overlay).toBeDefined();
    expect(result.current.overlay!.space).toBe('screen');
  });

  it('renders nothing when no gesture in flight', () => {
    const { result } = renderHook(() => useInsertTool<any, Pose>(adapter));
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it('renders the drag rect once the underlying ctl has overlay state', async () => {
    // Drive a gesture: start → move so ctl.overlay is non-null.
    const { result } = renderHook(() =>
      useInsertTool<any, Pose>(adapter, { overlayStyle: { fill: '#abc', stroke: '#def', dash: [2, 2] } }),
    );
    const ctx0: any = { worldX: 10, worldY: 10, modifiers: {}, view: { x: 0, y: 0, scale: 1 } };
    // Drive via the tool's drag channel — onStart, onMove.
    act(() => {
      result.current.drag!.onStart!({} as any, { ...ctx0, scratch: undefined } as any);
      result.current.drag!.onMove!({} as any, { ...ctx0, worldX: 50, worldY: 30, scratch: undefined } as any);
    });
    const ctx = ctxStub();
    result.current.overlay!.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
    expect((ctx as any).fillStyle).toBe('#abc');
    expect((ctx as any).strokeStyle).toBe('#def');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tools/builtin/useInsertTool.test.ts`
Expected: FAIL — `overlay` not defined on Tool record yet.

- [ ] **Step 3: Implement overlay on `useInsertTool`**

In `src/tools/builtin/useInsertTool.ts`:

1. Add the imports:

```ts
import { viewToTransform } from '../../features/viewport/view';
import { worldToScreen } from '../../features/viewport/viewTransform';
import type { RenderLayer } from '../../core/layers/render';
```

2. Extend the options:

```ts
export interface InsertOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
}

export interface UseInsertToolOptions<TPose> extends UseInsertOptions<TPose> {
  overlayStyle?: InsertOverlayStyle;
}
```

3. Inside the hook, after the `ctl` line, build the overlay (closing over `ctl` and the latest `overlayStyle` via ref):

```ts
  const styleRef = useRef(options.overlayStyle);
  styleRef.current = options.overlayStyle;

  const overlay = useMemo<RenderLayer<unknown>>(() => ({
    id: 'insert-overlay',
    label: 'Insert overlay',
    space: 'screen',
    draw: (ctx, _data, view) => {
      const ov = ctl.overlay;
      if (!ov) return;
      const cfg = styleRef.current ?? {};
      const fill = cfg.fill ?? 'rgba(127, 176, 105, 0.25)';
      const stroke = cfg.stroke ?? '#7fb069';
      const dash = cfg.dash ?? [4, 4];
      const lineWidth = cfg.lineWidth ?? 1;
      const t = viewToTransform(view);
      const { x, y, width: w, height: h } = ov.bounds;
      const [sx, sy] = worldToScreen(x, y, t);
      const sw = w * view.scale;
      const sh = h * view.scale;
      ctx.save();
      ctx.fillStyle = fill;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);
      ctx.restore();
    },
  }), [ctl]);
```

4. Add `overlay` to the returned `defineTool({...})` call.

5. Add `useRef` to the imports list.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --run src/tools/builtin/useInsertTool.test.ts && npx tsc --noEmit`
Expected: PASS, TS clean.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useInsertTool.ts src/tools/builtin/useInsertTool.test.ts
git commit -m "feat(tools): useInsertTool publishes overlay via Tool channel"
```

---

## Task 4: `useSelectTool` publishes its overlay (area/move/resize/rotate ghosts)

**Files:**
- Modify: `src/tools/builtin/useSelectTool.ts`
- Modify: `src/tools/builtin/useSelectTool.test.ts` (create if missing)

- [ ] **Step 1: Write failing tests** — assert the tool record exposes a single `overlay` layer that:

  1. Renders nothing when scratch is `idle`.
  2. Renders the marquee when `areaSelect.overlay` is non-null.
  3. Renders move ghost(s) when `move.overlay` is non-null.
  4. Renders resize ghost when `resize.overlay` is non-null.
  5. Renders rotate ghost when `rotate.overlay` is non-null.
  6. Respects per-mode `*OverlayStyle` options.

  See `src/canvas/Canvas.tsx` `buildAreaSelectOverlayLayer` for the marquee draw recipe (copy verbatim into the test fixture's expected style values). For move/resize/rotate ghost rendering see Canvas's existing `buildMoveOverlayLayer` and the pose-resolution closures (`move?.overlay?.poses.get(id)`, etc.) — the new overlay must replicate that drawing path. **Critical:** the move/resize/rotate ghost needs access to the consumer's `drawOne` for the scene; this test scaffolding will need a stub. If the test's complexity exceeds 200 lines, split into one test file per sub-mode.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tools/builtin/useSelectTool.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement overlay on `useSelectTool`**

In `src/tools/builtin/useSelectTool.ts`:

1. Extend `UseSelectToolOptions` with style options:

```ts
  areaSelectOverlayStyle?: { fill?: string; stroke?: string; dash?: number[]; lineWidth?: number };
  moveOverlayStyle?: { ghostAlpha?: number };
  resizeOverlayStyle?: Record<string, never>;  // shape parity with previous slot config
  rotateOverlayStyle?: Record<string, never>;
  /** Renderer for ghost objects. The select tool needs a way to draw the
   *  in-flight pose for move/resize/rotate ghosts. Consumer passes the same
   *  drawOne they use in the scene slot. If omitted, only the marquee +
   *  bounding-rect outlines render (no fill ghosts). */
  drawGhost?: (
    ctx: CanvasRenderingContext2D,
    obj: unknown,
    pose: TPose,
    view: { x: number; y: number; scale: number },
  ) => void;
  /** Object lookup for ghost rendering — needed by move overlay's poses map. */
  getNode?: (id: string) => unknown | null;
```

2. Build a single `RenderLayer` that:
   - Reads `move.overlay`, `resize.overlay`, `rotate.overlay`, `areaSelect.overlay`.
   - For area: draws the marquee (port `buildAreaSelectOverlayLayer` body).
   - For move: walks `move.overlay.poses`, draws each via `drawGhost` (with `globalAlpha = ghostAlpha`).
   - For resize: draws the new bounds rect outline + scaled ghost via `drawGhost` of `resize.overlay.currentPose`.
   - For rotate: draws the rotated ghost via `drawGhost` of `rotate.overlay.currentPose`.

3. Use `useRef` for the four style options + `drawGhost` + `getNode` so the overlay layer's draw closure sees latest values without rebuilding the Tool record.

4. Add `overlay` to the returned `defineTool({...})`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --run src/tools/builtin/useSelectTool.test.ts && npx tsc --noEmit`
Expected: PASS, TS clean.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useSelectTool.ts src/tools/builtin/useSelectTool.test.ts
git commit -m "feat(tools): useSelectTool publishes unified overlay (area/move/resize/rotate)"
```

---

## Task 5: Canvas appends `tools.getActiveOverlays()` to the layer pipeline

This task gets the new channel wired *before* removing the legacy one — so the test suite stays green at every step.

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Modify: `src/canvas/Canvas.test.tsx`

- [ ] **Step 1: Write failing test** — a Canvas-level test that:

  1. Creates a `useTools` with a fake Tool that has an `overlay: RenderLayer<unknown>` whose `draw` calls a spy.
  2. Renders `<Canvas tools={tools} ...>`.
  3. Asserts the spy was called during paint.
  4. Asserts the overlay rendered *after* `selectionOverlay` (z-order top).

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — overlays from tools aren't appended yet.

- [ ] **Step 3: Append `getActiveOverlays()` to the layer pipeline**

In `src/canvas/Canvas.tsx` `layers` useMemo (the one ending around line 1453), after the `out.push(...tail);` line and before `return out;`:

```ts
    if (tools) {
      out.push(...tools.getActiveOverlays());
    }
```

Add `tools` to the useMemo dependency array.

Also add `tools` to the `layersWithDebug` useMemo deps if it's not already covered transitively.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --run src/canvas/Canvas.test.tsx && npx tsc --noEmit`
Expected: PASS, TS clean.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(canvas): append tools.getActiveOverlays() to layer pipeline"
```

---

## Task 6: Wire Swillustrator demo's tool palette to use the new overlay channel

This is a verification task — Swillustrator already uses the Tool primitive with `useInsertTool` and `useSelectTool`. After Tasks 3+5, the insert overlay should appear via the new channel. After Task 4, area-select / move / resize / rotate ghosts also appear.

**Files:**
- Modify: `demo/demos/SwillustratorDemo.tsx`
- Modify: `demo/demos/swillustratorDemo.integration.test.tsx`

- [ ] **Step 1: Remove the now-redundant `insertOverlay: {}` slot from SwillustratorDemo's `layers` map.**

```ts
// Before:
layers={{
  scene: { drawOne: ... },
  text: { layer: textLayer, before: 'selectionOverlay' },
  paths: { layer: pathLayer, before: 'selectionOverlay' },
  penPreview: { layer: penPreview, before: 'selectionOverlay' },
  selectionOverlay: {},
  insertOverlay: {},
}}

// After:
layers={{
  scene: { drawOne: ... },
  text: { layer: textLayer, before: 'selectionOverlay' },
  paths: { layer: pathLayer, before: 'selectionOverlay' },
  penPreview: { layer: penPreview, before: 'selectionOverlay' },
  selectionOverlay: {},
}}
```

If `useSelectTool` needs `drawGhost` / `getNode` for move/resize/rotate ghosts (see Task 4), wire them here:

```ts
const select = useSelectTool<Obj, Pose>(adapter, {
  hitBody, boundsOf,
  drawGhost: (ctx, _obj, pose) => { /* same drawOne logic, scoped to ghost */ },
  getNode: (id) => itemsRef.current.find((o) => o.id === id) ?? null,
});
```

- [ ] **Step 2: Extend integration test** — add assertions to `swillustratorDemo.integration.test.tsx`:

```ts
it('shows insert-rect overlay during a drag', async () => {
  const { container } = render(<SwillustratorDemo />);
  // Click "Rect" button.
  fireEvent.click(screen.getByRole('button', { name: /Rect/ }));
  const canvas = container.querySelector('canvas')!;
  // Drag from (50, 50) → (150, 100).
  fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: 150, clientY: 100, pointerId: 1 });
  // Spy on the canvas 2D ctx beforehand and assert fillRect / strokeRect was called.
  // (See existing spy patterns in this file or in Canvas.test.tsx.)
});

it('shows area-select marquee during empty-space drag in select mode', async () => {
  // Similar shape; assert marquee fillRect / strokeRect call.
});
```

- [ ] **Step 3: Run all tests**

Run: `npm test -- --run && npx tsc --noEmit`
Expected: PASS, TS clean.

- [ ] **Step 4: Manual verify in browser**

Run dev server (`npm run dev`), open Swillustrator demo, switch to Rect tool, drag — verify green marquee appears. Switch to Select, drag empty space — verify purple marquee appears. Drag a rect — verify ghost appears. Resize, rotate — verify ghosts appear.

- [ ] **Step 5: Commit**

```bash
git add demo/demos/SwillustratorDemo.tsx demo/demos/swillustratorDemo.integration.test.tsx
git commit -m "demo(swillustrator): drop now-redundant insertOverlay slot config"
```

---

## Task 7: Migrate `NestingDemo` to the Tool primitive

Currently passes a custom `move={move}` controller via the legacy prop and reads `move.overlay?.poses.get(id)` in `selectionOverlay.poseById`. Needs migration to a `useTools` setup with a `useSelectTool` (or a custom `useMoveTool` if Nesting has bespoke move semantics).

**Files:**
- Modify: `demo/demos/NestingDemo.tsx`
- Modify: `demo/demos/NestingDemo.test.tsx` if present.

- [ ] **Step 1: Read the current demo carefully** — note what's special about the move adapter (likely group-aware translate).

- [ ] **Step 2: Wrap the existing `useMove` controller in a Tool**

Either:
  (a) Switch to `useSelectTool` if its move semantics are sufficient, OR
  (b) Define a custom inline Tool wrapping the existing `useMove`-derived controller, with an overlay layer reading `move.overlay`.

Option (b) is more conservative. Pattern:

```ts
const moveTool = useMemo(() => defineTool({
  id: 'move',
  cursor: 'default',
  pointer: { onDown: (e, ctx) => { /* hitBody → set scratch */ } },
  drag: {
    onStart, onMove, onEnd, onCancel,  // delegate to the move controller
  },
  overlay: {
    id: 'move-ghost',
    label: 'Move ghost',
    space: 'world',
    draw: (ctx, _data, view) => {
      const ov = move.overlay;
      if (!ov) return;
      // Walk ov.poses and draw each ghost via the demo's sceneLayer drawer.
    },
  },
}), [move]);

const tools = useTools({ active: 'move', registry: { move: moveTool } });
```

- [ ] **Step 3: Remove `move={move}` and update `selectionOverlay.poseById`**

The selection overlay's `poseById` no longer reads `move.overlay?.poses.get(id)`; it reads from the adapter directly (committed state). The ghost render lives in the move tool's overlay.

- [ ] **Step 4: Run all tests + typecheck + manual verify**

- [ ] **Step 5: Commit**

```bash
git commit -m "demo(nesting): migrate to Tool primitive (drop move= prop)"
```

---

## Task 8: Migrate `InsertDemo` to the Tool primitive

`InsertDemo` uses `<SceneCanvas tool="insert" insertOptions={...} commitInsert={...} ...>`. The `tool="insert"` shorthand wires Canvas's internal `useInsert` and renders the marquee via the legacy `insertOverlay: {}` slot.

**Files:**
- Modify: `demo/demos/InsertDemo.tsx`

- [ ] **Step 1: Replace `tool="insert"` with explicit `useInsertTool` + `useTools`**

```ts
const insert = useInsertTool(adapter, { minBounds: { width: 4, height: 4 } });
const tools = useTools({ active: 'insert', registry: { insert } });
```

- [ ] **Step 2: Remove `insertOverlay: {}` slot, replace `tool="insert"` with `tools={tools}` on `SceneCanvas`**

Note: SceneCanvas may need a parallel `tools` prop. If not present, this task expands to add it (mirrors Canvas).

- [ ] **Step 3: Test + typecheck + manual verify**

- [ ] **Step 4: Commit**

```bash
git commit -m "demo(insert): migrate to Tool primitive"
```

---

## Task 9: Migrate `ComposeDemo` to the Tool primitive

`ComposeDemo` toggles `tool={tool}` between `'select'` and `'insert'` and renders both `insertOverlay: {}` and `areaSelectOverlay: {}` slots. Migrate to a `useTools` with both registered, and a button toggling `tools.setActive`.

**Files:**
- Modify: `demo/demos/ComposeDemo.tsx`

- [ ] **Step 1: Build select + insert Tools, drive via `useTools`**
- [ ] **Step 2: Remove `tool=` and the two overlay slots**
- [ ] **Step 3: Test + typecheck + manual verify**
- [ ] **Step 4: Commit**

```bash
git commit -m "demo(compose): migrate to Tool primitive"
```

---

## Task 10: Remove `insert`/`areaSelect`/`move`/`resize`/`rotate` props and slot configs from Canvas

Lands after Tasks 7–9 (demo migrations) so no consumer of the legacy props remains. Until those tasks ship, the legacy props coexist with the new overlay channel — both can be live simultaneously since `getActiveOverlays()` is additive.

**Files:**
- Modify: `src/canvas/Canvas.tsx` (large)
- Modify: `src/canvas/Canvas.test.tsx`
- Modify: `src/canvas/layers.ts`, `src/canvas/layers.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Verify no demo or test still references the legacy props/configs**

Run:
```bash
grep -rEn "insertOverlay|areaSelectOverlay|move=\\{|resize=\\{|rotate=\\{|insert=\\{|areaSelect=\\{" src/ demo/ --include="*.ts" --include="*.tsx"
```

Expected: only the deletions in `src/canvas/Canvas.tsx` itself remain. If demos still match, complete Tasks 7–9 first.

- [ ] **Step 2: Remove from `Canvas.tsx`**

Delete (with adjacent doc lines):

- The `insert`, `areaSelect`, `move`, `resize`, `rotate` props from `CanvasProps` (around lines 293–302).
- `MoveOverlaySlotConfig`, `ResizeOverlaySlotConfig`, `InsertOverlaySlotConfig`, `AreaSelectOverlaySlotConfig` type exports (lines ~141–167).
- `moveOverlay`, `resizeOverlay`, `insertOverlay`, `areaSelectOverlay` from `LayersMap` (lines 208–212).
- `'moveOverlay'`, `'resizeOverlay'`, `'insertOverlay'`, `'areaSelectOverlay'` from `STANDARD_SLOTS` (lines 111–115).
- `buildInsertOverlayLayer` and `buildAreaSelectOverlayLayer` functions (lines 557–622).
- The `moveOverride`, `resizeOverride`, `rotateOverride`, `insertOverride`, `areaSelectOverride` destructuring + usages (lines 643–652, 1005–1015).
- The `move?.overlay?.poses.get(id)` etc. in pose-resolution closures (lines 1040–1050) — replace with reading from the active Tool's overlay state, OR just drop the override (the tool overlay layer renders the ghost itself, scene draws committed; double-draw acceptable per spec).
- The internal `useMove` / `useResize` / `useRotate` / `useInsert` / `useAreaSelect` calls — only if they're now unused. If `tool="select"` shorthand still relies on them, defer to Task 11 ("legacy `tool=` shorthand removal").
- The `moveSlot`, `insertSlot`, `areaSlot` blocks in the layers useMemo (lines 1326–1409).

- [ ] **Step 3: Remove re-exports**

In `src/index.ts`, drop:
```
InsertOverlaySlotConfig,
AreaSelectOverlaySlotConfig,
```

(and any others matching: search for `MoveOverlaySlotConfig`, `ResizeOverlaySlotConfig`.)

- [ ] **Step 4: Update `src/canvas/layers.ts` / `layers.test.ts`**

Drop references to the removed slots; rebalance the standard-slot ordering test.

- [ ] **Step 5: Update Canvas tests**

In `src/canvas/Canvas.test.tsx`, replace any test using `<Canvas insert={ctl} ...>` or `<Canvas areaSelect={ctl} ...>` with the Tool-primitive equivalent (build a `useTools({active:'insert', registry:{insert: useInsertTool(...)}})` and pass via `tools={tools}`).

- [ ] **Step 6: Run all tests + typecheck**

```
npm test -- --run && npx tsc --noEmit
```

Expected: PASS, TS clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(canvas)!: remove typed-per-gesture overlay props and slot configs

BREAKING: insert/areaSelect/move/resize/rotate props removed from
<Canvas>, replaced by the Tool overlay channel
(tools.getActiveOverlays). insertOverlay and areaSelectOverlay slot
configs removed; theming flows through the Tool wrapper's
overlayStyle option. Move/resize/rotate ghosts render via
useSelectTool's overlay; scene draws committed state only."
```

---

## Task 11: Remove the legacy `tool=` shorthand from Canvas / SceneCanvas

After Tasks 7–9 + 10 land, no demo uses `tool="select"` or `tool="insert"`. Audit the remaining `tool=` usages — `BezierEditDemo`, `CompoundPathsDemo`, `MultiSelectDemo`, `SceneDemo` use `tool="none"` or `tool="select"`. The `tool=` shorthand is part of the legacy "Canvas owns the gesture controllers" model; under the Tool primitive consumers should pass a `tools` prop with the desired Tools registered.

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Modify: each demo passing `tool="select"`, `tool="none"`, or `tool="insert"`.
- Modify: `src/canvas/Canvas.test.tsx`

- [ ] **Step 1: Audit and migrate every remaining `tool=` consumer.**

`tool="none"` callers can simply drop the prop. `tool="select"` callers need a `useTools` with a select tool registered (or migrate to `useSelectTool`).

- [ ] **Step 2: Remove `tool` from `CanvasProps` and Canvas's internal switch.**

- [ ] **Step 3: Drop the now-unused internal `useMove`/`useResize`/`useRotate`/`useInsert`/`useAreaSelect` calls in Canvas if nothing else still references them.**

- [ ] **Step 4: Test + typecheck + manual verify each demo.**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(canvas)!: remove legacy tool= shorthand and inline gesture controllers"
```

---

## Task 12: Final cleanup — TODO updates, doc passes

- [ ] **Step 1: Update `docs/TODO.md`**

Move the "Tool overlay channel" entry (if present) to the shipped section. Add the deferred items from the spec under "Tool overlay channel follow-ups":
  - Per-overlay z-positioning (`overlayPosition` field).
  - Multiple overlays per Tool (`overlay?: RenderLayer | RenderLayer[]`).
  - Subscription / push model (`tools.publishOverlay(toolId, layer)`).

- [ ] **Step 2: Update `docs/specs/2026-05-03-tool-overlay-channel-design.md`** — append a "Status: Implemented" line at the top.

- [ ] **Step 3: Final test sweep**

```
npm test -- --run && npx tsc --noEmit
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: mark tool overlay channel shipped, log v1 deferrals"
```

---

## Self-review

(See spec for the full review pass — this section to be completed after the plan is reviewed.)

**Spec coverage checked:** all bullet points from the spec's "Files to create / modify" section are mapped to tasks above. Sequencing: tasks 1–5 add the new channel non-destructively; task 6 verifies via Swillustrator; tasks 7–9 migrate the legacy-prop demos; tasks 10–11 are the destructive cleanups (props/slot configs first, `tool=` shorthand second); task 12 finalizes docs.

**Type consistency:** `useInsertTool` adds `overlayStyle: { fill, stroke, dash, lineWidth }`; `useSelectTool` adds four parallel options (`areaSelectOverlayStyle`, `moveOverlayStyle`, `resizeOverlayStyle`, `rotateOverlayStyle`). Names match the slot configs they replace.

**Placeholders:** Task 4 ("Implement overlay on `useSelectTool`") is the largest — the overlay needs to dispatch on which sub-controller has live state and replicate ghost-rendering logic from Canvas. The plan instructs the implementer to port `buildAreaSelectOverlayLayer` and the move/resize/rotate ghost logic from Canvas verbatim. If the implementer struggles to extract these without circular dependencies, escalate.
