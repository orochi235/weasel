## A tuning's params reach a UI-driven ongoing action's `start` but not the `onMove` each `update` drives
- where: packages/routing/src/interactions/actions/tuning.ts:93 (wrapInvoker)
- scenario: `tune('fill.color', { params: { alpha: 0.5 } })`, then a color picker drives `begin('fill.color', { color: '#f00' })` and `update({ color: '#0f0' })`. `start` gets `ctx.params = { alpha: 0.5, color: '#f00' }` because the wrapper lays the tuning under `ctx.params`. The wrapped invoker returns the inner handle untouched, though, and the dispatcher hands `onMove` the raw update params (`uiOngoing.ts` passes `ctx.params` straight through). So every move reads `{ color: '#0f0' }` with `alpha` gone. The tuning should apply on every event of the edit, as it does on start.
- evidence: read (tuning.ts wrapInvoker; dispatcher/uiOngoing.ts:92 and dispatcher.uiOngoing.test.ts:59)
- severity: medium

## A kept gesture's `handle.params()` (values read from the object it edited) become session params for every later run
- where: packages/routing/src/interactions/actions/lastOperation.ts:283 (ongoing → hold → remember)
- scenario: `OngoingHandle.params` says those params came "from what it edited rather than from its binding", for example a held warp's own grid and tolerance. `ended` merges them into `resolved`, and `hold` calls `remember(id, values)` on the first commit, before any panel change. `tuningsOf` then lays that session tuning under each later invocation. The next warp, on a different object whose grid differs, starts from the previous object's grid instead of its own. The object-derived values should feed the panel and `replay` only, not session params.
- evidence: read (inference about which actions use `params()`; I did not run it)
- severity: medium

## Dev deps Proxy throws on any undeclared string property, including the introspection ones (`toJSON`, `constructor`, `$$typeof`, `asymmetricMatch`)
- where: packages/routing/src/interactions/actions/buildDeps.ts:29 (createActionDeps)
- scenario: In dev, an action with `requires` that logs or serializes its deps, such as `JSON.stringify(deps)` or a test's `expect(deps).toEqual(...)` that probes `asymmetricMatch` and `$$typeof`, throws "read deps.toJSON but did not declare it". Only `then` is exempt. The same code works in prod, so dev and prod behave differently for a read that is not a dep lookup.
- evidence: read
- severity: low

## `withRoleMods` widens a binding that never admitted a role, when that role's declared keys are empty
- where: packages/routing/src/interactions/actions/modifierRoles.ts:63 (withRoleMods)
- scenario: The action declares role `r` with `keys: []` (which never holds it), and a tuning rebinds `r` to `['alt']`. `was.every(admitted)` is true for the empty list, so a binding with no `mods`, written without `roleMods`, gets `alt: 'optional'`. The binding now matches Alt-held presses it was written to refuse. The check is meant to widen only specs that admitted the role's declared keys.
- evidence: read
- severity: low

## `'&'`-channel phase validation covers `defaultBinding` only, not bindings a tuning adds or an override substitutes
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:279 (registry.register) / registry.ts:166 (validateActionDefaultBinding)
- scenario: `tune('align.left', { bindings: [{ kind: 'key', key: 'a', phase: 'engaged' }] })`, or an override route with a bare phase, puts an `'&'` atom on an action's bindings after registration. `register` throws for exactly that spec when it is declared, but here it passes and reaches dispatch, where `'&'` has no owning tool to resolve to. The same rule is enforced on one path and skipped on the others.
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

<!-- done: 5 findings, files read: 35 -->
