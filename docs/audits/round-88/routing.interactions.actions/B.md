# Audit round 88 — routing.interactions.actions (blind reviewer)

## Last operation reads and writes a nested `params` form's values by dotted path as one flat key
- where: packages/routing/src/interactions/actions/lastOperation.ts:122 (formValues), :262/:310 (wrap/ongoing rerun), :327 (remember)
- scenario: `prefLeaves` names a leaf inside a group by its dotted path (`stroke.width`, prefs-schema/src/helpers.ts:225). `formValues` reads `getOwn(params, 'stroke.width')`, a flat own key, so a run whose params are `{ stroke: { width: 4 } }` is recorded as the leaf's default, not 4; the panel shows the wrong value. An adjust then reruns with `{ ...rest, 'stroke.width': v }` and `remember` stores `{ 'stroke.width': v }` as the session tuning, so the invoker, which reads `params.stroke.width`, never sees the panel's change, while `without(given, values)` keeps the original nested `stroke` in `rest`, so the rerun repeats the old value. Should read and write nested values through the paths (`assignPrefValueAt`-style), or restrict forms to flat groups and say so.
- evidence: read (prefLeaves path format and getOwn/setOwn checked); no nested-form action located, so whether a shipped action hits it is unverified
- severity: medium

## A hold's release runs the held action outside any catch, unlike every other run path
- where: packages/routing/src/interactions/actions/holdPreview.ts:68 (holding → onEnd)
- scenario: a `holdPreview` hold of an action whose `run` throws: on key release `invoker.run(ctx.deps, now)` throws out of `onEnd` into the dispatcher's end path, whereas `ActionsRegistry.trigger` (ActionsProvider.tsx:303) catches and logs the same throw. `hide()` has already run, but whatever the dispatcher does after `onEnd` (clearing the in-flight gesture, notifying) depends on its own guard rather than this one. Wrap the run as `trigger` does.
- evidence: read
- severity: low

## `<ActionsProvider>` never tears its root node down, so a held last operation keeps observing history after unmount
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:357 (ActionsProvider)
- scenario: a canvas registered directly under `<ActionsProvider>` (no `<InputScope>`) runs an action with a `params` form; `LastOperationKeeper.hold` subscribes to the history (lastOperation.ts:315). Scope nodes release this in `ActionsNode.mount`'s leave (`hostLeft`), but the root node is never mounted or left: when the provider unmounts while a history that outlives it (app-held) stays, the observer closure and the whole node tree stay reachable from the history, and the next edit calls `dismiss` on a dead keeper. Needs an unmount effect that dismisses the root keeper.
- evidence: read
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

<!-- done: 3 findings, files read: 36 -->
