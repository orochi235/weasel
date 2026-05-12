# Declarative tool routing — Phase 5c (Viewport tool migrations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the three remaining imperative viewport tools (`useWheelPanTool`, `useWheelZoomTool`, `useKeyboardZoomTool`) from `defineTool` (the legacy `src/tools/defineTool.ts` identity helper) to `defineViewportTool` from `src/tools/routing`. After this phase, no built-in tool imports the legacy `defineTool` identity helper, and the imperative escape hatch is reserved strictly for tool authors with shapes that the declarative factory can't express.

**Architecture:** All three target tools are stateless wheel/keyboard handlers (no drag scratch, no engaged phase). They already speak the `'claim' | 'pass'` dispatcher protocol; migration translates that into `Result<TScratch>` returns (`claim()` and `none()`) and lifts the imperative `wheel.onWheel` / `keyboard.onDown` channels into the declarative `initial.wheel` ActionFn and `initial.keyDown` route table. The `defineViewportTool` factory at `src/tools/routing/defineViewportTool.ts` already exposes `wheel`, `keyDown`, and `keyUp` on `ViewportPhaseDef` (verified: `src/tools/routing/types.ts` lines 101–112), so no substrate prep is required.

`usePinchZoomTool` is intentionally out of scope. It's not a `Tool` record — it's a standalone hook that directly attaches multi-pointer listeners to the canvas element (`canvasRef`), bypassing the tool dispatcher entirely (see `src/tools/builtin/usePinchZoomTool.ts`). Migrating it would require a separate `defineViewportTool` extension for multi-pointer gestures, which is a different exercise from translating existing dispatcher-routed tools.

**Tech Stack:** TypeScript, React 18+, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`.
**Predecessors:** Phase 1–5b plans (in the same directory).

---

## Pre-flight survey findings

Investigation completed before writing tasks. Documenting here so subagents don't repeat it.

**Tools to migrate (imperative `defineTool` from `../defineTool`):**

| Tool | Channels | Scratch | Engaged phase | Cursor | LOC |
|---|---|---|---|---|---|
| `useWheelPanTool` | `wheel` | none | no | none | 35 |
| `useWheelZoomTool` | `wheel` | none | no | none | 51 |
| `useKeyboardZoomTool` | `keyboard.onDown` | none (uses `useRef` for tween fwd) | no | none | 77 |

**Not migrating:**

- `useHandTool` — already on `defineViewportTool` (Phase 2). Canonical reference.
- `usePinchZoomTool` — not a `Tool`; standalone canvas-ref hook (see preamble). Out of scope; document the non-migration but don't touch the file.

**Substrate status:** `ViewportPhaseDef` already includes `wheel`, `keyDown`, `keyUp`, `cursor`, `overlay`, `claimsAll`:

```ts
// src/tools/routing/types.ts
export type ViewportPhaseDef<TScratch = void> = Pick<
  PhaseDef<TScratch>, 'wheel' | 'keyDown' | 'keyUp' | 'cursor' | 'overlay' | 'claimsAll'
