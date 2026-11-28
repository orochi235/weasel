## An action without `requires` gets the legacy dep bag from `trigger`, menus and the last-operation rerun, but an empty bag from every binding the dispatcher fires
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:45 (depsFor)
- scenario: an action registered with no `requires` whose `run` reads `deps.selection`. Run from a menu row, the palette or `registry.trigger`, `depsFor` hands it `{ selection, scene, history, view, activeTool, booleansAdapter }` and it works. Run from its own `defaultBinding` key, the dispatcher builds deps with `createActionDeps(action, ctx.depRegistry)` (`dispatcher/walk.ts:176`), which for an empty `requires` is `{}`, so the same action sees `deps.selection === undefined` (in dev, the Proxy throws "read deps.selection but did not declare it"). Its `enabled` answers differently too: a menu shows it enabled while its key is skipped as disabled, or the reverse. One action should get one bag whichever way it is run.
- evidence: read (ActionsProvider.tsx depsFor; dispatcher/walk.ts:176 and channels/dropPreview.ts:51 call createActionDeps unconditionally)
- severity: medium
- fix: packages/routing/src/interactions/actions/ActionsProvider.tsx, packages/routing/src/interactions/actions/buildDeps.ts
- size: function
- cause: two dep-bag builders, the legacy fallback kept on one path only
- confidence: sure

## A tuning's params never reach `ctx.params` of a UI-driven ongoing action begun without params
- where: packages/routing/src/interactions/actions/tuning.ts:93 (wrapInvoker, ongoing `start`)
- scenario: `registry.tune('opacity.set', { params: { step: 0.1 } })`, then a control calls `begin('opacity.set')` with no params (or `useOngoingAction(...).input` before any value). The dispatcher starts the invoker with `uiInvocationCtx(deps, undefined)` (`dispatcher/uiOngoing.ts:92`); `wrapInvoker` lays the tuning only when `ctx.params` is set (`ctx.params ? { ...ctx, params: base(ctx.params) } : ctx`), so the action reading `ctx.params` — where the `InvocationCtx.params` doc says UI-driven actions get theirs — sees no tuned params on start, then sees them on the first `update` that carries params. The `ActionTuning.params` doc promises "params every invocation starts from". The same guard on `onMove` drops them for an update with no params.
- evidence: read
- severity: low
- size: line
- cause: tuning laid only over present params
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
