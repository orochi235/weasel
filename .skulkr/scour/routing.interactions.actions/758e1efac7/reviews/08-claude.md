## An action with no `requires` gets the legacy fixed dep bag from `trigger`, menus, `preview`, `begin` and the last-operation rerun, but an empty bag from the dispatcher
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:47 (depsFor)
- scenario: an action declaring no `requires` whose `run`/`enabled` reads `deps.selection`. Run from a menu row, the palette or `registry.trigger`, `depsFor` hands it `{selection, scene, history, view, activeTool, booleansAdapter}` and it works. Bound to a key or pointer, the dispatcher's walk (`dispatcher/walk.ts:176`) builds deps with `createActionDeps`, which for no `requires` is `{}` wrapped in the dev Proxy. In dev, the first read of `deps.selection` throws, so `enabled` reads as `predicate-threw` and the binding falls through. In prod the action runs with `selection` undefined. The same action is enabled in the menu and refused on its shortcut. `holdPreview` holds (dispatched only) and `LastOperationHost.admits`/`rerun` (legacy bag on rerun, empty bag on the original gesture) inherit the split. One answer should serve both paths: the dispatcher's bag, or the legacy bag in both.
- evidence: read (ActionsProvider.tsx depsFor; dispatcher/walk.ts:176; dropPreview.ts:51)
- severity: medium
- fix: packages/routing/src/interactions/actions/ActionsProvider.tsx, packages/routing/src/interactions/actions/buildDeps.ts
- size: function
- cause: two dep-bag builders for one decision
- confidence: sure

## `trigger` reports `true` ("it ran") when the action's `run` threw
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:300 (registry.trigger)
- scenario: `run` throws partway (say a missing dep in prod). The catch logs the error and falls through to `return true`. The contract in `registry.ts` says `trigger` returns whether it ran one, and lists every other failure as `false`. A palette or menu caller that treats `true` as "done" (closing, toasting success) reports success for a failed command. It should return `false` from the catch.
- evidence: read
- severity: low
- size: line
- cause: catch falls through to the success return
- confidence: sure

## A bad binding-override route warns again on every change to the actions tree
- where: packages/routing/src/interactions/actions/bindingOverrides.ts:44 (resolveBindingOverrides)
- scenario: a host passes `overrideBindings({ 'undo.key': 'Mod+Z' })` (not a route). `overridesHere` caches by `tree.version` and calls `resolveBindingOverrides` again after every bump. A bump comes from each `activate` that moves the active canvas, each register, each tune and each last-operation session change. Every bump that reaches `tuned()` prints the same `console.warn`, once per node. Clicking between two canvases floods the console. `withoutOwnerChannel` in the same file uses `createWarnOnce` for this reason, so this path should key a warn-once on the id and input too.
- evidence: read
- severity: low
- size: line
- cause: warning not deduped while the resolve is re-run per version
- confidence: sure

## A hold made by `holdPreview` keeps the label of the descriptor it was made from, not the live one it follows
- where: packages/routing/src/interactions/actions/holdPreview.ts:46 (holdingLive)
- scenario: `holdPreview(defaultAction)` is registered, and a consumer later registers a replacement under `action.id` with another label. `holdingLive` replaces the gates and invoker with the live action's but keeps `rest.label` from the hold, which is the original's label. The doc says the hold "follows whatever that registry resolves for `action.id`: its replacement". A keymap editor or a shortcut list showing the hold names the replaced action.
- evidence: read
- severity: low
- size: line
- cause: label copied once at construction, not taken from the live action
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

<!-- done: 4 findings, files read: 36 -->
