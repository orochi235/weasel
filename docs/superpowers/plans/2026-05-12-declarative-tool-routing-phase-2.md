# Declarative tool routing — Phase 2 (useHandTool migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `useHandTool` from its imperative `defineTool` (existing kit shape) to the declarative `defineViewportTool` factory shipped in Phase 1. First real-tool migration; validates the factory's contract on a small, untargeted tool.

**Architecture:** `useHandTool` is the smallest built-in — untargeted (it's a viewport tool, no target routing), single drag gesture, two cursor states (`grab` / `grabbing`), optional inertia continuation. The migration replaces the imperative `drag.onStart/onMove/onEnd/onCancel` block with a function-form `drag` returning `begin({ ... })` with continuation closures. Cursor splits into top-level `'grab'` plus `engaged.cursor: 'grabbing'`. The inertia hooks (`useVelocityTracker`, `useDecayLoop`) stay imperative React hooks composed alongside the factory — the migration doesn't dissolve those.

**Tech Stack:** TypeScript, React 18+, Vitest. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`.
**Predecessor:** Phase 1 plan at `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-1.md`.

---

### Open issue (resolve at Task 1)

The existing useHandTool reads `e.clientX` / `e.clientY` (screen coords) from the raw pointer event to compute pan deltas in screen space. The new `BeginSpec` continuation signatures (`onMove`, `onRelease`, `onCancel`) take only `ctx: ToolCtx<TScratch>` — no raw event. ToolCtx today exposes `point` (world coords) but not screen coords.

Three resolutions, in order of preference:

1. **Extend `ToolCtx` with `screenPoint: { x: number; y: number }`** populated by the dispatcher alongside `point`. Cleanest; available to any tool that needs screen-space math. Small change, fits in this plan as Task 1.
2. **Snapshot client coords at begin time and compute deltas from `ctx.point - scratch.startPoint` × `view.scale`.** Works but conflates world and screen math; less robust under mid-gesture view changes.
3. **Add an `event` field to ToolCtx** carrying the raw pointer event. Heavy — adds DOM coupling to every continuation handler.

This plan assumes resolution #1 and includes adding `screenPoint` as Task 1.

---

### File map

**Modified:**

- `src/tools/types.ts` — add `screenPoint?: { x: number; y: number }` to `ToolCtx`.
- `src/tools/dispatcher.ts` — populate `ctx.screenPoint` from `clientX`/`clientY` (relative to `canvasRect`) during event dispatch.
- `src/tools/builtin/useHandTool.ts` — replace the imperative `defineTool({ drag: { onStart, onMove, onEnd, onCancel }, ... })` block with `defineViewportTool({ initial: { drag: ... }, engaged: { cursor: 'grabbing' } })`.
- `src/tools/builtin/useHandTool.test.tsx` — existing tests pass against the migrated tool (no behavioral change). Add tests for cursor phase override + scratch-as-engaged-marker.

---

## Task 1: Extend `ToolCtx` with `screenPoint`

**Files:**

- Modify: `src/tools/types.ts`
- Modify: `src/tools/dispatcher.ts`

Adds the screen-space pointer coords to `ToolCtx` so viewport tools (and any other tool needing screen math) can compute pan/zoom in screen space without reaching for the raw event.

- [ ] **Step 1: Add the field to ToolCtx**

In `src/tools/types.ts`, find the `ToolCtx` interface and add (alongside the existing `point`/`worldX`/`worldY`):

```ts
  /** Screen-space pointer coords relative to `canvasRect`. Useful for
   *  viewport tools that pan/zoom in screen space (e.g. hand-pan
   *  computes deltas in pixels, not world units). Optional — populated
   *  by the dispatcher on pointer events; absent on keyboard events. */
  screenPoint?: { x: number; y: number };
```

- [ ] **Step 2: Populate from the dispatcher**

In `src/tools/dispatcher.ts`, find where the dispatcher builds `ToolCtx` for pointer events. The dispatcher already has `canvasRect`; subtract from `event.clientX`/`clientY`:

```ts
const screenPoint = {
  x: e.clientX - canvasRect.left,
  y: e.clientY - canvasRect.top,
};
// Pass through to the ctx object.
```

Don't populate for keyboard or wheel events — keep it optional.

- [ ] **Step 3: Typecheck + tests**

```bash
cd /Users/mike/src/weasel
npm run typecheck
npm test
```

Both clean. Existing tools that don't read `screenPoint` are unaffected.

- [ ] **Step 4: Commit**

```bash
git add src/tools/types.ts src/tools/dispatcher.ts
git commit -m "feat(tools): populate ctx.screenPoint from pointer events

Viewport tools that pan/zoom in screen space (hand-pan, future
wheel-pan refactors) need screen-space pointer coords. Adding to
ToolCtx as optional; the dispatcher populates from event.clientX/Y
relative to canvasRect on pointer events. Keyboard/wheel events
leave it undefined. Required by Phase 2 of declarative tool routing."
```

---

## Task 2: Migrate useHandTool to `defineViewportTool`

**Files:**

- Modify: `src/tools/builtin/useHandTool.ts`

Replace the imperative `defineTool` block with `defineViewportTool` from the `/routing` subpath. The inertia hooks (`useVelocityTracker`, `useDecayLoop`) stay; only the Tool construction shape changes.

- [ ] **Step 1: Read the current implementation**

```bash
cd /Users/mike/src/weasel
cat src/tools/builtin/useHandTool.ts
```

Note the shape: `drag.onStart` captures startView + startClientX/Y in scratch; `drag.onMove` computes screen delta and applies; `drag.onEnd` triggers inertia; `drag.onCancel` clears.

- [ ] **Step 2: Replace the factory call**

Replace the existing `defineTool<HandScratch | null>({...})` with the new shape. Full new body for the function:

```ts
import { useMemo, useRef, createElement } from 'react';
import { defineViewportTool, begin, hold, cancel } from '../routing';
import { apply } from '../routing';   // only if you use apply anywhere
import type { Tool } from '../types';
import { HandIcon } from '../../icons';
import type { View } from 'core/viewport/view';
import { useVelocityTracker } from 'core/viewport/useVelocityTracker';
import { useDecayLoop, type PanBounds } from 'core/viewport/useDecayLoop';

export interface InertiaConfig {
  friction?: number;
  minSpeed?: number;
  boundary?: 'stop' | 'bounce';
  bounds?: PanBounds;
}

export interface UseHandToolOptions {
  inertia?: false | InertiaConfig;
}

interface HandScratch {
  startView: View;
  startScreenPoint: { x: number; y: number };
}

export function useHandTool(opts: UseHandToolOptions = {}): Tool<HandScratch | null> {
  const inertia = opts.inertia === false ? false : opts.inertia;
  const tracker = useVelocityTracker();
  const decay = useDecayLoop();
  // Refs keep the latest setView / current view available to the decay
  // tick callback after the gesture ends.
  const setViewRef = useRef<((v: View) => void) | null>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, scale: 1 });

  return useMemo(
    () =>
      defineViewportTool<HandScratch | null>({
        id: 'hand',
        keybinding: { key: 'H' },
        hotkey: 'space',
        presentation: {
          label: 'Hand',
          icon: createElement(HandIcon),
          group: 'view',
        },
        cursor: 'grab',
        initial: {
          drag: (ctx) => {
            // Cancel any in-flight inertia from a previous gesture.
            decay.cancel();
            tracker.reset();
            setViewRef.current = ctx.setView;
            viewRef.current = ctx.view;
            return begin<HandScratch>({
              scratch: {
                startView: ctx.view,
                startScreenPoint: ctx.screenPoint ?? { x: 0, y: 0 },
              },
              onMove: (ctx) => {
                const screen = ctx.screenPoint ?? { x: 0, y: 0 };
                const dx = screen.x - ctx.scratch.startScreenPoint.x;
                const dy = screen.y - ctx.scratch.startScreenPoint.y;
                const newView: View = {
                  x: ctx.scratch.startView.x - dx,
                  y: ctx.scratch.startView.y - dy,
                  scale: ctx.scratch.startView.scale,
                };
                if (inertia) {
                  tracker.record(
                    newView.x - viewRef.current.x,
                    newView.y - viewRef.current.y,
                    Date.now(),
                  );
                }
                viewRef.current = newView;
                setViewRef.current = ctx.setView;
                ctx.setView(newView);
                return hold(ctx.scratch);
              },
              onRelease: (ctx) => {
                if (inertia) {
                  setViewRef.current = ctx.setView;
                  viewRef.current = ctx.view;
                  const velocity = tracker.getVelocity();
                  decay.start({
                    velocity,
                    friction: inertia.friction,
                    minSpeed: inertia.minSpeed,
                    boundary: inertia.boundary,
                    viewBounds: inertia.bounds,
                    initialPosition: { x: viewRef.current.x, y: viewRef.current.y },
                    onTick: (dvx, dvy) => {
                      const v = viewRef.current;
                      const next: View = {
                        x: v.x + dvx, y: v.y + dvy, scale: v.scale,
                      };
                      viewRef.current = next;
                      setViewRef.current?.(next);
                    },
                  });
                }
                // View changes aren't undoable — exit engaged without applying ops.
                return cancel();
              },
              onCancel: () => {
                decay.cancel();
              },
            });
          },
        },
        engaged: {
          cursor: 'grabbing',
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inertia, tracker, decay],
  );
}
```

Key differences from the current implementation:

- `defineViewportTool` instead of `defineTool` — declarative shape, no routing tables.
- `drag` is a function-form ActionFn returning `begin({ ... })`. The continuations live inside the BeginSpec, not as separate channel handlers.
- Cursor split: `'grab'` at top level; `'grabbing'` via `engaged.cursor` override.
- `startClientX`/`startClientY` (raw event coords) replaced with `startScreenPoint: { x, y }` from `ctx.screenPoint` (canvas-relative).
- Scratch mutation `ctx.scratch = { ... }` replaced with `begin({ scratch: { ... } })` and `hold(ctx.scratch)` for the no-op updates inside onMove.
- `onRelease` returns `cancel()` rather than `'claim'` because view changes aren't undoable — the phase exits without applying ops.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Clean.

- [ ] **Step 4: Run existing useHandTool tests**

```bash
npm test -- src/tools/builtin/useHandTool
```

Must pass with no behavioral change. The migration is meant to preserve all behaviors.

If any tests fail, the migration introduced a regression. Common causes:
- Screen-coord computation differs from client-coord computation (canvasRect offset).
- `ctx.scratch` semantics — the old code mutated; the new code returns `hold(...)`. The factory's translation should make these equivalent, but verify.
- Inertia tick handler — the ref-based view tracking must still work.

- [ ] **Step 5: Run the full kit test suite**

```bash
npm test
```

Baseline ~2475 passing must hold.

- [ ] **Step 6: Manual smoke test**

```bash
npm run dev
```

Open the kit demo, switch to the Pan demo (`#pan` or similar):
- Press `H` → cursor turns to `grab`.
- Press and drag → cursor turns to `grabbing`, canvas pans with the cursor.
- Release → cursor back to `grab`. If inertia is configured, canvas continues panning briefly.
- Press and hold `space` → cursor turns to `grab` (hotkey-engaged hand).
- Release space → cursor returns to the prior tool's cursor.
- Escape during drag → drag cancels cleanly.

If any behavior differs from the pre-migration baseline, debug. The migration is supposed to be behaviorally identical.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/useHandTool.ts
git commit -m "feat(tools): migrate useHandTool to defineViewportTool

First built-in to migrate to the declarative routing factory. Functional
identity preserved — drag-pan, cursor states ('grab' ↔ 'grabbing'),
inertia continuation, hotkey-engage on space, keybinding on H. Code is
shorter and more readable: drag is a function-form ActionFn returning
begin({...}) with continuation closures; cursor splits across top-level
+ engaged-phase override instead of a single function-of-scratch.

Scratch now uses ctx.screenPoint (added in the prior Task 1 commit)
instead of raw e.clientX/Y — cleaner abstraction over the event."
```

---

## Task 3: Add cursor-phase-override tests

**Files:**

- Modify: `src/tools/builtin/useHandTool.test.tsx`

Existing tests cover pan behavior and inertia. The migration adds the per-phase cursor override; add coverage so a future refactor doesn't silently regress the `'grab'`/`'grabbing'` transition.

- [ ] **Step 1: Inspect the existing test file**

```bash
cd /Users/mike/src/weasel
sed -n '1,30p' src/tools/builtin/useHandTool.test.tsx
```

Confirm the test rig — what mock ctx do existing tests build?

- [ ] **Step 2: Add new tests at the bottom of the file**

```tsx
import { renderHook } from '@testing-library/react';
import { useHandTool } from './useHandTool';

describe('useHandTool — cursor states', () => {
  it('idle cursor is grab when scratch is null', () => {
    const { result } = renderHook(() => useHandTool());
    const ctx = { scratch: null } as never;
    const cursor = typeof result.current.cursor === 'function'
      ? result.current.cursor(ctx)
      : result.current.cursor;
    expect(cursor).toBe('grab');
  });

  it('engaged cursor is grabbing when scratch is set', () => {
    const { result } = renderHook(() => useHandTool());
    const ctx = { scratch: { startView: { x: 0, y: 0, scale: 1 }, startScreenPoint: { x: 0, y: 0 } } } as never;
    const cursor = typeof result.current.cursor === 'function'
      ? result.current.cursor(ctx)
      : result.current.cursor;
    expect(cursor).toBe('grabbing');
  });
});
```

These tests verify the factory's cursor resolution (phase override beats top-level) works against the real `useHandTool` return.

- [ ] **Step 3: Run the new tests**

```bash
npm test -- src/tools/builtin/useHandTool.test
```

Both new tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/useHandTool.test.tsx
git commit -m "test(tools): cursor phase-override coverage on useHandTool

Verifies the factory's cursor resolution (phase.cursor > Tool.cursor)
fires the right value based on scratch presence. Locks in the
'grab' ↔ 'grabbing' transition so future refactors don't silently
regress it."
```

---

## Self-review notes (for the implementer)

- **Resolved open issue:** Task 1 adds `ctx.screenPoint`. If Phase 1 already shipped this (check before starting Task 1), skip to Task 2.
- **Inertia hooks stay imperative.** `useVelocityTracker` and `useDecayLoop` are kit-shipped React hooks, not part of the routing surface. The migration composes them around the factory call exactly as before.
- **`return cancel()` from `onRelease` may look surprising** — typical drag tools `commit(ops)` to apply changes at release time. Hand tool doesn't have ops; view changes aren't undoable. Returning `cancel()` is the correct way to close the engaged phase without applying ops (and matches what the existing tool's `onEnd: (_e, ctx) => { ctx.scratch = null; ... return 'claim'; }` does — clear scratch, no ops).
- **Migration is behavior-preserving.** All existing pan/inertia/cursor/hotkey/keybinding behaviors must hold. If a behavior subtly changes during migration (e.g., one test fails), debug rather than accept.
- **`ctx.point` not used.** Hand pan needs screen-space deltas; `ctx.point` (world) would feedback-loop as the view updates. `ctx.screenPoint` is the right field here.
- **Subsequent migrations (Phase 3+) will be more complex.** Hand tool is the simplest case: untargeted, single gesture, no routing table, no modifier sub-tables. Phase 3's useSelectTool exercises all of those at once — written after this migration validates the factory.
