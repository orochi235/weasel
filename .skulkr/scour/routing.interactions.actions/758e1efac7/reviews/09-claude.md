## An action with no `requires` gets a different deps bag from the registry than from the dispatcher
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:47 (depsFor)
- scenario: an action declares no `requires` and its `enabled`/`run` reads `deps.selection`. Through `trigger`, `begin`, `preview`, the menu host and the last-operation rerun it gets the legacy fixed bag (`selection`, `scene`, `history`, `view`, `activeTool`, `booleansAdapter`), so the palette shows it enabled and a menu row runs it. Through the gesture dispatcher (`walk.ts:176`, `dropPreview.ts:51`), the same action gets `createActionDeps` over an empty `requires`: `{}` in production, and in dev a proxy that throws on `deps.selection`. That throw reads as `PredicateThrew`, so the key binding is refused (or the run throws) while the menu row works. One question, "what deps does this action get", has two answers depending on which path invokes it.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/actions/ActionsProvider.tsx (make `depsFor` always use `createActionDeps`), or the dispatcher's walk.ts, so both paths agree
- size: function
- cause: legacy dep-bag fallback kept on one invocation path only
- confidence: sure

## A binding override that is not a valid route warns again every time any registry in the tree changes
- where: packages/routing/src/interactions/actions/bindingOverrides.ts:46 (resolveBindingOverrides)
- scenario: a host passes `overrideBindings({ 'undo.key': 'Mod+Z' })`, which is not a route. `ActionsNode.overridesHere` caches by `tree.version` and calls `resolveBindingOverrides` again after each version bump: every register, tune, mute, activate, mount, and session-params change. Each call does `console.warn` again, on every node that resolves, so the console fills with the same warning as the app runs. It should warn once per id and input (compare `withoutOwnerChannel`, which uses `createWarnOnce`).
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/actions/bindingOverrides.ts
- size: line
- cause: warning not deduplicated across cache recomputes
- confidence: sure

## Tuned, session and binding params merge shallowly, so a nested param group loses leaves
- where: packages/routing/src/interactions/actions/tuning.ts:160 (tunedParams)
- scenario: an action's `params` form has a group, e.g. `fill.color` and `fill.opacity`. After a last-operation adjust, the session tuning holds the nested `{ fill: { color, opacity } }` (`remember` → `nestPrefValues`). A binding or `trigger` then passes `{ fill: { color: 'red' } }`, and `tunedParams` does `{ ...out, ...given }`, which replaces the whole `fill` object, so `fill.opacity` from the session or a tuning is dropped and the run uses the action's default. `lastOperation.withValues` sets values by leaf path, so the store does treat params as nested; the layering that feeds `run`, `paramsOf` and `invokedParams` does not.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/actions/tuning.ts
- size: function
- cause: shallow spread over nested param groups
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

<!-- done: 3 findings, files read: 36 -->
