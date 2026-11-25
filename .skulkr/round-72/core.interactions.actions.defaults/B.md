# Audit round 72 — core.interactions.actions.defaults

## copyOps puts a copied root under its source's parent even when that parent is locked, so the batch's insert is refused
- where: packages/core/src/interactions/actions/defaults/copySubtree.ts:63 (copyOps)
- scenario: a child of a locked group is selected (e.g. from a layers list) and duplicated; `rootParent` is undefined, so the copy's insert targets the locked group. The function already knows "the scene refuses an add under a locked node" (line 29) and works around it for a locked *copy* by deferring `locked`, but not for a locked *destination*: the insert is refused and the duplicate/clone batch fails instead of being disabled or placing the copy where it can go.
- evidence: read
- severity: low

## tool.resetToDefault reports enabled with no `activeTool` dep, so Escape is swallowed by a no-op
- where: packages/core/src/interactions/actions/defaults/toolResetToDefault.ts:45 (enabled)
- scenario: a surface wires the action without an `activeTool` dep. `enabled` checks only `getTarget()`, returns true, the dispatcher gives Escape to this action, and `run` returns at `if (!activeTool ...)` without doing anything. The comment on `enabled` says the point is to fall through rather than swallow the key; it does so only for a null target, not for the missing dep `run` also needs.
- evidence: read
- severity: low

## viewport.zoom's param-less fallback zooms about the canvas origin while Cmd+= zooms about the host center
- where: packages/core/src/interactions/actions/defaults/viewportZoom.ts:218 (run, default branch)
- scenario: `registry.trigger('viewport.zoom')` with no params zooms in by KEY_STEP anchored at (0, 0), and also skips `animate`, `animationTarget` compounding and the debug record. A `kind: 'in'` trigger anchors at `keyAnchor(view)`, the host center. So the same "zoom in" is answered two ways, and the fallback moves the content toward the top-left corner.
- evidence: read
- severity: low

## context-menu `enabled` checks the menu at the probe point while a keyboard `run` opens it for the selection anchor
- where: packages/core/src/interactions/actions/defaults/contextMenu.ts:114 (contextMenuAction.enabled)
- scenario: `enabled` calls `menuHost.has` with `menuHitFor(deps, at)` and `world: at`, and `run`'s keyboard path (Shift+F10 / ContextMenu key) calls `host.open` with `menuHitFor(deps)` and the `keyboardAnchor` world. If the dispatcher probes a key binding with a defined `at` (the last pointer point), the two calls ask about different hits: `enabled` can say a menu exists for the shape under the idle pointer while `run` finds none for the selection and passes, or say there is none and hide a menu the selection has. I have not confirmed whether key probes carry an `at`.
- evidence: read
- severity: low

## Files read
packages/core/src/interactions/actions/defaults/cancelAll.ts
packages/core/src/interactions/actions/defaults/containerScroll.ts
packages/core/src/interactions/actions/defaults/contextMenu.ts
packages/core/src/interactions/actions/defaults/copySubtree.ts
packages/core/src/interactions/actions/defaults/index.ts
packages/core/src/interactions/actions/defaults/lockedReach.ts
packages/core/src/interactions/actions/defaults/nudgeSteps.ts
packages/core/src/interactions/actions/defaults/requiresOperands.ts
packages/core/src/interactions/actions/defaults/segmentUnder.ts
packages/core/src/interactions/actions/defaults/sliceOps.ts
packages/core/src/interactions/actions/defaults/toolActivate.ts
packages/core/src/interactions/actions/defaults/toolResetToDefault.ts
packages/core/src/interactions/actions/defaults/touchZoom.ts
packages/core/src/interactions/actions/defaults/undoRedo.ts
packages/core/src/interactions/actions/defaults/viewportDragPan.ts
packages/core/src/interactions/actions/defaults/viewportWheelPan.ts
packages/core/src/interactions/actions/defaults/viewportZoom.ts

<!-- done: 4 findings, files read: 17 -->
