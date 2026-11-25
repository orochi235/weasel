# Audit round 88 — routing.interactions.actions (blind reviewer)

## Last-operation wrap of an ongoing action swallows a handle's `'pass'` from `onMove`, breaking drag hand-off
- where: packages/routing/src/interactions/actions/lastOperation.ts:265 (LastOperationKeeper.ongoing, `moved`)
- scenario: an ongoing action declares `params` (a form) and its handle has `onEnd` and `replay`, so `wrap` → `ongoing` replaces `onMove` with `moved`. `moved` calls `onMove?.call(handle, moveCtx)` and returns nothing. When the handle's `onMove` returns `'pass'` to hand the drag to the next candidate (`OngoingHandle.onMove` contract), the dispatcher sees `undefined` and keeps the drag with this action; the hand-off never happens. The same action without a `params` form (or the tuning wrapper in `tuning.ts`, whose arrow returns the value) passes correctly. `moved` should `return onMove?.call(handle, moveCtx)`.
- evidence: read
- severity: medium

## A hold's release re-asks `enabled` but not the `eligible` rule, so it runs an action the mode no longer allows
- where: packages/routing/src/interactions/actions/holdPreview.ts:63 (holding, `onEnd`)
- scenario: a `holdPreview` of an action with an `eligible` rule (e.g. a capability rule) is pressed while eligible; while the key is held the mode changes so the rule refuses. On release `onEnd('commit')` checks only `checkEnabled(action, …)` and calls `invoker.run`, so the action runs although `trigger` (which checks `eligibleNow`) would refuse it. The comment says the release is "asked again" because what was previewed may have stopped applying; the eligibility half of that gate is skipped.
- evidence: read
- severity: low

## `<DepRank>` above an `<InputScope>` does not rank the sources registered inside it
- where: packages/routing/src/interactions/actions/inputScope.tsx:38 (useNodes) with depNode.ts:107 (rankedDepRegistry)
- scenario: `<DepRank rank={-1}><InputScope>…<Defaults/>…</InputScope></DepRank>`. `useNodes` resolves the ranked registry back to its node with `depNodeOf` and provides a new `DepNode`'s plain `registry` to its children, so every `useDepSource` beneath the scope registers at rank 0 instead of -1. `DepRank`'s doc promises every source registered beneath it joins at its rank unless a nearer `<DepRank>` or the registration names another; mixed with a nested `<DepRank rank={0}>` inside the scope, the outer defaults now tie with it and stack by age instead of staying under it.
- evidence: read
- severity: low

## `ToolNode.snapshot` returns a new value on every call when no node in its chain owns a tool
- where: packages/routing/src/interactions/actions/activeToolContext.tsx:76 (ToolNode.snapshot)
- scenario: a `ToolNode` constructed with `owns: false` and no owning ancestor (the class is exported; `new ToolNode(null, true, false, null)`). `owner()` returns the node itself with `state === null`, and `snapshot` substitutes a fresh `{ active: null, hotkeyStack: [] }` each call, so the cache check `cached.state === state` never hits and `useSyncExternalStore` gets a new snapshot every render ("getSnapshot should be cached" / render loop). A module-level empty state would keep it stable.
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

<!-- done: 4 findings, files read: 36 -->
