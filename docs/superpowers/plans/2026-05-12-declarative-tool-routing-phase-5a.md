# Declarative tool routing — Phase 5a (Easy migrations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the keyboard-only built-in tools — `useDeleteTool`, `useNudgeTool`, `useDuplicateTool`, `useUndoRedoTool` — from the imperative `defineTool` (`src/tools/defineTool.ts`) to the declarative routing factory (`src/tools/routing/defineTool.ts`). After 5a, every built-in tool with a trivial channel surface is on the routing factory; only the pointer-gesture / modal tools remain.

**Architecture:** All four 5a tools today instantiate `defineTool({ id, keyboard: { onDown: (e) => { ... } } })`. The handler reads `e.key` (and modifiers in some cases), calls a controller method, and returns `'claim'` or `'pass'`. The migration is the same shape four times:

- Swap the import from `../defineTool` (imperative) to `../routing` (declarative).
- Replace the imperative `keyboard.onDown` with a declarative `initial.keyDown` route map. The routing factory's `buildKeyHandler` looks up `table[e.key]` and invokes the matched `ActionFn`, returning `'claim'` when the action produces a non-`none()` result.
- For tools that depend on modifiers (`Mod+D`, `Mod+Z`, `Mod+Shift+Z`), use the raw event parameter (Phase 4.5 `ActionFn` extension: `(ctx, event?) => Result`) to read `metaKey/ctrlKey/shiftKey`. The `keyDown` route is keyed by the bare key (`'d'`, `'z'`); the action does its own modifier check and returns `none()` when the chord doesn't match, so the dispatcher falls through to the next ambient tool.
- For `useNudgeTool`, the four arrow keys become four entries in the `keyDown` table — no in-action key dispatch needed.

No new types or runtime code. The routing factory already supports everything 5a needs (`keyDown` route, `ActionFn` raw-event parameter, `none()` to pass).

**Scope decision — Phase 5a is the four keyboard tools.** `useInsertTool` was on the candidate list but is **demoted to Phase 5b** after the survey:

- `useInsertTool` delegates to `defineDragInsertTool`, which uses the imperative `defineTool` and emits four imperative surfaces the routing factory does not yet expose: top-level `Tool.overlay` (the marquee preview layer), `pointer.onClick` + `drag` lifecycle with an `applyOpsRef` write-then-clear pattern around `controller.start/move/end/cancel`, and the `useMemo`-driven config-ref dance. Two specific gaps push it out of "easy":
  1. **`overlay` is in `PhaseDef` but not emitted by the factory.** `src/tools/routing/defineTool.ts` does not destructure `phase.overlay`, so the marquee preview would silently disappear post-migration. Wiring it up is a small but real factory change, not a mechanical tool swap.
  2. **The controller's `applyOpsRef` lifecycle straddles click and drag.** Mapping it into the `BeginSpec` shape (`begin(spec)` on `drag.onStart`, `commit(...)` on `onRelease`, `cancel()` on `onCancel`) is straightforward, but it is *not* the trivial "rewrite a key table" change the other four tools need.

`defineDragInsertTool` is the shared substrate; migrating it would also migrate every other consumer (`useEllipseTool`, `useLineTool`, `usePolygonTool`, `useStarTool`, `usePencilTool`, `useTextTool` — see `grep -l defineDragInsertTool src/tools/builtin`). That fan-out is a medium-effort architectural step, not a 5a item. Phase 5b will own it alongside the modal tools (pen, text, lasso).

**Other tools explicitly deferred to Phase 5b** (modal / claimsAll / multi-mode):

- `useUserPenTool` — modal `claimsAll`, multi-mode anchor editing.
- `useUserTextTool` / `useTextTool` — modal text-edit state.
- `useLassoTool` — polygon-drawing gesture.

