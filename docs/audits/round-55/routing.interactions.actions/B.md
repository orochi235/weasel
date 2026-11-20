I couldn't write `.skulk/out/findings.md` because permission to write it was denied, so here is the whole document:

# Findings: routing.interactions.actions (round 55)

## `ActionsRegistry.paramsOf` reads tunings from the node it's called on, while `trigger` runs at the active leaf
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:261-262 (`registry.paramsOf`)
- scenario: a canvas's `<InputScope>` tunes `insert` (say, its tool options set the params). Chrome above it (a toolbar on the root `<ActionsProvider>` or a `<Yoke>`) calls `registry.paramsOf('insert')` to show what the action will do. `paramsOf` calls `this.tuningsOf(id)`, which walks up from the root node. It never reaches the active scope, so the canvas's tuning is missing from the answer. `trigger('insert')` from the same registry resolves at `this.start()`, the active leaf, and runs with that tuning. Every other read on this registry starts at the leaf: `list`, `trigger`, `preview`, `begin` and `bindingOverrides`. So `paramsOf` gives a different answer from the run it claims to describe ("the params an invocation of `id` from this scope starts with"). It should read `this.start().tuningsOf(id)`.
- evidence: read
- severity: medium

## `holdPreview` captures the static descriptor, so the hold runs an action the registry has replaced, tuned or muted
- where: packages/routing/src/interactions/actions/holdPreview.ts:24-48 (`holdPreview`); used at packages/editing/src/actions/pathfinder/keymap.ts:46
- scenario: `PATHFINDER_KEYMAP` builds each hold from the module-level `pathfinderUnionAction` etc. Suppose a host replaces `pathfinder.union` (`<SceneCanvas actions={{ 'pathfinder.union': … }}>`), tunes its params (`registry.tune('pathfinder.union', …)`), or mutes it in a scope (`registry.mute('pathfinder.union')`). Holding U still previews, gates (`enabled`, `eligible`, `requires`) and on release runs the original descriptor's `preview`/`invoker.run`. None of the tuning, the replacement, the mute or the last-operation wrapping reaches it. A muted action, which "neither `trigger` nor `begin` will fire", still fires through its hold, and a tuned action runs untuned from its key. The hold should look up the live action for `action.id` in the actions registry when the key is pressed and released.
- evidence: read
- severity: medium

## A last-operation rerun that throws counts as having run, leaving the operation undone with nothing in its place
- where: packages/routing/src/interactions/actions/lastOperation.ts:180-200 (`LastOperationKeeper.adjust`); packages/routing/src/interactions/actions/ActionsProvider.tsx:127-133 (`lastOperationHost.rerun`)
- scenario: an operation is held and the panel calls `adjust(patch)`. `adjust` undoes the held entry, then calls `held.rerun(values)` inside a `try` whose `catch` only logs. `ran` starts as `true`, so a throw leaves it `true`. `adjust` then takes the "ran" branch:
  - It does not `redo` the undone entry or put the selection back (`back`).
  - It sets `held.entry` from the watch (`null`, or whatever partial ops landed before the throw).
  - It records the patched `values` as the operation's values and as the session params, though they never applied.
  - It returns `true`.

  The user's operation disappears from the scene, and the panel shows it with values that never ran. The comment at line 194 says an action that can't run "leaves the operation as it was, not undone with nothing in its place". A throw should take the `!ran` branch (redo, restore the selection, dismiss).

  Related: `host.rerun` returns `true` whenever `enabled` passes and ignores an immediate invoker's `'pass'` return, which `trigger` (which it says it copies) treats as not run.
- evidence: read
- severity: medium

## The last-operation rerun skips the `eligible` rule that `trigger` and `preview` check
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:127-133 (`lastOperationHost.rerun`) vs :280 (`registry.trigger`) and :294 (`registry.preview`)
- scenario: an action with `eligible: { capability: … }` runs and is held as the last operation. The editor then moves into a mode or capability set where the rule refuses the action, with no history change, so the operation stays held. A panel change calls `adjust`, and `rerun` resolves the action and runs it after checking only `checkEnabled`. It never calls `eligibleNow(a, deps.ruleCtx)`. So the action runs in a context where `trigger` would refuse it. `rerun` is documented as "as `trigger` would", which makes this one decision answered two ways.
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