# Audit round 89 — routing.interactions.actions

## A mute made in an ancestor scope does not reach the canvas dispatcher's own-actions list
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:188 (ActionsNode.ownActions)
- scenario: a yoke or root calls `registry.mute('delete')` while a canvas's `<InputScope>` registers `delete` itself. `resolve`, which `list`/`trigger`/`begin` use, walks the chain and checks `n.muted` at every node, so the canvas's `list()` leaves `delete` out. `ownActions` checks only `this.muted`. `useGestureDispatcher` with `hears: 'own'` routes through `{ list: () => node.ownActions() }` (dispatcher/useGestureDispatcher.tsx:87), so the canvas's Delete key still fires the muted action. The mute contract in `ActionsRegistry.mute` says it is absent "here — and in scopes below". It should check each node of `this.chain()`, as `resolve` does.
- evidence: read
- severity: medium

## An action without `requires` gets the legacy dep bag from `trigger` and an empty bag from the dispatcher
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:47 (depsFor)
- scenario: an action declares no `requires` and reads `deps.selection`. Fired through `trigger`, a menu row, `preview`, `begin`, or a last-operation rerun/admits, `depsFor` hands it the fixed bag (selection, scene, history, view, activeTool, booleansAdapter), so it works. Fired by its own key binding, the dispatcher builds deps with `createActionDeps` (dispatcher/walk.ts:176, channels/dropPreview.ts:51), which gives `{}`. In dev the Proxy throws on the read, and in production the dep is `undefined`. The same action's `enabled` therefore answers differently for a palette and for a key. One function should answer "the deps of an action", not two.
- evidence: read
- severity: medium

## A binding override that does not parse warns again on every tree change, from every node
- where: packages/routing/src/interactions/actions/bindingOverrides.ts:43 (resolveBindingOverrides)
- scenario: a host passes `overrideBindings({ 'undo.key': 'Mod+Z' })`, a string that is not a route. `overridesHere` caches on `tree.version` per node. Every `changed()` bumps the version: registers, mutes, tunings, tool switches (`ToolNode.update`) and last-operation session updates. Each bump re-resolves the overrides and logs the same `console.warn` again, once per node that asks. A shared `createWarnOnce` keyed by id and input would warn once.
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