**Tech Stack:** TypeScript, React 18+, Vitest. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md` (especially the Phase 4.5 follow-up section documenting `pointerDown` and the `event` parameter on `ActionFn`).

**Predecessors:**

- Phase 1 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-1.md`
- Phase 2 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-2.md`
- Phase 3 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-3.md`
- Phase 4 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-4.md`
- Phase 4.5 plan: `docs/superpowers/plans/2026-05-12-declarative-tool-routing-phase-4-5.md`

**Reference implementation:** `src/tools/builtin/useSelectTool.ts` (commits b73bcff, ca52f39, 02092ea) — the canonical full-surface exercise of the declarative factory. The keyDown migration pattern in 5a is a strict subset of useSelectTool's surface.

---

## File map

**Modified:**

- `src/tools/builtin/useDeleteTool.ts` — swap to declarative factory; replace `keyboard.onDown` with a two-key `initial.keyDown` route.
- `src/tools/builtin/useNudgeTool.ts` — swap to declarative factory; replace `keyboard.onDown` with a four-key `initial.keyDown` route reading `e.shiftKey` from the raw event.
- `src/tools/builtin/useDuplicateTool.ts` — swap to declarative factory; replace `keyboard.onDown` with a `keyDown.d` route that checks `e.metaKey || e.ctrlKey`.
- `src/tools/builtin/useUndoRedoTool.ts` — swap to declarative factory; replace `keyboard.onDown` with a `keyDown.z` route that checks `(e.metaKey || e.ctrlKey)` and branches on `e.shiftKey`.

**Not modified:**

- `src/tools/builtin/useInsertTool.ts` — deferred to Phase 5b (see preamble).
- `src/tools/builtin/defineDragInsertTool.ts` — substrate for shape-insert tools; deferred to Phase 5b.
- Test files for the four migrated tools — behavior is identical, tests stay green without edits.
- `src/tools/routing/defineTool.ts` — no factory changes; everything 5a needs already ships from Phase 4.5.

---

## Task 1: Migrate `useDeleteTool`

**Files:**

- Modify: `src/tools/builtin/useDeleteTool.ts`

Two keys (`Backspace`, `Delete`) both call `ctl.deleteSelection()`. No modifiers. Trivial conversion: each key becomes its own entry in `initial.keyDown`; the action calls `deleteSelection()` and returns `claim()` (no ops, just a marker that the handler ran — the routing factory's `applyResult` turns `claim` into `'claim'`).

- [ ] **Step 1: Swap the import and rewrite the body**

Replace the file contents with:

```ts
import { useMemo } from 'react';
import { useDelete, type DeleteAdapter, type UseDeleteOptions } from 'interactions/actions/delete/delete';
import { defineTool, claim } from '../routing';
import type { Tool } from '../types';

export interface UseDeleteToolOptions extends UseDeleteOptions {}

/** Always-on Tool wrapping `useDelete`. Handles Backspace and Delete via
 *  the declarative keyDown route (fired on every ambient-slot tool by
 *  the dispatcher). The legacy hook's document-level keybinding is
 *  suppressed by passing `enableKeyboard: false`. */
export function useDeleteTool(
  adapter: DeleteAdapter,
  options: UseDeleteToolOptions = {},
): Tool<undefined> {
  const ctl = useDelete(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'delete',
        initial: {
          keyDown: {
            Backspace: () => {
              ctl.deleteSelection();
              return claim();
            },
            Delete: () => {
              ctl.deleteSelection();
              return claim();
            },
          },
        },
      }),
    [ctl],
  );
}
```

Notes:
- `claim()` is the `Result` constructor exported from `src/tools/routing/result.ts` via the `routing` barrel. The factory's `applyResult` translates `kind: 'claim'` to `'claim'` without touching scratch or dispatching ops, matching the imperative implementation's behavior.
- `keyDown` keys match `KeyboardEvent.key` directly — the routing factory's `buildKeyHandler` does `table[e.key]`, so `'Backspace'` and `'Delete'` are exact strings (no aliasing).

- [ ] **Step 2: Run the tool's test file**

```bash
npx vitest run src/tools/builtin/useDeleteTool.test.ts
```

All assertions in the existing test file must still pass. If any fail, the migration broke behavior — inspect the failure and fix before proceeding.

- [ ] **Step 3: Run the full kit suite**

```bash
npx vitest run
```

Baseline holds: same pass/fail count as before the change. No new failures elsewhere (e.g. in `dispatcher.test.ts`, `useSelectTool.test.ts`, integration tests).

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/useDeleteTool.ts
git commit -m "refactor(useDeleteTool): migrate to declarative routing factory"
```

