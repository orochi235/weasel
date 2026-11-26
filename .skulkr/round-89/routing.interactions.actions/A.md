# Audit round 89 — routing.interactions.actions

## A menu host under `<Yoke>` lists and runs against the tree root's active scope, not the yoke's
- where: packages/routing/src/interactions/actions/ActionsProvider.tsx:219 (ActionsNode.menuHost), packages/routing/src/interactions/actions/inputScope.tsx:59 (Provide)
- scenario: one `<ActionsProvider>` holds two yokes, A and B, each with member canvases; a toolbar sits in `<Yoke value={A}>`. The user last pressed in a canvas of yoke B. `Provide` puts the provider's menu host in scope (or `nodes.actions.menuHost()`, which also goes to `chain().at(-1)`, the root), and that host's `actions`, `depsFor`, `eligible`, `trigger` and `activeTool` all read `root.start()`, i.e. yoke B's canvas. So a menu or row built in A's toolbar lists B's actions and fires them in B, while `useActionsRegistry().trigger(...)` from the same toolbar goes to `yokeA.start()`, A's last-used canvas. The two ways the same chrome reaches its actions give different answers; the menu host for a scope should resolve through that scope's node (the yoke's `start()`), as `Yoke`'s doc promises ("its actions, deps and tool reads reach the yoke and, through it, the member canvas last used").
- evidence: read
- severity: medium

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

<!-- done: 1 findings, files read: 36 -->
