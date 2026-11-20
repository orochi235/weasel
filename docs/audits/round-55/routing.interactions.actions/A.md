# Audit round 55 — routing.interactions.actions

## A last-operation rerun that throws is treated as having run: the original entry stays undone with nothing in its place
- where: packages/routing/src/interactions/actions/lastOperation.ts:181-214 (LastOperationKeeper.adjust)
- scenario: `ran` starts `true`; when `held.rerun(values)` throws, the inner catch logs and leaves `ran === true`. The `!ran` branch (redo the undone entry, put the selection back, dismiss) is skipped, so the operation's entry has been undone, the rerun committed nothing, `held.entry` becomes `null`, `held.op.values` and the session params take the patch, and `adjust` returns `true`. The user's edit silently disappears from the scene while the panel shows the new values as applied. Should treat a throw as not-ran (redo + restore selection + dismiss), as the comment on line 194 promises for "an action gone or refusing".
- evidence: read
- severity: medium

## Last-operation rerun ignores an immediate invoker's `'pass'` and the action's `eligible` rule
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:127-134 (ActionsNode.lastOperationHost → rerun)
- scenario: `rerun` returns `ran = checkEnabled(...).enabled` and discards `a.invoker.run(deps, params)`'s result. An action that returns `'pass'` for the adjusted params (nothing to do — e.g. a scroll/step already at its end) reports ran, so `adjust` keeps the undo of the original entry with nothing in its place and returns true. It also never consults `eligibleNow(a)`, which `trigger` (line 280) checks, so a panel adjustment reruns an action in a mode/capability where `trigger` would refuse it. One decision ("may this run now") answered two ways; `rerun`'s own contract says "as `trigger` would".
- evidence: read
- severity: medium

## `holdPreview` runs the raw descriptor it was handed, so a mute or tuning of the action's id does not reach its hold
- where: packages/routing/src/interactions/actions/holdPreview.ts:24-48 (holdPreview)
- scenario: `holdPreview(action)` registers under `${id}.hold` and its `start`/`onEnd` call the captured `action.preview` / `invoker.run` directly. Pathfinder's keymap (`packages/editing/src/actions/pathfinder/keymap.ts:46`) builds holds from its raw descriptors. A scope that `mute('pathfinder.…')`s the action still runs it on the held key's release, since the registry resolves the hold's own id, not the muted one; a `tune(id, { params })` (or the session params the last-operation panel set) is applied by `trigger(id)` but not to the hold's preview or run, so the held key and the click on the same command run with different params. The hold should resolve `id` through the registry at press/release (as `trigger`/`preview` do) rather than close over the descriptor.
- evidence: read
- severity: medium

## `ActionsRegistry.begin` skips the `eligible` rule and `enabled` that `trigger` and `preview` both ask
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:298-304 (ActionsNode.registry.begin)
- scenario: `trigger` (line 280-282) and `preview` (line 294 + showPreview) refuse an action whose `eligible` rule the scope's `ruleCtx` refuses or whose `enabled` says no. `begin` resolves the action and hands it straight to `disp.beginUiOngoing`, which (`dispatcher/uiOngoing.ts:73-99`) checks neither. So a UI control driving an ongoing action through `useOngoingAction` — an opacity slider with the selection-required action disabled, or in a mode whose capability rule excludes it — starts and commits it where every other entry point (gesture dispatch, trigger, menu rows) would not. The same "may this run now" decision is answered two ways.
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

<!-- done: 4 findings, files read: 35 -->
