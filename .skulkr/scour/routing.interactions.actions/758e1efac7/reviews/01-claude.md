# Findings: routing.interactions.actions

## An action without `requires` gets a different deps bag from `trigger`/`begin`/`preview` than from its own bindings
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:47 (depsFor)
- scenario: an action declares no `requires`, and its `run` reads `deps.selection`. When the palette or a menu fires it through `ActionsRegistry.trigger`, `depsFor` hands over the fixed legacy bag (selection, scene, history, view, activeTool, booleansAdapter), so it works. When its own key binding fires it, the dispatcher builds the bag with `createActionDeps(action, …)` (walk.ts:176), which reads `requires ?? []` and passes an empty bag. In dev that bag is the undeclared-read Proxy, so `deps.selection` throws; in prod it is `undefined`. The same split shows up in `begin` vs a gesture and in `registry.preview` vs `dropPreview`. The same action should get the same deps on every path. walk.ts's comment says the bag is "Shared with `ActionsRegistry.trigger`, including the dev undeclared-read guard", but the legacy branch is a plain object with no guard.
- evidence: read (ActionsProvider.tsx depsFor; buildDeps.ts createActionDeps; dispatcher/walk.ts:176, dispatcher/channels/dropPreview.ts:51)
- severity: medium
- fix: packages/routing/src/interactions/actions/ActionsProvider.tsx, packages/routing/src/interactions/actions/buildDeps.ts
- size: function
- cause: two dep-bag builders, one keeping a legacy fallback
- confidence: sure

## A merged tuning form loses the added form's name when the action's own form has no name
- where: packages/routing/src/interactions/actions/tunedForm.ts:27 (formWith)
- scenario: an action's own `params` form has `name: ''`, which `PrefGroup` defines as "no heading". A tuning adds a `form` named "Brush". `formWith` returns `{ ...form, ...a, … }`, so own's empty `name` overwrites "Brush". The last-operation panel then titles the run `schema.name || action.label`, which gives the action's label instead of "Brush". This contradicts formWith's own doc: "named for `own` where it names itself".
- evidence: read (tunedForm.ts; prefs-schema/src/groups.ts PrefGroup.name; lastOperation.ts label `schema.name || action.label`)
- severity: low
- fix: packages/routing/src/interactions/actions/tunedForm.ts
- size: line
- cause: spread lets an empty name win
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

<!-- done: 2 findings, files read: 36 -->