Commit body should note that the keyboard channel is now expressed as an `initial.keyDown` route, removing the manual `if (e.key !== ...)` dispatch.

---

## Task 2: Migrate `useDuplicateTool`

**Files:**

- Modify: `src/tools/builtin/useDuplicateTool.ts`

One key (`d`) gated by `Mod` (meta or ctrl). The declarative form uses a `keyDown.d` route whose action reads the raw `KeyboardEvent` for the modifier check; if no Mod is held the action returns `none()` so the dispatcher falls through.

- [ ] **Step 1: Swap the import and rewrite the body**

Replace the file contents with:

```ts
import { useMemo } from 'react';
import { useDuplicate, type DuplicateAdapter, type UseDuplicateOptions } from 'interactions/actions/duplicate/duplicate';
import { defineTool, claim, none } from '../routing';
import type { Tool } from '../types';

export interface UseDuplicateToolOptions extends UseDuplicateOptions {}

/** Always-on Tool wrapping `useDuplicate`. Handles Mod+D (meta or ctrl)
 *  for cross-platform support. The legacy hook's document keybinding is
 *  suppressed by passing `enableKeyboard: false`. */
export function useDuplicateTool<TPose>(
  adapter: DuplicateAdapter<TPose>,
  options: UseDuplicateToolOptions = {},
): Tool<undefined> {
  const ctl = useDuplicate(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'duplicate',
        initial: {
          keyDown: {
            d: (_ctx, event) => {
              const e = event as KeyboardEvent;
              if (!(e.metaKey || e.ctrlKey)) return none();
              ctl.duplicate();
              return claim();
            },
          },
        },
      }),
    [ctl],
  );
}
```

