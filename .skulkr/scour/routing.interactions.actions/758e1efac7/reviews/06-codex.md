# Review saturation for routing.interactions.actions

Snapshot: 758e1efac7f7b00b7fbbcf6a13741249d6c3640f

Scope: 36 files from `/private/tmp/skulkr-saturation/lists/routing.interactions.actions.txt`. The checkout was detached at the snapshot with a clean working tree. Adjacent callers and tests supplied context. The passes shared context and deduplicated findings by root cause.

## Pass ledger

| Pass | Focus | New | Cumulative | Consecutive zero |
| --- | --- | ---: | ---: | ---: |
| 1 | Source contracts, item identity, owner stacks, and handle wrappers | 3 | 3 | 0 |
| 2 | Registry dispatch, held-key gates, and UI edit lifecycle | 3 | 6 | 0 |
| 3 | History replay, tuning precedence, and invocation parameter capture | 1 | 7 | 0 |
| 4 | Shortcut projection and mixed modifier/letter bindings | 2 | 9 | 0 |
| 5 | Dep layering, rank propagation, magic keys, and source release | 0 | 9 | 1 |
| 6 | Binding override IDs, precedence, parsing failures, and owner-channel rejection | 0 | 9 | 2 |
| 7 | Settings and overlay fallback, refusal delivery, and selection restoration on a refused replay | 0 | 9 | 3 |

Stopped after three consecutive completed passes yielded zero new distinct findings.

## Findings index

| ID | Severity | Evidence | Finding |
| --- | --- | --- | --- |
| RIA-01 | Medium | Source trace | A variant key can resolve to a different action |
| RIA-02 | Medium | Source trace | Releasing a reused owner can change the winning tuning |
| RIA-03 | Medium | Runtime probe | Wrapping a frozen handle throws on method access |
| RIA-04 | Medium | Source trace | Held-key preview and release ask the gate with different routing facts |
| RIA-05 | Medium | Source trace | A control can send a new action's input to its previous action |
| RIA-06 | Medium | Source trace | An inherited dispatcher can start a different action from the one admitted |
| RIA-07 | Medium | Source trace | Adjusting an immediate operation rereads undisplayed tuning params |
| RIA-08 | Low | Source trace | A mixed held-key alias permits browser chords for the letter alias |
| RIA-09 | Low | Source trace | Shortcut lookup evaluates params for gestures it cannot display |

## RIA-01 — A variant key can resolve to a different action

- where: packages/routing/src/interactions/actions/actionItems.ts:41 (`actionItems`)
- scenario: Register immediate action `align` with variant key `left`, and a separate immediate action named `align:left`. Both ids pass `validateActionId` and both entries receive key `align:left`. A menu saved with that variant key resolves the exact action id first in `packages/routing/src/menus/resolveMenu.ts:139`, so it runs the separate action. The generated key should identify its original entry uniquely, as required by the `ActionItem.key` contract.
- evidence: source trace
- severity: medium

## RIA-02 — Releasing a reused owner can change the winning tuning

- where: packages/routing/src/interactions/actions/scopeNode.ts:123 (`pushOwner`)
- scenario: Register three tunings for one id with `registry.tune`, using the same object A for the first and third registrations and a distinct object B in the middle. Give A and B different defaults for the same param. Release the first registration. `lastIndexOf(A)` removes the third slot and leaves A then B, so B wins. Releasing the first registration should leave B then A and keep A's value.
- evidence: source trace through `ActionsProvider.tsx:267` and `tuning.ts:170`
- severity: medium

## RIA-03 — Wrapping a frozen handle throws on method access

- where: packages/routing/src/interactions/actions/handleWith.ts:11 (`handleWith`)
- scenario: An ongoing action returns `Object.freeze({ onMove() {}, onEnd() {} })`. Add a param tuning, which wraps this handle through `tuning.ts:82`. The proxy substitutes a different function for a non-configurable, non-writable own property, so the dispatcher's `isEmptyOngoingHandle` throws on the first method read. The tuned handle should retain callable move and end hooks.
- evidence: runtime probe imported the snapshot's `handleWith.ts` in Node and read `onMove` on the wrapped frozen object. Node returned a proxy invariant `TypeError`. The dispatcher entry path was traced in source.
- severity: medium

## RIA-04 — Held-key preview and release ask the gate with different routing facts

- where: packages/routing/src/interactions/actions/holdPreview.ts:58 (`holding`, also line 67)
- scenario: Bind an immediate action's hold to a key in a view named `detail`. The action's `enabled` returns true only when its fifth argument is `detail`. The dispatcher admits the key using that view. The hold calls `showPreview` and later `checkEnabled` without the view id, so it shows nothing and executes nothing on release. Likewise, a predicate accepting a missing key position can reject the fabricated origin that the hold reads from `ctx.world`. Preview and release should preserve the held key's view and lack of a world point while checking the latest params.
- evidence: source trace through `dispatcher/walk.ts:179`, `dispatcher/invocationCtx.ts:125`, and `actionEnabled.ts:78`
- severity: medium

## RIA-05 — A control can send a new action's input to its previous action

- where: packages/routing/src/interactions/actions/useOngoingAction.ts:56 (`drive`)
- scenario: Open ongoing action A with `input`. Change the hook argument to B and call `edit.input` for B from a layout effect on that commit. The latest id is already B, but the passive effect at line 74 has yet to commit A. `drive` sees A's active control and sends B's params to it. A then commits and B never opens. An id change should commit A at its existing value and send the new input to B.
- evidence: source trace through `packages/react/src/useLatest.ts` and the hook's effect and control ordering
- severity: medium

