# Actions Registry — Done

**Plan:** [`2026-05-09-actions-registry.md`](./2026-05-09-actions-registry.md)
**Spec:** [`../specs/2026-05-09-actions-registry-design.md`](../specs/2026-05-09-actions-registry-design.md)
**Date completed:** 2026-05-09

## What shipped

- New `<ActionsProvider>` + `useActionsRegistry()` + `useAction()` exported
  from `@orochi235/weasel` under `@experimental`. One `keydown` listener per
  provider scope; first-registered-wins overlap, last-registered-wins on id;
  cleanup is last-writer-protected so a stale unmount can't clobber a later
  registrant. Frozen `list()` snapshots.
- Five default action factories (`defaultSelectAllAction`,
  `defaultEscapeAction`, `defaultDuplicateAction`, `defaultNudgeActions` →
  8 directional actions, `defaultReorderActions` → forward + backward)
  exported from the public barrel. Used by `<SceneCanvas>` to auto-register
  defaults from its scene + selection + adapter.
- New `<SceneCanvas>` props (both `@experimental`):
  - `actions?: ActionsProp` — `null` to disable all defaults; otherwise a
    record of `{ id → entry }` for partial override / disable / extension.
  - `actionDefaults?: { cloneNode, duplicateOffset, nudgeStep,
    nudgeShiftStep }` for inputs the kit can't synthesize. `cloneNode`
    gates the duplicate default — when omitted, duplicate is silently
    dropped from the registered set.
- Auto-mount: when no parent `<ActionsProvider>` is in scope, SceneCanvas
  wraps its own children in one. With a parent in scope, it skips the inner
  provider and registers into the parent. Children prop accepted on
  SceneCanvas for siblings that share the scope.
- Standalone hooks (`useSelectAll`, `useEscape`, `useDuplicate`, `useNudge`,
  `useReorder`) refactored: register into a parent provider when one is in
  scope; fall back to direct `useKeybinding` otherwise. Public signatures
  unchanged. `useReorder`'s front/back variants stay always-on via
  `useKeybinding` (single-binding-per-Action limit in v1).
- `MultiSelectDemo` migrated — redundant `useSelectAll` call deleted; the
  SceneCanvas auto-default registers Cmd/Ctrl+A. Other demos use bare
  `<Canvas>` and require no migration (the hooks' fallback path handles
  them).

## Notable deviations from plan

- The plan's `registry.test.ts` was created as `registry.test.tsx` (the
  test contents include JSX so the `.tsx` extension is required).
  Provider-back-compat tests for the existing hooks similarly live in
  `*.provider.test.tsx` files alongside the original `.test.ts` files.
- `useReorder`'s registry path goes through `defaultReorderActions` and
  routes through the adapter's `applyBatch` after a feature-flag check
  (`getChildren && setChildOrder`) so a partial adapter behaves identically
  to the standalone-keybinding path. The plan suggested re-using
  `defaultReorderActions` directly; the implementation respects the
  hook's existing `filter` option and feature-availability checks.
- The plan's `applyEntry` partial-vs-full handling needed a small refinement:
  when the entry has a complete `{id, label, run}` shape but its `id`
  mismatches the slot key, we treat it as a partial (drop the `id` field,
  merge onto the default, warn-once). This keeps id/slot consistency and
  satisfies spec §D's "warn-once and ignore the id field" rule for the
  edge case where a full descriptor is supplied with a wrong id.
- `<SceneCanvas>`'s `Probe`-style test components needed `useEffect` to
  observe registry state — the registrars' `useAction` effect runs at the
  same commit, so a synchronous read during render sees the empty
  registry. All probes in `SceneCanvas.actions.test.tsx` capture inside
  `useEffect`, and probes that need to assert across `<SceneCanvas>` mounts
  are placed *after* the SceneCanvas in JSX so their effects fire after
  the SceneCanvas subtree's effects.
- `ActionsDemo` was NOT migrated — it uses bare `<Canvas>` (not
  `<SceneCanvas>`) by design, as a reference for the standalone-hook flow.
  The plan's instruction to convert it would have required a substantial
  Canvas → SceneCanvas restructure outside the scope of this plan.

## Test results

- Vitest: **1569/1569 pass** (baseline 1477 → +92 net new tests). Far
  exceeds the plan's ≥40-net-new floor.
- Playwright (weasel-gl smoke): 17/17 pass. No GL changes; this was
  expected.
- Typecheck: clean (only pre-existing `BezierEditDemo` and `weasel-gl/draw`
  warnings remain, unchanged from baseline).

## Lessons for future steps

- React effect-order is determined by the commit traversal — child
  effects fire before parent, and among siblings, the FIRST sibling's
  subtree completes effects before the second's begins. Probe components
  testing registry state must be placed AFTER the registering component
  in JSX, not before, even when both are siblings of the same provider.
- `Object.freeze` on the cached `list()` snapshot is a cheap way to make
  "internal state isn't mutated by snapshot mutation" testable and
  enforced — strict-mode push throws and the test's catch-block swallows
  it cleanly.
- The `last-writer-protected` cleanup pattern in `register` (only delete
  if the current map entry is still our action) is essential for any
  registry that mutates by id; without it, a stale unmount silently
  destroys a later registrant's work.

## Open follow-ups

- **Per-scope focus dispatch.** v1 ships document-level dispatch — when
  multiple SceneCanvases live on a page and the user presses Cmd+A,
  whichever provider's listener was attached first wins. Spec §risks
  documents the limitation; future refinement is per-scope focus.
- **Front/back reorder variants as default actions.** Shift+Mod+] and
  Shift+Mod+[ collide with `reorder.forward` / `reorder.backward` under
  v1's single-binding-per-Action model. They stay on the standalone
  `useReorder` hook's always-on `useKeybinding` path until v2 adds
  multi-binding-per-Action.
- **Command palette / shortcuts overlay.** `useActionsRegistry().list()`
  exposes the live action set; building a UI that renders it is consumer
  work, but a reference component would help adoption.
- **`KeyBinding` type unification.** The registry currently re-exports
  the type from `useKeybinding`. If the two diverge in v2 (e.g. registry
  gains chord support), they need to decouple cleanly.
- **`ActionsDemo` migration to `<SceneCanvas>`.** Currently a bare-Canvas
  reference; if a future cleanup wants to align all demos on SceneCanvas,
  ActionsDemo would shift to the auto-defaults pattern with `actions`
  prop overrides. Not blocking.
