# Audit round 42 — core.interactions.actions.defaults

## segmentUnder tests the world point against the plane-world path, while the segment affordance tests the camera-projected one
- where: packages/core/src/interactions/actions/defaults/segmentUnder.ts:20 (segmentUnder)
- scenario: a path node on a parallax plane (`planeOfNode` returns a plane) is in anchor edit mode. The segment affordance (`affordances/pathAnchors.ts` `segments.regions`, fed by `anchorStateFrom` in `useSceneGestureDispatcher.ts:121`) carries the path through `pathFromPlane` into the asking camera's world, so the hover cursor and the press land on the segment as drawn. `segmentUnder` reads `dep.getEditablePath(dep.editingId)` raw, in the plane's world, and tests the camera-world point against it. `insertPathAnchor`, `bendSegment` and `convertSegments` call it in both `enabled` and `run`, so a press on the segment shown on screen is NotApplicable or inserts at the wrong `t`, and a press where the unprojected path lies is taken. It also skips `getOutlinePath`, which the affordance prefers. The question "which segment is under this point" gets two answers.
- evidence: read
- severity: medium

## A new drag-pan does not stop the previous drag's inertia coast
- where: packages/core/src/interactions/actions/defaults/viewportDragPan.ts:77 (viewportDragPanAction start) and :145 (onEnd)
- scenario: `inertia: true` hand tool. Flick-pan and release, so `view.decay` starts a coast, then press again to grab the canvas. `start` never calls `view.stopDecay()` (nothing in the repo calls it; `view.set` stops only `animation`, not decay, `canvas/deps/view.ts:61`). The coast keeps calling `v.set` each frame while the pointer is held: holding still, the canvas keeps sliding under the finger; dragging, `onMove` sees `!sameCamera(now, seen)` every frame and rebases onto the drifted view, so the coast's motion is added to the drag. The release then starts a second `decay` on top of the first. Expected: a press grabs the camera and kills the coast.
- evidence: read (grep for `stopDecay` finds only its declaration and the dep wiring)
- severity: medium

## buildToolActivateBindings mints the same binding id twice for a third spec of one tool on one key
- where: packages/core/src/interactions/actions/defaults/toolActivate.ts:32 (buildToolActivateBindings)
- scenario: specs `[{ toolId: 'zoom', keyOpts: { key: 'z' } }, { toolId: 'zoom', keyOpts: { key: 'z', alt: true } }, { toolId: 'zoom', keyOpts: { key: 'z', shift: true } }]`. The first gets `tool.activate.zoom`; the second and third both get `tool.activate.zoom.z`, because the disambiguated id uses only the key and ignores the modifiers. Two bindings sharing an id collide wherever bindings are keyed by id (overrides, the key sheet, rebinding), so one shortcut shadows or replaces the other.
- evidence: read
- severity: low

## Fit Content ignores `axis`, though the option says key zoom holds to one axis and only Cmd+0 resets both
- where: packages/core/src/interactions/actions/defaults/viewportZoom.ts:199 (createViewportZoomAction, `case 'fit'`)
- scenario: `createViewportZoomAction({ axis: 'x' })` on a timeline-style canvas. Cmd+Alt+0 (a key zoom) runs `fitViewToBounds(content, host, current, …)` with no axis, so it rescales and moves the y axis too. `ViewportZoomOptions.axis` (line 48) says the other axis "keeps its scale and its translation" for key zoom and names Cmd+0 as the only exception. Either fit should keep the locked axis's scale and translation, or the doc should name fit as a second exception.
- evidence: read
- severity: low

## containerScroll hit-tests a nested scroll container even where its scrolled parent clips it out of view
- where: packages/core/src/interactions/actions/defaults/containerScroll.ts:86 (scrollablesAt visit / shownAt)
- scenario: an `overflow: 'scroll'` container P holds a scrollable child C, and P is scrolled so C sits past P's bounds, out of view. `visit` tests every non-hidden node's own shown box (`composeWorldPose(view, …)`) and never intersects it with the ancestors' boxes, so a wheel over the empty canvas just outside P, where C would sit unclipped, finds C, scrolls content nobody can see, and the viewport does not pan. Expected: a container counts as under the point only where every scrolling ancestor shows it.
- evidence: inference (read the hit-test; did not confirm that the renderer clips a scroll container's children)
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

<!-- done: 5 findings, files read: 17 -->
