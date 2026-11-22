# Audit 72 — core.interactions.actions.defaults

## `viewport.zoom` run with no params zooms in about the canvas origin, unanimated and unrecorded, unlike the `in` variant
- where: packages/core/src/interactions/actions/defaults/viewportZoom.ts:215 (createViewportZoomAction run, default branch)
- scenario: `registry.trigger('viewport.zoom')` (params undefined) on a canvas built with `animate: true`. The default branch calls `view.set(zoomAt(current, { x: 0, y: 0 }, …))`: it zooms about the top-left corner instead of `keyAnchor(view)` (host center), jumps instead of gliding, compounds off `current` instead of `stepFrom()` (so mid-tween it zooms from the in-flight frame), and never calls `record`. The `kind: 'in'` case answers the same "zoom in one step" request differently on every count. It should run the `in` path.
- evidence: read
- severity: low

## Container wheel-scroll ignores the wheel-pan axis lock
- where: packages/core/src/interactions/actions/defaults/containerScroll.ts:210 (containerScrollAction run)
- scenario: a canvas configured with `pan: { axis: 'x' }` (`createViewportWheelPanAction({ axis: 'x' })` bakes `axis` into `viewport.wheelPan`'s bindings only). Over a scrollable container, `container.scroll` wins the wheel (it is tried before the pan and yields only at range ends) and calls `wheelPan(..., { swapAxis })` with no `axis`, so a vertical wheel scrolls the container vertically even though the consumer locked wheel motion to x. The lock is an option silently dropped on one of the two wheel paths; the container chain is handed `deltaY` the pan would have discarded. (Inference that the lock is meant to cover wheel motion generally; the action has no `axis` param to set.)
- evidence: read (inference on intent)
- severity: low

## Context-menu `bodyKind` is answered two ways for an already-selected shape
- where: packages/core/src/interactions/actions/defaults/contextMenu.ts:47 (menuHitFor)
- scenario: a shape is selected. Right-click on it: `hit.bodyTarget === 'selected-body'`, so `target` is undefined and `bodyKind` comes from `hitAt`'s `hit.bodyKind`, whatever node the classifier hit (possibly a leaf inside a selected group). Press Shift+F10 instead: `bodyKind` is `kindOfNode(ids[0])`, and only when exactly one id is selected. For a multi-selection, the pointer path still reports the clicked node's kind while the keyboard path reports none, so the same selection gets a different menu depending on how it was opened. The unselected-body branch already resolves the kind through `kindOfNode` on the press target; the selected branch should resolve it the same way.
- evidence: read (inference on what `hitAt`'s bodyKind names)
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

<!-- done: 3 findings, files read: 17 -->
