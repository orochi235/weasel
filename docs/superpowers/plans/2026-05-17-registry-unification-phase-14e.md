# Registry unification — Phase 14e: legacy deletion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bulk-delete the now-orphaned legacy plumbing that the registry unification was designed to replace. After this lands there is exactly one path for an interaction to fire: GestureSpec → matched binding → Action invoker.

**Architecture:** Pure deletion. No new abstractions, no renames (those are Phase 14f). Each deletion is gated on "nothing references this anymore" via grep — if grep finds callers, fix or defer that specific deletion. Don't half-delete and leave dead exports.

**Tech Stack:** TypeScript. Build on Phases 1–14d.

---

## Prerequisites

- Phases 14a, 14b, 14c.1, 14c.2, 14d must have shipped. Specifically: every consumer that used to fire actions through the legacy hooks must already route through `Tool.bindings`.
- Phase 14c.3 does NOT need to ship first — its per-kind geometry work is independent.
- Smoke tests at `src/canvas/SceneCanvas.smoke.test.tsx` should be at 12/13 or 13/13 passing (BUG-skipped tests fixed by the dispatcher-fallthrough work).

## Deletion targets

Each is its own task. Each task: grep for references → if zero, delete; if non-zero, either fix the consumer in the same commit or document why deletion can't happen yet (and skip the task).

### Task 1: Delete legacy gesture hooks

Files to delete entirely:

- `src/interactions/useMove.ts`
- `src/interactions/useResize.ts`
- `src/interactions/useRotate.ts`
- `src/interactions/useAreaSelect.ts`
- `src/interactions/useInsert.ts`
- `src/interactions/useClone.ts`
- `src/interactions/useLassoSelect.ts`
- `src/interactions/useEditAnchors.ts`

(Verify exact paths — some may live under `src/interactions/hooks/` or similar.)

For each: `grep -rn "useMove\|from .*useMove" src/ apps/ packages/ demo/`. If zero hits outside the file itself, delete file + its barrel re-export from `src/index.ts`.

If a tool still imports a legacy hook, that tool didn't get migrated. Either migrate it now (small) or skip the deletion (with a TODO citing the unmigrated tool).

### Task 2: Delete the singular `useKeybinding`

Old singular hook (one binding per call site). Superseded by `useKeybindings` (plural, registry-driven). File: `src/tools/useKeybinding.ts` (verify path).

Grep for callers. Should be zero after Phase 14c.

### Task 3: Delete `DispatcherPresenceProvider` + `withLegacyRunBridge`

Both were Phase-7-era scaffolding for the legacy/new dispatcher coexistence. After all tools use the new dispatcher there's no presence to gate on.

Files (verify):
- `src/interactions/dispatcher/dispatcherPresence.tsx`
- The `withLegacyRunBridge` HOC — likely in `src/interactions/actions/` somewhere.

Grep for both names. Remove the providers from `SceneCanvas.tsx`'s auto-mount tree.

### Task 4: Delete `Action.run`

The legacy synchronous-invocation field on `Action`. Superseded by `Action.invoker`.

In `src/interactions/actions/registry.tsx`:
- Remove the `run?: ...` field from the `Action` type.
- Remove any registry code paths that consult `action.run`.

Grep for `.run(` and `action.run` to find stragglers. Most callers should already use `action.invoker.run` or `dispatcher.fire(action, ...)`.

### Task 5: Delete legacy `Action.defaultBinding: KeyBinding`

The pre-unification typed-key-binding field. Currently coexists with `Action.gestureBinding` (the GestureSpec-typed field added in Phase 4 T4).

In `src/interactions/actions/registry.tsx`:
- Remove the `defaultBinding?: KeyBinding` field (the legacy one).
- The new `gestureBinding?: GestureSpec` field stays — Phase 14f will rename it back to `defaultBinding`.

Grep for `defaultBinding`. Any descriptor that still sets it with a KeyBinding shape needs to migrate to `gestureBinding` with a GestureSpec.

If `KeyBinding` is no longer referenced after this, delete its type too.

### Task 6: Clean up `useSelectTool`'s dead route entries

useSelectTool kept route-table entries for click/dblTap during Phase 14a (only drag-on-empty's `clearSelection` migrated to bindings). After 14b–14d migrate the rest, useSelectTool's `routes` table should be empty or close to it.

Inspect `src/tools/builtin/useSelectTool/useSelectTool.ts`:
- Delete the `routes` field entirely if empty.
- Delete `bindingsOverrideDrag` and `bindingsOverrideClick` flags if no route-table entries remain to suppress.

### Task 7: Tidy `Tool.bindingsOverride*` flags

If after Task 6 no tool sets `bindingsOverrideDrag` or `bindingsOverrideClick`, delete the flags from `src/tools/types.ts` and any dispatcher code that consults them.

### Task 8: Verify + commit

- `npm run prepublishOnly` green (tsc + vitest + tsup + build:demo).
- Single commit per task, or one bulk commit per related deletion group (legacy hooks together, legacy plumbing together) — your call based on what's easier to review.
- Update `docs/TODO.md`: close out the "delete legacy hooks" line item.

## Done criteria

- All eight deletion targets either deleted, or explicitly skipped with a documented reason.
- `grep -rn "useMove\|useResize\|useRotate\|useAreaSelect\|useInsert\|useClone\|useLassoSelect\|useEditAnchors\|useKeybinding\|DispatcherPresenceProvider\|withLegacyRunBridge\|action\\.run" src/ apps/ packages/ demo/` returns nothing.
- `grep -n "defaultBinding" src/interactions/actions/registry.tsx` returns nothing (the field is gone; the gestureBinding-to-defaultBinding rename is Phase 14f).
- All tests pass; tsc clean; build:demo green.
- Unblocks Phase 14f.

## Risks

- **Missed consumer.** A deletion looks safe by grep but breaks at runtime because the consumer path isn't covered by any test. Mitigation: run `npm run build:demo` after each task — the demo app exercises most tool paths in a real React tree.
- **Branded type dependencies.** Some legacy hooks may export types or branded-type helpers that are still used. Don't delete types blindly — grep for type-only imports too (`import type { X } from`).
- **Storybook stories.** Stories at `*.stories.tsx` may import legacy hooks for setup. Run `npm run test:stories` (browser test) at the end as a final sanity gate before declaring done.

## What's next

Phase 14f: rename `gestureBinding → defaultBinding` kit-wide now that the legacy field is gone.
