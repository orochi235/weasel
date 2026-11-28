## holdPreview of a legacy-bag action with an `eligible` rule loses every dep but `ruleCtx`
- where: packages/routing/src/interactions/actions/holdPreview.ts:52 (holding)
- scenario: an action with no `requires` (so `depsFor` hands it the legacy fixed bag: selection, scene, history, view, activeTool, booleansAdapter) but with an `eligible` rule is wrapped by `holdPreview`. `holding` gives the hold `requires: [...(action.requires ?? []), 'ruleCtx']` = `['ruleCtx']`, so the hold's deps are built by `createActionDeps` from that list alone. On the press, `showPreview` calls `action.enabled` / `action.preview` with that bag; in dev the deps Proxy throws on `deps.selection` (enabled reads as `predicate-threw`, preview logs and shows nothing), in prod they read `undefined`. On release `invoker.run(ctx.deps, now)` runs without `scene`/`selection`. Expected: the hold gets the deps the action itself would get — the legacy bag plus `ruleCtx`, or the action's gates and run read through the action's own deps.
- evidence: read (ActionsProvider.tsx `depsFor` 47-59, buildDeps.ts `createActionDeps`, holdPreview.ts `holding`)
- severity: medium
- fix: packages/routing/src/interactions/actions/holdPreview.ts, packages/routing/src/interactions/actions/ActionsProvider.tsx
- size: function
- cause: `requires` added where the action declared none flips it from the legacy bag to declared deps
- confidence: sure

## An adjust stores session params for an action whose tuning `keep`s them; they surface once that tuning leaves
- where: packages/routing/src/interactions/actions/lastOperation.ts:259 (LastOperationKeeper.adjust → remember)
- scenario: a tool's options tuning with `keep` is live for action X; the user changes a value in the last-operation panel. `adjust` calls `held.keep(...)` (correct) and also `this.remember(id, values)` unconditionally. `tuningsOf` hides the session tuning only while a `keep` tuning is present; after a tool switch releases that tuning, the stale session params come back and are laid over every `under` tuning (tool defaults) for the rest of the session. docs/unruled.md (round fourteen) rules that such an action "stores no session params". Expected: skip `remember` when a tuning of `id` keeps the params.
- evidence: read (lastOperation.ts adjust/remember, ActionsProvider.tsx `tuningsOf` 117-126)
- severity: low
- fix: packages/routing/src/interactions/actions/lastOperation.ts, packages/routing/src/interactions/actions/ActionsProvider.tsx
- size: line
- cause: session write not gated on a keeping tuning
- confidence: sure

## A yoke member mounted under another `<ActionsProvider>` takes that provider's menu host, not its yoke tree's
- where: packages/routing/src/interactions/actions/inputScope.tsx:68 (Provide)
- scenario: `useYoke()` is called under ActionsProvider P1; a canvas `<InputScope yoke={yoke}>` sits elsewhere, under ActionsProvider P2 (the `Yoke` doc says members "can sit anywhere in the tree"). Its actions/deps/tool nodes hang on P1's tree, but `Provide` takes `useContext(MenuHostContext)`, which is P2's, before falling back to `nodes.actions.menuHost()`. Context menus and menu rows inside that canvas list and trigger P2's actions against P2's active scope, never the canvas's own. Expected: use the menu host of the tree the nodes belong to (`nodes.actions.menuHost()`), which already returns the root's shared host.
- evidence: read
- severity: low
- size: line
- cause: menu host chosen by React location rather than by the node's tree
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
