# Audit round 79 — area `core` (blind reviewer)

## usePublishPointer leaves its view's pointer in the store on teardown
- where: packages/core/src/input/usePublishPointer.ts:74 (usePublishPointer, effect cleanup)
- scenario: a pointer hovers a minimap (`MinimapCanvas` calls `usePublishPointer`) or a labkit overview box, and the surface unmounts or its ref swaps to another element while the pointer is still over it. The cleanup removes listeners and releases the held set but never calls `clear()`, so the store keeps `{ viewId: <gone view>, world }` until some other view publishes. `usePointerPosition` readers (cursor readouts, a crosshair in another view) keep showing a position over a view that no longer exists. The cleanup should clear the store when the last published `viewId` is still this surface's, as `clear` already does on leave.
- evidence: read
- severity: medium

## extensionParts drops every path-edit extension part when `AnchorState.getNode` is not supplied
- where: packages/core/src/affordances/pathAnchors.ts:193 (extensionParts)
- scenario: a consumer passes `extensions: [ext]` with `ext.parts` but no `getNode` (it is optional in `AnchorState`). `node` is `undefined`, so `regions()` returns `[]`: the extension's parts are neither painted nor hittable, with no error. Either `getNode` is required when `extensions` carries parts (types should say so) or the part should still be built, with `node` absent.
- evidence: read
- severity: low

## createDragPanContribution's plain-drag pan refuses any modified drag, unlike the middle-drag entry and the hand tool
- where: packages/core/src/tools/builtin/hand/createDragPanContribution.ts:17 (panEntry)
- scenario: a viewer canvas adds `createDragPanContribution()` to pan on a drag no tool claims. The primary spec is `{ kind: 'drag' }` with no `mods`, which per the dispatcher's rule matches only an unmodified drag, so Shift- or Alt-drag (with nothing else bound) does not pan, while the middle-button entry and the hand tool take `ANY_MODS`. The same "what modifiers does a pan take" question is answered two ways; the doc ("pans the view on a drag no tool claims") promises the any-mods behavior.
- evidence: read
- severity: low

## makeMatchMedia's MediaQueryList snapshots `matches` at creation, so a held list reads stale after `fire()`
- where: packages/core/src/testing/matchMedia.ts:13 (makeMatchMedia → mm)
- scenario: code under test calls `matchMedia(q)` once, keeps the list, and reads `mql.matches` in its change listener (a common pattern, and what the real `MediaQueryList` supports since its `matches` is live). After `fire(q, true)` the double's `matches` is still the value from creation, so the test sees no change and the two hooks the doc names can disagree depending on whether they read `e.matches` or `mql.matches`. `matches` should be a getter over `state[query]`.
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

<!-- done: 4 findings, files read: 37 -->
