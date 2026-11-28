I couldn't write the findings file because the harness blocks subagents from writing report files. Following the brief's fallback, the whole document is below.

# Findings: routing.interactions.actions (blind reviewer)

## An action with no `requires` gets the legacy deps bag from `trigger`, `begin` and menus, but an empty bag from the dispatcher
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:47 (depsFor)
- scenario: A consumer registers this action with no `requires`:
  ```ts
  {
    id: 'my.delete',
    defaultBinding: key('Delete'),
    enabled: (d) => d?.selection?.current.size ? true : 'selection-required',
    invoker: { timing: 'immediate', run: (d) => … d.selection … },
  }
  ```
  - **Menu, palette or `registry.trigger`:** `depsFor` hands it the fixed bag (`selection`, `scene`, `history`, `view`, `activeTool`, `booleansAdapter`). The row shows enabled and the action runs.
  - **The Delete key:** this goes through the dispatcher's walk (`dispatcher/walk.ts:176`). The walk always builds the bag with `createActionDeps`, which reads `requires ?? []` and so returns `{}`.
    - In dev that bag is the warning Proxy. `enabled` reading `deps.selection` throws, `gateEnabled` turns the throw into `predicate-threw`, and the key never fires; a refusal is noted instead.
    - In prod, `enabled` sees no selection and refuses, or `run` reads a property of `undefined`.

  So one action reads as enabled in the menu and disabled on its key: the two paths give two different answers to which deps an action gets. The comment in `walk.ts` says the bag is "Shared with `ActionsRegistry.trigger`", which is only true for actions that declare `requires`. `begin` also passes the legacy bag to `beginUiOngoing`, so a UI-driven start and a drag of the same ongoing action see different deps.
- evidence: read (ActionsProvider.tsx depsFor/depsOf/trigger/begin/menuHost; buildDeps.ts createActionDeps; dispatcher/walk.ts:173-189)
- severity: medium
- fix: packages/routing/src/interactions/actions/ActionsProvider.tsx, packages/routing/src/interactions/dispatcher/walk.ts
- size: function
- cause: two deps-bag builders, one keeping a legacy fallback the other dropped
- confidence: likely

## An unparseable binding override warns again on every change to the actions tree
- where: packages/routing/src/interactions/actions/bindingOverrides.ts:42 (resolveBindingOverrides), called from ActionsProvider.tsx:152 (ActionsNode.overridesHere)
- scenario: A host passes `overrideBindings({ 'undo.key': 'Mod+Z' })`, a shortcut rather than a route.
  - `overridesHere` caches its result by `tree.version`, so it recomputes after every `changed()`. That covers each canvas activation that moves the active scope, each register or unregister, each mute or tune, and each last-operation session update.
  - Every node that resolves an action reruns `resolveBindingOverrides`, and each run calls `console.warn` again for the same bad entry.
  - On a page with two canvases, the warning is logged on every click that switches canvas, for the life of the page.

  Expected: warn once per bad override, as `withoutOwnerChannel` in the same file does with `createWarnOnce`.
- evidence: read
- severity: low
- size: line
- cause: warning not deduplicated across cache recomputes
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