## RIA-06 — An inherited dispatcher can start a different action from the one admitted

- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:327 (`registry.begin`)
- scenario: Wire a parent scope's dispatcher with `getAction` reading that scope's registry, as the canvas does. Nest an `InputScope` with no dispatcher and register a different ongoing implementation at the same id in the child. Call `begin` through the child. It resolves and admits the child's action, then finds the parent's dispatcher at line 221. The dispatcher resolves the id anew against the parent, starts the parent's implementation with child deps, and skips the parent's gate. The invocation should use the same descriptor it admitted, or decline when the dispatcher cannot drive it.
- evidence: source trace through `dispatcher/uiOngoing.ts:73` and `packages/core/src/canvas/SceneCanvas/useCanvasDispatcher.ts:29`
- severity: medium

## RIA-07 — Adjusting an immediate operation rereads undisplayed tuning params

- where: packages/routing/src/interactions/actions/lastOperation.ts:275 (`LastOperationKeeper.wrap`)
- scenario: Tune an immediate action with a thunk supplying `{ axis: 'x' }`, declare a last-operation form exposing only `distance`, and trigger it without explicit params. After its one history entry, change the thunk to return `{ axis: 'y' }` without editing history. Adjust `distance` in the panel. The keeper undoes the original and replays with the original call's raw `given` plus the form values, so the current tuning changes the axis to y. It should preserve the resolved x and apply only the distance adjustment. The ongoing replay path already captures its resolved params.
- evidence: source trace through lines 265–275 and 309–318 and the tuned immediate invoker in `tuning.ts:75`
- severity: medium

## RIA-08 — A mixed held-key alias permits browser chords for the letter alias

- where: packages/routing/src/interactions/actions/toolOffhand.ts:56 (`heldKeySpec`)
- scenario: Use `buildToolOffhandBindings([{ toolId: 'hand', key: ['Shift', 'k'] }])` and press Ctrl+K or Cmd+K while the canvas holds keys. The array's Shift entry makes every modifier optional for the whole spec, so the letter alias starts the offhand tool and the keyboard channel prevents the browser default. Letter triggers should leave Ctrl and Cmd chords alone, as the helper's contract states.
- evidence: source trace through `packages/gestures/src/ui/match.ts` and `dispatcher/channels/keyboard.ts:146`
- severity: low

## RIA-09 — Shortcut lookup evaluates params for gestures it cannot display

- where: packages/routing/src/interactions/actions/actionShortcuts.ts:76 (`bindingShortcuts`)
- scenario: Give an immediate action a variant and both a keyboard binding and a pointer binding whose params thunk reads state set up by a pointer interaction. Open a surface which calls `actionItemShortcuts` for the variant before any pointer interaction. The pointer thunk runs before the code checks whether the spec has a shortcut, so a thunk that requires that state can throw and interrupt shortcut rendering. Even a counting thunk runs unnecessarily. Shortcut lookup should skip bindings without a displayable shortcut before resolving their params.
- evidence: source trace through lines 74–78 and 91; no browser run
- severity: low

## Files read

packages/routing/src/interactions/actions/ActionsProvider.tsx
packages/routing/src/interactions/actions/action.ts
packages/routing/src/interactions/actions/actionEnabled.ts
packages/routing/src/interactions/actions/actionIcon.typetest.ts
packages/routing/src/interactions/actions/actionIds.ts
packages/routing/src/interactions/actions/actionItems.ts
packages/routing/src/interactions/actions/actionSettings.ts
packages/routing/src/interactions/actions/actionShortcuts.ts
packages/routing/src/interactions/actions/actionTags.ts
packages/routing/src/interactions/actions/activeToolContext.tsx
packages/routing/src/interactions/actions/betweenGestures.ts
packages/routing/src/interactions/actions/binding.ts
packages/routing/src/interactions/actions/bindingOpts.ts
packages/routing/src/interactions/actions/bindingOverrides.ts
packages/routing/src/interactions/actions/buildDeps.ts
packages/routing/src/interactions/actions/defineAction.ts
packages/routing/src/interactions/actions/depNode.ts
packages/routing/src/interactions/actions/depRegistry.tsx
packages/routing/src/interactions/actions/handleWith.ts
packages/routing/src/interactions/actions/holdPreview.ts
packages/routing/src/interactions/actions/inputScope.tsx
packages/routing/src/interactions/actions/invoker.ts
packages/routing/src/interactions/actions/keyOrder.ts
packages/routing/src/interactions/actions/lastOperation.ts
packages/routing/src/interactions/actions/modifierRoles.ts
packages/routing/src/interactions/actions/overlay.ts
packages/routing/src/interactions/actions/refusal.ts
packages/routing/src/interactions/actions/registry.ts
packages/routing/src/interactions/actions/scopeNode.ts
packages/routing/src/interactions/actions/showPreview.ts
packages/routing/src/interactions/actions/toolOffhand.ts
packages/routing/src/interactions/actions/tunedForm.ts
packages/routing/src/interactions/actions/tuning.ts
packages/routing/src/interactions/actions/useCommand.ts
packages/routing/src/interactions/actions/useLastOperation.ts
packages/routing/src/interactions/actions/useOngoingAction.ts

<!-- done: 9 findings, files read: 36 -->
