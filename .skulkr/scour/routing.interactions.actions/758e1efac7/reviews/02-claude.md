## An action with no `requires` gets the legacy fixed dep bag from `trigger`/menus/preview/last-operation, but an empty bag from the dispatcher
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:47 (depsFor)
- scenario: register an action with no `requires` whose `run` reads `deps.selection`. `registry.trigger(id)` (and a menu row, `preview`, `begin`, and the last-operation rerun/admits, all through `depsFor`) hands it `{selection, scene, history, view, activeTool, booleansAdapter}`, so it works. The same action reached by its key binding goes through `walk.ts:176`, which always calls `createActionDeps`, so it gets `{}` — in dev, a Proxy that throws on the read of `selection`; in prod, `undefined`. Its `enabled` also answers differently in the two paths (enabled from a palette, disabled or throwing on its key). One question, which deps an action without `requires` gets, has two answers.
- evidence: read (ActionsProvider.tsx depsFor; dispatcher/walk.ts:176 and channels/dropPreview.ts:51 use createActionDeps unconditionally)
- severity: medium
- fix: packages/routing/src/interactions/actions/ActionsProvider.tsx, packages/routing/src/interactions/dispatcher/walk.ts
- size: function
- cause: legacy bag kept on one path only
- confidence: sure

## The last-operation wrapper seals the history after an ongoing action's `start`, not before, so an edit `start` makes stops coalescing with the gesture's later ones
- where: packages/routing/src/interactions/actions/lastOperation.ts:283 (LastOperationKeeper.ongoing)
- scenario: an ongoing action that declares `params` and whose handle has `replay`, and whose `start` writes its first edit straight to the history (no journal) with later moves coalescing into it. `invoker.start(ctx, opts)` runs first, then `watchEntry(stack)` calls `stack.seal()`, so the moves' edits can no longer coalesce into the entry `start` pushed: one gesture leaves two undo entries only because a history is present and the action declares `params`. The watch also never saw that first push, so the later coalesce or push marks it unclean and the operation is not kept either. The immediate path (`wrap`) seals before running; the ongoing path should seal before `start` too (the stack is already read before `start`).
- evidence: read
- severity: low
- size: line
- cause: seal ordered after start
- confidence: likely

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

<!-- done: 2 findings, files read: 36 -->