Notes:
- The `event` parameter in `ActionFn` is typed `PointerEvent | KeyboardEvent | WheelEvent | undefined` (Phase 4.5 extension). For `keyDown` routes the dispatcher always passes a `KeyboardEvent`, so the cast is safe.
- Returning `none()` when the modifier check fails matches the legacy `return 'pass'` — the routing factory's `applyResult` translates `kind: 'none'` to `'pass'`, letting the next ambient tool try.
- The route key `'d'` is lowercase to match the imperative `e.key.toLowerCase() !== 'd'` check. Browsers report `e.key === 'd'` for the unshifted key and `'D'` when Shift is held; Mod+D without Shift is the canonical chord, so keying on `'d'` is correct. (If we wanted Mod+Shift+D to also fire, we'd add a `'D'` entry — but that matches the legacy behavior of not triggering on Shift+D.)

- [ ] **Step 2: Run the tool's test file**

```bash
npx vitest run src/tools/builtin/useDuplicateTool.test.ts
```

All assertions pass.

- [ ] **Step 3: Run the full kit suite**

```bash
npx vitest run
```

Baseline holds.

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/useDuplicateTool.ts
git commit -m "refactor(useDuplicateTool): migrate to declarative routing factory"
```

---

## Task 3: Migrate `useUndoRedoTool`

**Files:**

- Modify: `src/tools/builtin/useUndoRedoTool.ts`

One key (`z`) gated by `Mod`, branching on `Shift`. Same shape as Task 2 with an internal Shift branch.

- [ ] **Step 1: Swap the import and rewrite the body**

Replace the file contents with:

```ts
import { useMemo } from 'react';
import { useUndoRedo, type UndoRedoAdapter, type UseUndoRedoOptions } from 'interactions/actions/undo-redo/undoRedo';
import { defineTool, claim, none } from '../routing';
import type { Tool } from '../types';

export interface UseUndoRedoToolOptions extends UseUndoRedoOptions {}

/** Always-on Tool wrapping `useUndoRedo`. Handles Mod+Z (undo) and
 *  Mod+Shift+Z (redo); treats `meta` and `ctrl` interchangeably for
 *  cross-platform support. The legacy hook's document keybinding is
 *  suppressed by passing `bindKeyboard: false`. */
export function useUndoRedoTool(
  adapter: UndoRedoAdapter,
  options: UseUndoRedoToolOptions = {},
): Tool<undefined> {
  const ctl = useUndoRedo(adapter, { ...options, bindKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'undoRedo',
        initial: {
          keyDown: {
            z: (_ctx, event) => {
              const e = event as KeyboardEvent;
              if (!(e.metaKey || e.ctrlKey)) return none();
              if (e.shiftKey) ctl.redo();
              else ctl.undo();
              return claim();
            },
            Z: (_ctx, event) => {
              const e = event as KeyboardEvent;
              if (!(e.metaKey || e.ctrlKey)) return none();
              // Shift is implicit (the key is uppercase Z), but check
              // anyway so a stray IME event with Z and no Shift doesn't
              // misfire redo.
              if (!e.shiftKey) return none();
              ctl.redo();
              return claim();
            },
          },
        },
      }),
    [ctl],
  );
}
```

Notes:
- The legacy code did `e.key.toLowerCase() !== 'z'`, so it accepted both `'z'` and `'Z'`. The declarative table keys on the exact `KeyboardEvent.key` value, so both forms get their own entries: `'z'` for plain Mod+Z (undo), `'Z'` for Mod+Shift+Z (redo). Both go through identical Mod gating.
- The `Z` entry is the redo path; the `z` entry handles undo (Shift not held) but also dispatches redo on the theoretical `z` + Shift combo for symmetry with the legacy code. In practice browsers report `'Z'` when Shift is held with `z`, so the redo branch in the `z` entry is defensive.
- Returning `none()` when Mod is absent lets a plain Z keystroke (e.g. a tool keybinding) reach the next ambient slot or the active-tool keyboard channel.

- [ ] **Step 2: Run the tool's test file**

```bash
npx vitest run src/tools/builtin/useUndoRedoTool.test.ts
```

All assertions pass. The existing tests cover Mod+Z (undo), Mod+Shift+Z (redo), and the no-Mod pass-through; verify each.

- [ ] **Step 3: Run the full kit suite**

```bash
npx vitest run
```

Baseline holds.

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/useUndoRedoTool.ts
git commit -m "refactor(useUndoRedoTool): migrate to declarative routing factory"
```

---

## Task 4: Migrate `useNudgeTool`

**Files:**

- Modify: `src/tools/builtin/useNudgeTool.ts`

Four arrow keys, each mapped to a direction; Shift toggles large-step. The legacy code uses a `KEY_TO_DIR` lookup table that becomes redundant once each arrow is its own route entry.

- [ ] **Step 1: Swap the import and rewrite the body**

Replace the file contents with:

```ts
import { useMemo } from 'react';
import { useNudge, type NudgeAdapter, type UseNudgeOptions } from 'interactions/actions/nudge/nudge';
import { defineTool, claim } from '../routing';
import type { Tool } from '../types';

export interface UseNudgeToolOptions<TPose> extends UseNudgeOptions<TPose> {}

/** Always-on Tool wrapping `useNudge`. Handles ArrowUp/Down/Left/Right via
 *  declarative keyDown routes (fired on every ambient-slot tool). Reads
 *  `e.shiftKey` for large-step. The legacy hook's document-level keybinding
 *  is suppressed via `enableKeyboard: false`. */
export function useNudgeTool<TPose>(
  adapter: NudgeAdapter<TPose>,
  options: UseNudgeToolOptions<TPose> = {},
): Tool<undefined> {
  const ctl = useNudge(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'nudge',
        initial: {
          keyDown: {
            ArrowUp: (_ctx, event) => {
              ctl.nudge('up', (event as KeyboardEvent).shiftKey);
              return claim();
            },
            ArrowDown: (_ctx, event) => {
              ctl.nudge('down', (event as KeyboardEvent).shiftKey);
              return claim();
            },
            ArrowLeft: (_ctx, event) => {
              ctl.nudge('left', (event as KeyboardEvent).shiftKey);
              return claim();
            },
            ArrowRight: (_ctx, event) => {
              ctl.nudge('right', (event as KeyboardEvent).shiftKey);
              return claim();
            },
          },
        },
      }),
    [ctl],
  );
}
```