> & {
  drag?: ActionFn<TScratch>;
};
```

`defineViewportTool` lifts those fields through to `defineTool`, which already builds `tool.wheel.onWheel` and `tool.keyboard.onDown`/`onUp` handlers from those routes (see `src/tools/routing/defineTool.ts` lines 205–291). **No substrate-prep task is needed.**

**Return-value translation:** The imperative handlers return `'claim' | 'pass'` directly. The declarative `ActionFn` returns a `Result<TScratch>`, and `applyResult` in `defineTool.ts` maps:

- `claim()` → dispatcher decision `'claim'`
- `none()` → dispatcher decision `'pass'`

Both come from `src/tools/routing/result.ts` and re-export via `src/tools/routing/index.ts`. Use these directly — no need for `apply`/`begin`/`hold` (no ops, no scratch transitions).

**`ToolCtx` note:** `e: WheelEvent | KeyboardEvent` is passed as the second positional argument to `ActionFn`. The factory signature is `(ctx, event) => Result<TScratch>` — see `src/tools/routing/types.ts` line 7. Body code that previously named the event `e` should now name it explicitly in the second positional, or destructure off the event parameter.

---

## Task ordering rationale

Migrate simplest first to build muscle memory and verify the channel mapping pattern before touching the tween-bearing keyboard tool.

1. **T1 — `useWheelPanTool`** (35 LOC, single wheel handler, no opts edge cases) — canonical wheel-only declarative shape.
2. **T2 — `useWheelZoomTool`** (51 LOC, single wheel handler, `min`/`max`/`wheelStep`/`requireCtrl` opts) — same channel as T1, more opts to thread.
3. **T3 — `useKeyboardZoomTool`** (77 LOC, `keyboard.onDown` with cross-key dispatch + tween + ref forwarding) — most state machinery, but still no scratch. Last so the wheel pattern is already proven.
4. **T4 — Regression sweep** (`tsc --noEmit && vitest run && tsup build`).

---

## T1 — Migrate `useWheelPanTool` to `defineViewportTool`

### Goal

Replace the imperative `defineTool({ id, initScratch, wheel: { onWheel } })` shape in `src/tools/builtin/useWheelPanTool.ts` with the declarative `defineViewportTool({ id, initial: { wheel } })` shape. Behavior must be byte-identical: pass when `ctrlKey` is true, otherwise pan by `(deltaX/scale, deltaY/scale)` and claim.

### Steps

- [ ] **Read current state.** `src/tools/builtin/useWheelPanTool.ts` (35 LOC) — note the imperative shape:

  ```ts
  // Current
  import { defineTool } from '../defineTool';
  // ...
  defineTool<null>({
    id: 'wheel-pan',
    initScratch: () => null,
    wheel: {
      onWheel: (e, ctx) => {
        if (e.ctrlKey) return 'pass';
        e.preventDefault();
        const v = ctx.view;
        ctx.setView({ x: v.x + e.deltaX / v.scale, y: v.y + e.deltaY / v.scale, scale: v.scale });
        return 'claim';
      },
    },
  })
  ```

- [ ] **Identify channels used.** Only `wheel` — single ActionFn, no route table. No keyboard, no drag, no engaged phase, no cursor, no overlay.

- [ ] **Write the new shape.** Replace the import and the factory body:

  ```ts
  import { useMemo } from 'react';
  import { defineViewportTool, claim, none } from '../routing';
  import type { Tool } from '../types';

  export function useWheelPanTool(): Tool<null> {
    return useMemo(
      () =>
        defineViewportTool<null>({
          id: 'wheel-pan',
          initial: {
            wheel: (ctx, event) => {
              const e = event as WheelEvent;
              if (e.ctrlKey) return none();
              e.preventDefault();
              const v = ctx.view;
              ctx.setView({
                x: v.x + e.deltaX / v.scale,
                y: v.y + e.deltaY / v.scale,
                scale: v.scale,
              });
              return claim();
            },
          },
        }) as Tool<null>,
      [],
    );
  }
  ```

  Notes:
  - `ActionFn`'s event parameter is typed `PointerEvent | KeyboardEvent | WheelEvent`. Cast to `WheelEvent` at the top of the handler — same pattern useHandTool uses for pointer events implicitly via `ctx.screenPoint`. (Plain wheel routes only ever receive WheelEvent; the cast is just a TS narrowing.)
  - Keep the JSDoc block from the original; it documents user-facing behavior and is still accurate.
  - The `as Tool<null>` cast matches `useHandTool`'s factory return shape — `defineViewportTool` returns `Tool<TScratch>` where `TScratch` defaults to `void`; the runtime expects `null` scratch for tools the dispatcher treats as scratchless, so the cast normalizes the type.

- [ ] **Run the tool's existing test file.**

  ```bash
  npx vitest run src/tools/builtin/useWheelPanTool.test.ts
  ```

  Expected: all 4 tests pass (`pass on ctrlKey`, scale=1 translation, scale=2 translation, scale preservation). The test file calls `result.current.wheel!.onWheel!(e, ctx)` and asserts return value `'claim' | 'pass'` — the factory continues to produce those at the `Tool` boundary because `applyResult` maps `claim()`→`'claim'` and `none()`→`'pass'`.

- [ ] **Run the full kit suite.**

  ```bash
  npx vitest run
  ```

  Expected: green. If any tool palette / integration test fails, the cause is almost certainly the missing `initScratch` on the new factory output — `defineTool` (routing) auto-supplies `initScratch: () => null` (see `src/tools/routing/defineTool.ts` line 250), so this should be transparent. If a test does fail on missing scratch, diff `defineViewportTool`'s output `Tool` shape against the imperative output and patch the factory.

- [ ] **Commit.** Use the same shape as Phase 5b commits:

  ```
  refactor(useWheelPanTool): migrate to defineViewportTool

  Phase 5c/3 — viewport tool migrations. Translate the imperative
  wheel.onWheel channel into the declarative initial.wheel ActionFn.
  Behavior identical; tests unchanged.
  ```

---

## T2 — Migrate `useWheelZoomTool` to `defineViewportTool`

### Goal

Same channel mapping as T1 (`wheel` → `initial.wheel`). Differences: more opts (`min`, `max`, `wheelStep`, `requireCtrl`), and uses `zoomAt` from `core/viewport/zoomAt`.

### Steps

- [ ] **Read current state.** `src/tools/builtin/useWheelZoomTool.ts` (51 LOC). Note the `requireCtrl` defaults to `true`, `wheelStep` defaults to `1.1`.

- [ ] **Identify channels used.** `wheel` only. No state, no engaged phase.

- [ ] **Write the new shape.** Replace the import and factory body:

  ```ts
  import { useMemo } from 'react';
  import { defineViewportTool, claim, none } from '../routing';
  import type { Tool } from '../types';
  import { zoomAt } from 'core/viewport/zoomAt';

  export interface WheelZoomToolOpts {
    min?: number;
    max?: number;
    wheelStep?: number;
    requireCtrl?: boolean;
  }

  export function useWheelZoomTool(opts: WheelZoomToolOpts = {}): Tool<null> {
    const { min, max, requireCtrl = true } = opts;
    const wheelStep = opts.wheelStep ?? 1.1;
    return useMemo(
      () =>
        defineViewportTool<null>({
          id: 'wheel-zoom',
          initial: {
            wheel: (ctx, event) => {
              const e = event as WheelEvent;
              if (requireCtrl && !e.ctrlKey) return none();
              e.preventDefault();
              const rect = ctx.canvasRect;
              const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
              const factor = Math.pow(wheelStep, -e.deltaY / 100);
              ctx.setView(zoomAt(ctx.view, anchor, factor, { min, max }));
              return claim();
            },
          },
        }) as Tool<null>,
      [min, max, wheelStep, requireCtrl],
    );
  }
  ```

  Notes:
  - Keep the WheelZoomToolOpts interface JSDoc block — it documents `requireCtrl` semantics which are user-facing.
  - `useMemo` deps unchanged from the imperative version: `[min, max, wheelStep, requireCtrl]`. The `opts.wheelStep ?? 1.1` resolution is the same; deps capture the resolved value.

- [ ] **Run the tool's existing test file.**

  ```bash
  npx vitest run src/tools/builtin/useWheelZoomTool.test.ts
  ```

  Expected: all 5 tests pass (`passes when ctrlKey is false`, `zooms about cursor anchor`, `respects min/max`, `calls preventDefault on claim`, `subtracts canvasRect.left/top`). Test file calls `result.current.wheel!.onWheel!(e, ctx)` directly — same surface as T1.

- [ ] **Run the full kit suite.** `npx vitest run`. Green.

- [ ] **Commit.**

  ```
  refactor(useWheelZoomTool): migrate to defineViewportTool

  Phase 5c/3 — viewport tool migrations. Translate the imperative
  wheel.onWheel channel into the declarative initial.wheel ActionFn.
  Behavior identical; tests unchanged.
  ```

---

## T3 — Migrate `useKeyboardZoomTool` to `defineViewportTool`

### Goal

Translate the imperative `keyboard.onDown` cross-key dispatch into a declarative `initial.keyDown` route table. The current handler runs a single `onDown` that internally switches on `e.key` for `=`/`+`/`-`/`_`/`0`; the declarative shape gates each key as a separate route entry.

### Steps

- [ ] **Read current state.** `src/tools/builtin/useKeyboardZoomTool.ts` (77 LOC). Note:
  - Modifier gate: `e.metaKey || e.ctrlKey` (cross-platform Cmd/Ctrl).
  - Five recognized keys: `'='`, `'+'`, `'-'`, `'_'`, `'0'`.
  - Refs: `setViewRef`, `tween` from `useViewTween`. The ref keeps the latest `setView` available to the tween's RAF callback after the keydown returns.
  - Result: claim only when a recognized key matched; pass otherwise (including the no-modifier case).

- [ ] **Identify channels used.** `keyboard.onDown` — declarative equivalent is `initial.keyDown: Record<string, ActionFn>`.

- [ ] **Decision: route per key, with the modifier gate per route.**

  The declarative `keyDown` table dispatches by `e.key` (see `src/tools/routing/defineTool.ts` line 209: `const action = table[e.key]`). To preserve the cross-platform Cmd/Ctrl gate, each entry checks `e.metaKey || e.ctrlKey` and returns `none()` when absent.

  Rationale: the spec's `ModifierRoute` mechanism (route by modifier flag) doesn't apply to keyDown tables — those are plain `Record<string, ActionFn>` (not `RouteTable`). The gate has to live in each ActionFn body. The imperative tool already does this in a single switch; spreading the check across five entries is a minor verbosity cost, the alternative (wrapping all five in a single helper) doesn't fit the route-table shape.

- [ ] **Write the new shape.**

  ```ts
  import { useMemo, useRef } from 'react';
  import { defineViewportTool, claim, none } from '../routing';
  import type { Tool } from '../types';
  import { zoomAt } from 'core/viewport/zoomAt';
  import { useViewTween } from 'core/viewport/useViewTween';
  import type { View } from 'core/viewport/view';

  export interface KeyboardZoomToolOpts {
    min?: number;
    max?: number;
    keyStep?: number;
    animate?: boolean;
    duration?: number;
    resetDuration?: number;
    easing?: (t: number) => number;
  }

  export function useKeyboardZoomTool(opts: KeyboardZoomToolOpts = {}): Tool<null> {
    const { min, max, animate = false, easing } = opts;
    const keyStep = opts.keyStep ?? 1.25;
    const duration = opts.duration ?? 200;
    const resetDuration = opts.resetDuration ?? 350;

    const setViewRef = useRef<((v: View) => void) | null>(null);
    const tween = useViewTween((v) => setViewRef.current?.(v));
    const { animateTo } = tween;

    return useMemo(
      () =>
        defineViewportTool<null>({
          id: 'keyboard-zoom',
          initial: {
            keyDown: {
              '=': (ctx, event) => stepZoom(ctx, event, keyStep),
              '+': (ctx, event) => stepZoom(ctx, event, keyStep),
              '-': (ctx, event) => stepZoom(ctx, event, 1 / keyStep),
              '_': (ctx, event) => stepZoom(ctx, event, 1 / keyStep),
              '0': (ctx, event) => resetZoom(ctx, event),
            },
          },
        }) as Tool<null>,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [min, max, keyStep, animate, duration, resetDuration, easing, animateTo],
    );

    function stepZoom(ctx: import('../types').ToolCtx<null>, event: unknown, factor: number) {
      const e = event as KeyboardEvent;
      if (!(e.metaKey || e.ctrlKey)) return none();
      e.preventDefault();
      setViewRef.current = ctx.setView;
      const rect = ctx.canvasRect;
      const center = { x: rect.width / 2, y: rect.height / 2 };
      const target = zoomAt(ctx.view, center, factor, { min, max });
      if (animate) {
        animateTo(ctx.view, target, { duration, easing });
      } else {
        ctx.setView(target);
      }
      return claim();
    }

    function resetZoom(ctx: import('../types').ToolCtx<null>, event: unknown) {
      const e = event as KeyboardEvent;
      if (!(e.metaKey || e.ctrlKey)) return none();
      e.preventDefault();
      setViewRef.current = ctx.setView;
      const target: View = { x: 0, y: 0, scale: 1 };
      if (animate) {
        animateTo(ctx.view, target, { duration: resetDuration, easing });
      } else {
        ctx.setView(target);
      }
      return claim();
    }
  }
  ```

  Notes:
  - The helper closures (`stepZoom`, `resetZoom`) live inside the hook body so they close over `min`, `max`, `keyStep`, `animate`, `duration`, `resetDuration`, `easing`, `animateTo`, and the `setViewRef`. They're declared after the `return` for readability; hoisting still works because they're function declarations.
  - Alternative shape: inline the bodies in each route entry. Helper closures keep the route table itself readable and DRY out the `metaKey || ctrlKey` gate.
  - The `useMemo` dep array matches the imperative version's deps exactly.

- [ ] **Run the tool's existing test file.**

  ```bash
  npx vitest run src/tools/builtin/useKeyboardZoomTool.test.ts
  ```

  Expected: all 7 tests pass:
  - `Cmd+= zooms in about canvas center` — routes to `=` ActionFn, modifier gate passes, `zoomAt` called with center.
  - `Cmd+- zooms out about canvas center` — routes to `-` ActionFn.
  - `Cmd+0 resets to identity` — routes to `0` ActionFn.
  - `passes plain keys without modifier` — `=` routes but modifier gate inside returns `none()`; dispatcher decision `'pass'`.
  - `passes unrelated keys with modifier` — key `'a'` has no route entry, table lookup returns `undefined`, handler returns `'pass'` (see `defineTool.ts` line 213: `if (!action) return 'pass'`).
  - `ctrlKey is treated like metaKey (cross-platform)` — routes to `0`, gate passes via `ctrlKey` branch.
  - `does not call setView immediately when animate is true` — animate branch hands off to `animateTo`; `setView` not called synchronously.

- [ ] **Run the full kit suite.** `npx vitest run`. Green.

- [ ] **Commit.**

  ```
  refactor(useKeyboardZoomTool): migrate to defineViewportTool

  Phase 5c/3 — viewport tool migrations. Translate the imperative
  keyboard.onDown cross-key switch into a declarative initial.keyDown
  route table, with the Cmd/Ctrl modifier gate inlined per route entry
  (keyDown tables don't support ModifierRoute). Behavior identical;
  tests unchanged.
  ```

---

## T4 — Full regression sweep

### Goal

Confirm the three migrations together don't regress the kit. After this passes, no built-in tool imports the legacy imperative `defineTool` identity helper.

### Steps

- [ ] **Verify no remaining imperative `defineTool` consumers in `src/tools/builtin`.**

  ```bash
  grep -rn "from '../defineTool'" /Users/mike/src/weasel/src/tools/builtin/
  ```

  Expected output: **empty.** Every match would be a built-in tool still using the legacy imperative helper — the migration is incomplete if any remain. The `defineTool` identifier in `src/tools/routing/defineTool.ts` is a different module and is fine to keep imported (e.g. by `defineViewportTool` itself).

- [ ] **Run the prepublishOnly gate** (per the user's standing memory `feedback_run_prepublish_before_push.md`):

  ```bash
  cd /Users/mike/src/weasel && npm run prepublishOnly
  ```

  Expected output: `tsc --noEmit` clean, all vitest tests pass, `tsup build` produces `dist/` artifacts without errors.

- [ ] **Check that `src/tools/defineTool.ts` is still alive as an export.**

  ```bash
  grep -rn "from './defineTool'" /Users/mike/src/weasel/src/tools/*.ts
  grep -rn "tools/defineTool" /Users/mike/src/weasel/src/index.ts /Users/mike/src/weasel/src/tools/index.ts 2>/dev/null
  ```

  The legacy `defineTool` (`src/tools/defineTool.ts`) is a 20-line identity helper that's still part of the public surface for consumers writing custom tools who don't want the routing factory. It should remain exported. If it's still imported anywhere internally that's expected; the goal of 5c is "no built-in uses it," not "remove it." Removal is a separate cleanup, optional.

- [ ] **Spot-check the dispatcher integration test** in `src/tools/dispatcher.test.ts` and `src/tools/integration.test.tsx` to confirm wheel/keyboard routing through the migrated tools still yields the same dispatcher decisions. The full vitest run already covers this; this step is a manual smoke check on any failure.

- [ ] **(Optional) Commit a sweep-acknowledgment marker** — if the user wants a "Phase 5c done" milestone commit:

  ```
  refactor(viewport-tools): phase 5c complete

  All built-in viewport tools (hand, wheel-pan, wheel-zoom, keyboard-zoom)
  now use defineViewportTool. usePinchZoomTool remains a standalone
  canvas-ref hook (out of scope — not a Tool record). Legacy
  src/tools/defineTool.ts retained as a public escape hatch for
  consumer-authored tools.
  ```

  Otherwise skip — three per-tool commits already document the work.

---

## What Phase 5c explicitly does NOT cover

1. **`usePinchZoomTool` migration.** It's not dispatcher-routed; it attaches multi-pointer listeners directly to the canvas element via `usePinchGesture`. Migrating it would require a new pointer-channel surface on `ViewportPhaseDef` (multi-touch, or a "raw canvas listener" escape hatch). Defer to a separate phase if/when that surface is designed.
2. **Removal of `src/tools/defineTool.ts`.** It's the imperative public-API escape hatch. Consumers writing custom tools may depend on it. Removal is a separate breaking-change decision.
3. **Modifier-routed keyboard tables.** The Cmd/Ctrl gate in `useKeyboardZoomTool` is inlined per route entry because `keyDown` doesn't support `ModifierRoute`. Lifting modifier support into keyboard route tables is a future factory enhancement — out of scope here.

---

## Self-review checklist

- [x] **Spec coverage** — every imperative viewport tool has a migration task: T1 (`useWheelPanTool`), T2 (`useWheelZoomTool`), T3 (`useKeyboardZoomTool`). `usePinchZoomTool` documented as out-of-scope with rationale; `useHandTool` already migrated (Phase 2).
- [x] **Placeholder scan** — no TBD, no "implement later," no "if needed." Every step shows the actual code or the exact command.
- [x] **Step content** — each task carries the full new factory body, an explicit channel-by-channel mapping rationale, and the exact `vitest run <path>` command with expected pass list.
- [x] **Survey-driven** — task list reflects the three concrete imperative tools found in `src/tools/builtin/` plus a regression sweep. No speculative tasks.
- [x] **Substrate gaps** — none found. `ViewportPhaseDef` already exposes `wheel`/`keyDown`/`keyUp`; preamble verifies via spec line + file line numbers.
