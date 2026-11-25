# Findings: routing.interactions.actions (round 85)

## Last-operation wrap of an ongoing handle splits `this`: onEnd/replay run on the original, every other method on a spread copy
- where: packages/routing/src/interactions/actions/lastOperation.ts:239 (LastOperationKeeper.ongoing)
- scenario: an action declaring `params` whose ongoing handle can `replay` returns a handle written with methods that use `this` (`{ dx: 0, onMove(c) { this.dx = …; }, onEnd() { commit(this.dx); }, replay(p) { … this.dx … } }`), or a class instance. The wrapper returns `{ ...handle, onEnd: ended }`; the dispatcher then calls `onMove`, `overlay`, `previewIds`, `cursor` and the rest on the copy, so `this.dx` is written on the copy, while `ended` calls `onEnd.call(handle, …)` and `replay.call(handle, …)` on the original, which still reads `dx = 0`. The commit and the replay ignore every move. A class-instance handle is worse: the spread drops its prototype methods, so `onMove`, `overlay` and the previews disappear, and getters are read once at the moment of the copy. The handle should be wrapped so that every method sees one receiver, either by delegating each call to `handle` or by overriding `onEnd` on a prototype-linked object.
- evidence: read
- severity: medium

## An emptied yoke left as its parent's active child takes every read from the root
- where: packages/routing/src/interactions/actions/scopeNode.ts:47 (ScopeNode.mount leave) / :68 (leaf)
- scenario: the root holds two canvases, A in a yoke and B on its own. Pressing in A sets root.activeChild = yoke. A unmounts, while the yoke lives on in the component that called `useYoke`. Leave clears only `yoke.activeChild` (A's parent), not `root.activeChild`, so `root.leaf()` follows activeChild to the yoke, which now has no children, and stops there. Chrome's `trigger`/`begin`/`list`, the menu host and `useActiveToolContext` at the root then resolve against an empty yoke rather than canvas B. `newestMember` exists to pass over a memberless yoke, but this path never reaches it. A plain scope leaving clears `parent.activeChild`, which falls back to the newest member, so a yoke and a scope give two different answers to the same unmount. `leaf()` should skip an activeChild that is a memberless descending node, the same test `newestMember` makes.
- evidence: read
- severity: medium

## `rankedDepRegistry` loses its rank when a caller passes `{ rank: undefined }`
- where: packages/routing/src/interactions/actions/depNode.ts:111 (rankedDepRegistry)
- scenario: inside `<DepRank rank={5}>`, a helper forwards its own optional options: `registry.register(name, src, { rank: opts?.rank })`, with `opts.rank` unset. `{ rank, ...options }` spreads `rank: undefined` over 5, and `DepNode.register` reads undefined as rank 0. The source joins tier 0 rather than the DepRank's tier, even though "unless the registration names its own" did not apply. It should take `options?.rank ?? rank`.
- evidence: read
- severity: low

## `checkEnabled` JSDoc names the wrong throw reason
- where: packages/routing/src/interactions/actions/actionEnabled.ts:61 (checkEnabled)
- scenario: the doc says a throw is "treated as disabled with reason `'(predicate threw)'`". The code returns `ActionDisabledReason.PredicateThrew`, which is `'predicate-threw'`. A consumer that writes its label map from the doc keys `'(predicate threw)'` and never matches, so it shows the raw sentinel.
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
