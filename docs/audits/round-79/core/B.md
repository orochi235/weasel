# Audit round 79 — area `core` (blind reviewer)

## usePublishPointer leaves the store holding a pointer over a view that has unmounted
- where: packages/core/src/input/usePublishPointer.ts:73 (usePublishPointer, setup's teardown)
- scenario: the pointer rests over a canvas whose surface unmounts (a page switch, a conditional render, the ref's element swapped for another) or whose `store` changes. The teardown removes the listeners and releases `held`, but never calls `clear()`, so the pointer store keeps `{ viewId, world }` for a view that no longer exists. Readers of `usePointerContext` (status readouts, cursor-position HUDs, anything keyed on `viewId`) go on reporting a live pointer position over a gone view until another view publishes. The hook's own contract says the store is cleared when the pointer leaves with nothing held; an unmount is that same leave, with no `pointerleave` to fire it. Teardown should run `clear()`, which already leaves the store alone if another view has published since.
- evidence: read
- severity: low

## Files read
packages/core/src/WeaselProvider.tsx
packages/core/src/affordances/annulusPaint.ts
packages/core/src/affordances/composeAffordanceLayer.ts
packages/core/src/affordances/hitAffordanceRegions.ts
packages/core/src/affordances/index.ts
packages/core/src/affordances/pathAnchors.ts
packages/core/src/affordances/types.ts
packages/core/src/icons.gen.ts
packages/core/src/icons.table.ts
packages/core/src/index.ts
packages/core/src/input/keyState.ts
packages/core/src/input/useElementEffect.ts
packages/core/src/input/useKeyModifiers.ts
packages/core/src/input/useKeyState.ts
packages/core/src/input/usePublishPointer.ts
packages/core/src/kitSettings.ts
packages/core/src/kitSettingsSchema.ts
packages/core/src/layout/index.ts
packages/core/src/layout/types.ts
packages/core/src/test-hook/createTestHook.ts
packages/core/src/test-hook/install.ts
packages/core/src/test-hook/types.ts
packages/core/src/test-hook/useTestHook.ts
packages/core/src/testing/BareCanvas.tsx
packages/core/src/testing/canvas.ts
packages/core/src/testing/canvasPixels.ts
packages/core/src/testing/matchMedia.ts
packages/core/src/tools/builtin/hand/createDragPanContribution.ts
packages/core/src/tools/builtin/hand/index.ts
packages/core/src/tools/builtin/hand/useHandTool.ts
packages/core/src/tools/builtin/index.ts
packages/core/src/tools/builtin/marquee.ts
packages/core/src/tools/builtin/throughChrome.ts
packages/core/src/tools/index.ts
packages/core/src/tools/overlayBinding.ts
packages/core/src/tools/useKeybindings.ts
packages/core/src/version.ts

<!-- done: 1 findings, files read: 37 -->