Notes:
- The four arrow keys always claim, matching the legacy "always handle, ignore non-arrow keys" semantics. Non-arrow keys aren't in the table, so the routing factory's `buildKeyHandler` returns `'pass'` for them — same outcome as the legacy `if (!dir) return 'pass'`.
- The legacy `KEY_TO_DIR` const is gone; each direction is inlined in its route, which reads more directly even though it's four near-identical entries. The alternative (one shared `nudge` action keyed by the four arrows pointing to it) requires reverse-mapping `e.key` back to a direction inside the action — net less clear than four lines.

- [ ] **Step 2: Run the tool's test file**

```bash
npx vitest run src/tools/builtin/useNudgeTool.test.ts
```

All assertions pass. The existing tests cover each arrow direction and the Shift large-step behavior.

- [ ] **Step 3: Run the full kit suite**

```bash
npx vitest run
```

Baseline holds.

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/useNudgeTool.ts
git commit -m "refactor(useNudgeTool): migrate to declarative routing factory"
```

---

## Task 5: Final verification — full prepublishOnly gate

After all four tools have migrated and committed individually, run the release gate end-to-end. This matches CI and catches anything `vitest` alone misses (TypeScript-only errors in production code paths that the test files don't import directly).

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

Zero errors. If any tool's migration introduced a type narrowing issue (e.g. forgetting the `as KeyboardEvent` cast), it surfaces here.

- [ ] **Step 2: Full test run**

```bash
npx vitest run
```

Same pass/fail count as the pre-Phase-5a baseline (captured at the start of Task 1's full-suite run).

- [ ] **Step 3: Production build**

```bash
npx tsup build
```

Build succeeds. `dist/` artifacts contain the migrated tool entry points.

- [ ] **Step 4: Sanity check the imperative `defineTool` is still used elsewhere**

```bash
grep -rn "from '../defineTool'" src/tools/builtin/
```

Expected matches: `defineDragInsertTool.ts` and the tools that consume it (insert/ellipse/line/polygon/star/pencil/text). The four 5a tools should be absent from this list — if any still import from `../defineTool`, that tool's migration was incomplete.

- [ ] **Step 5: Update the routing spec's "migration status" section, if present**

Open `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md` and check whether it tracks a per-tool migration status table. If so, mark `useDeleteTool`, `useNudgeTool`, `useDuplicateTool`, `useUndoRedoTool` as migrated and note Phase 5a's completion date. If no such table exists, skip this step — the commit history is the source of truth.

---

## What Phase 5b will pick up

For continuity, the 5b plan should cover (in approximate order of complexity):

1. **`useInsertTool` and `defineDragInsertTool`** — requires the routing factory to start emitting `phase.overlay` onto the returned `Tool.overlay`, and a port of the `controller.start/move/end/cancel` lifecycle into the `BeginSpec` shape. Once `defineDragInsertTool` is on the declarative factory, every shape tool that consumes it (`useEllipseTool`, `useLineTool`, `usePolygonTool`, `useStarTool`, `usePencilTool`) inherits the migration for free.
2. **`useLassoTool`** — polygon-drawing gesture; depends on whether its drag flow is a single drag route or a multi-segment scratch accumulator.
3. **`useUserTextTool` / `useTextTool`** — modal text-edit state; the engaged phase needs to suppress all pointer routing during edit.
4. **`useUserPenTool`** — modal `claimsAll`, multi-mode anchor editing. The hardest migration in the suite; expect to use every route surface (pointerDown, click, drag, dblTap, keyDown) and both phases (initial vs. engaged with `claimsAll: true`).

Each of those is a separate task in its own right; Phase 5b should plan them with the same rigor as 5a (per-tool task, per-tool test run, per-tool commit).
