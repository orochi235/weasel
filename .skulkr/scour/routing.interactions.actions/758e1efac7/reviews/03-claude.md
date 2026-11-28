## An action without `requires` gets the legacy dep bag from `trigger`/menus but an empty bag from the dispatcher
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:47 (depsFor)
- scenario: register an action with no `requires` whose `enabled` and `run` read `deps.selection`. Fired from a menu, palette or `registry.trigger`, `depsFor` hands it `{ selection, scene, history, view, activeTool, booleansAdapter }`, so it shows enabled and runs. Fired by its own key binding, the dispatcher's walk (`dispatcher/walk.ts:176`) builds the bag with `createActionDeps`, which gives `requires ?? []`, an empty bag. In dev the Proxy throws on `deps.selection`, so `enabled` reads `predicate-threw` and the key does nothing. In prod `selection` is undefined. The same action is enabled in the menu and dead on its shortcut. `lastOperationHost.admits`/`rerun` and `menuHost.depsFor` also go through `depsFor`, so the last-operation panel judges such an action under a bag that the gesture path never gives it. `buildDeps.ts`'s header says `createActionDeps` is "the single implementation behind both the gesture dispatcher's per-invocation buildDeps and ActionsRegistry.trigger", and the walk's comment says the bag is "Shared with ActionsRegistry.trigger". Both statements are false for an action with no `requires`.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/actions/ActionsProvider.tsx, packages/routing/src/interactions/actions/buildDeps.ts
- size: function
- cause: two dep-bag rules, legacy fallback only on the registry path
- confidence: sure

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

<!-- done: 1 findings, files read: 36 -->
