## withRoleMods widens a binding for a role whose old keys only an earlier role's widening admitted
- where: packages/routing/src/interactions/actions/modifierRoles.ts:72 (withRoleMods)
- scenario: An action declares role A with keys `['shift']` and role B with keys `['alt']`. Its binding is written with mods `{ shift: 'optional' }`, so it admits A's key and not B's. A tuning moves A to `['alt']` and B to `['ctrl']`. The loop handles A first: A's old key `shift` is admitted, so `allow('alt')` adds `alt: 'optional'` to `mods`. Then it handles B. The check `was.every((k) => admitted(mods, k))` reads that same mutated `mods`, so B's old key `alt` now passes, and `ctrl` is widened as well. Ctrl-drags now reach a binding that was never written for role B. Reverse the role declaration order and `ctrl` is not widened, so the result depends on the order roles are declared in.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/actions/modifierRoles.ts
- size: line
- cause: the admitted check reads mods being widened, not the spec's own mods
- confidence: sure

## pushOwner's release takes out the newest copy of a value pushed twice, reordering the stack
- where: packages/routing/src/interactions/actions/scopeNode.ts:123 (pushOwner)
- scenario: One value is pushed twice onto the same owner stack, for example a module-constant `BindingOverrides` map or `ActionTuning` that two components pass to `overrideBindings` / `tune` on one node. Another holder's value sits between the two. The stack is `[T(first), U, T(second)]`. When the first holder releases, `lastIndexOf(value)` removes index 2, which is the second holder's slot, leaving `[T, U]`. U now beats T, although the T still registered was pushed after U and should win: "a later one beats an earlier one in the same scope". The doc promises that "the release takes out *its own* entry wherever it now sits", but with equal values it cannot find its own entry.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/actions/scopeNode.ts
- size: function
- cause: release identifies its entry by value, not by a per-push token
- confidence: sure

## A grouped settings form's default change params use a dotted flat key, while its values and the last operation are nested
- where: packages/routing/src/interactions/actions/actionSettings.ts:56 (actionSettingsParams)
- scenario: An `ActionSettings` whose schema has a group (leaf path `stroke.width`) and no `params` function. `read()` returns values nested as the groups nest, and menus and panels read them back with `prefValueAt(values, 'stroke.width')`. When that field changes, the default returns `{ 'stroke.width': v }`, a literal dotted key. The action is triggered with it, so an invoker reading `params.stroke?.width` (the nested shape that `read` and the last-operation keeper's `withValues` / `nestPrefValues` use) gets nothing, and the change is silently dropped. Only flat schemas work with the default.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/actions/actionSettings.ts
- size: line
- cause: default params not nested at the leaf path
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