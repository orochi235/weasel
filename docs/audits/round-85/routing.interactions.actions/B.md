## The last-operation wrapper hands the dispatcher a spread copy of the gesture's handle, so a handle using `this` (or prototype methods/getters) splits its state
- where: packages/routing/src/interactions/actions/lastOperation.ts:270 (LastOperationKeeper.ongoing, `return { ...handle, onEnd: ended }`)
- scenario: an ongoing action declaring `params` whose `start` returns a handle with `replay`, written as an object literal with methods using `this` (`onMove(ctx) { this.last = ctx.world }`, `onEnd() { commit(this.last) }`, `replay(p) { … this.last … }`). The dispatcher calls `onMove` on the spread copy, so `this.last` lands on the copy; `ended` calls `onEnd.call(handle, …)` and `replay.call(handle, …)` on the original, which never saw the moves — the commit and every replay read stale/undefined state. A handle built as a class instance loses every prototype method (`onMove`, `overlay`, `previewIds`, …) in the spread, and a getter (`autoPan`, `kind`) is frozen at its value when `start` returned. Without `params` on the action (no wrap) the same handle works, so declaring a panel form changes gesture behavior. Should wrap without copying (e.g. assign `onEnd` on a delegating object whose methods forward to `handle`, or bind every method to `handle`).
- evidence: read (no class-based handle found in the repo by grep; the failure is for a handle shape the `OngoingHandle` interface permits)
- severity: medium

## The last operation outlives the input scope it ran in, and adjusting it reruns against the parent scope's deps
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:132 (ActionsNode.lastOperationHost) with packages/routing/src/interactions/actions/lastOperation.ts:187 (adjust)
- scenario: the keeper is shared by the whole tree (kept at its root), and nothing dismisses a held operation when the `<InputScope>` it ran in unmounts (closing a document tab). The held `rerun` closes over the unmounted leaf node: `resolve(id)` still walks to the root and finds a root-registered action, and `this.deps()` reads the unmounted scope's DepNode, whose released sources fall through (its `parent` pointer is kept) to the root's sources — possibly another document's scene/selection. `adjust` then undoes the entry on the orphaned history and reruns the action against whatever deps answer, or, if that run self-guards and returns void, leaves the original undone with nothing in its place while reporting success. Expected: the operation is dismissed when its scope unmounts.
- evidence: read (inference from the node lifetimes; not run)
- severity: low

## A hold runs its action with the params resolved at the press, so a thunked binding param changed while the key is held is not what runs
- where: packages/routing/src/interactions/actions/holdPreview.ts:60 (holding → start → onEnd)
- scenario: `params` is `resolveParams(opts?.params)` once, at `start`; `onEnd` runs `invoker.run(ctx.deps, params)` with that snapshot. A binding whose `opts.params` is a thunk (documented as "evaluated each time the value is needed", for refs that change mid-gesture) and whose value changes while the key is held commits with the stale value. Also the commit's `invoker.run` and `checkEnabled` are not guarded, so an action that throws on run propagates out of `onEnd` into the dispatcher, where `trigger` would have caught and logged it.
- evidence: read
- severity: low

## `checkEnabled`'s doc names the wrong disabled reason for a throwing predicate
- where: packages/routing/src/interactions/actions/actionEnabled.ts:60 (checkEnabled JSDoc)
- scenario: the JSDoc says a throw is treated "as disabled with reason `'(predicate threw)'`"; the code returns `ActionDisabledReason.PredicateThrew`, which is `'predicate-threw'`. A consumer mapping reasons to display strings by the documented value never matches.
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
