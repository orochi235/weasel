## A kept run writes its resolved values as session params even when nothing was adjusted, masking an `under` tuning's later values
- where: packages/routing/src/interactions/actions/lastOperation.ts:286 (LastOperationKeeper.hold → remember)
- scenario: An action declares `params` with leaf `width` (default 1). A host tunes it `{ under: true, params: () => store.width }` with no `keep`, the way the `under` JSDoc describes tool options. store.width = 5, and the user runs the action once. `hold` calls `remember(id, values)` with `{ width: 5 }` (and every other leaf filled from its default). The user then sets store.width = 10. `tuningsOf` lays the session tuning above the `under` tuning (`underFirst`), so the next run, and every one after, gets width 5. The `LastOperationStore.adjust` doc says values "become its params for the rest of the session" only on an adjust; a plain run should leave the session empty. The same write also makes a binding with no params resolve to the last variant's values in `invokedParams`, so `actionShortcuts` moves a plain key's chip to whichever variant ran last.
- evidence: read
- severity: medium

## A UI-begun gesture kept as last operation ignores `ctx.params`, so the panel shows, and replay receives, the wrong values
- where: packages/routing/src/interactions/actions/lastOperation.ts:265 (LastOperationKeeper.ongoing, `ended`)
- scenario: `ActionsRegistry.begin(id, { opacity: 0.3 })` starts an ongoing action that declares `params` and whose handle can `replay`. The dispatcher puts the params on `ctx.params`, not on `opts.params`. At commit, `resolved` is built from `host.paramsOf(id, resolveParams(opts?.params))` plus `handle.params?.()`, and the begun params are never included. Unless the handle restates them through `params()`, the form shows the tuning or default value (not 0.3), and an adjust replays with those values, which differ from what the commit used. It should lay `ctx.params` (the start's, or the latest update's) under `handle.params()`.
- evidence: read
- severity: low

## Adjusting a gesture operation replays it even after its action is unregistered, muted or refused
- where: packages/routing/src/interactions/actions/lastOperation.ts:276 (LastOperationKeeper.ongoing, `rerun`)
- scenario: A drag of action X commits and is kept. X is then muted in that scope, or unregistered, or its `enabled` starts refusing. `adjust(patch)` undoes the entry and calls `replay` on the stale handle, and `rerun` returns `true` unconditionally. So the edit is recommitted through an action that no longer applies. The immediate path refuses in this case (`LastOperationHost.rerun` resolves, checks `eligible` and `enabled`, and returns false), and `adjust`'s comment says "an action gone, refusing or throwing since leaves the operation as it was". The two paths answer that question differently.
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

<!-- done: 3 findings, files read: 35 -->
