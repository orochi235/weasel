# Audit round 56 — area `ui` — findings

## useEditDraft keeps a stale draft that reappears when the value returns to where the draft began
- where: packages/ui/src/useEditDraft.ts:37 (useEditDraft)
- scenario: commit-only consumer (no `onInput`). A drag sends `onInput(5)` over value 1, so draft = {next: 5, from: 1}. The edit ends without `onChange`/`onCancel` (the case the doc names: "an edit that ended without a commit"), and the value moves to 2 — `shown` is 2, correct. The draft is never cleared, though: when the value later goes back to 1 (an undo, a reset, another client), `same(draft.from, value)` is true again and the control draws 5, a value nobody committed. The doc promises the moved value "leaves nothing to mask the next value"; the draft should be dropped once `value` leaves `from`, not just hidden.
- evidence: read
- severity: medium

## ui's `holdsPositioned` misses `container-type`, `content-visibility: auto` and `will-change: contain`, which gestures' `containsFixed` already answers
- where: packages/ui/src/overlays/blockFrame.ts:24 (holdsPositioned); used by containingBlock, and overlayFrame.ts blockForChildOf / fixedBlockFrom / visibleRegion
- scenario: an overlay portaled into a container under forge's shell (`packages/forge/src/shell/shell.css:37`, `container-type: size`) or any container-query wrapper. That ancestor contains absolute and fixed descendants (layout containment), but `holdsPositioned` returns false because `getComputedStyle().contain` does not reflect `container-type`/`content-visibility`. So `containingBlock`'s fixed-element walk passes it and returns the root, `mountOverlayFrame` returns null ("viewport is right") when the container's only containing-block trait is that, and `visibleRegion` follows a fixed element's chain to the viewport instead of the container — the frame is laid out against the wrong block and the overlay lands offset by the container's position. The same question is answered correctly in `packages/gestures/src/ui/fixedSeat.ts:24` (`containsFixed`, fixed in round 49, 7c05f60de2); this is a second copy that drifted. Its `will-change` regex also lacks `contain`.
- evidence: read
- severity: medium

## Row and roving focus read the main window's `document.activeElement`, so in a popout window focus restore and the tab stop go wrong
- where: packages/ui/src/useRemovedRowFocus.ts:63 (useRemovedRowFocus layout effect); packages/ui/src/useRovingTabIndex.ts:214 (focusedItem); packages/ui/src/useRowNavigation.ts:93 (pending-focus layout effect)
- scenario: a list rendered through a portal into a popout window (a supported case: `packages/theme/README.md:55`, `useNearViewport` in react's CHANGELOG). In `useRemovedRowFocus` the ref callback reads focus from `was.ownerDocument.activeElement` (line 55, right) but the effect reads the global `document.activeElement` (line 63): with focus in the popout, the main document's active element is `body` or whatever it last held, so either a removed row's heir is focused even though another element in the popout took focus, or (main document focused on something) the heir is never focused and focus drops to the popout's body — the one thing the hook exists to prevent. In `useRovingTabIndex`, `focusedItem()` returns null whenever focus is in the popout, so every render's `place(focusedItem())` treats focus as outside and moves the tab stop to `tabStopIndex`/the first item, off the focused item: Tab/Shift+Tab from the focused item then lands on a sibling instead of leaving. `useRowNavigation`'s `document.activeElement !== el` check likewise compares against the wrong document. The same question is answered via `ownerDocument` in `createDomFocusScope` and on line 55 of the same file.
- evidence: read
- severity: low

## Files read
packages/ui/src/alongTrack.ts
packages/ui/src/byRank.ts
packages/ui/src/color/ColorRamp.stories.tsx
packages/ui/src/createDomFocusScope.ts
packages/ui/src/createDomMeasureEnv.ts
packages/ui/src/cssPx.ts
packages/ui/src/cursors/cursors.stories.tsx
packages/ui/src/dlog.ts
packages/ui/src/dropTarget.ts
packages/ui/src/handles.ts
packages/ui/src/icons.gen.ts
packages/ui/src/icons.table.ts
packages/ui/src/index.ts
packages/ui/src/kitSettings.ts
packages/ui/src/nativeProps.ts
packages/ui/src/nodeText.ts
packages/ui/src/optionKey.ts
packages/ui/src/overlays/blockFrame.ts
packages/ui/src/overlays/overlayAnimation.ts
packages/ui/src/overlays/overlayFrame.module.css
packages/ui/src/overlays/overlayFrame.ts
packages/ui/src/overlays/portalHost.tsx
packages/ui/src/pathThrough.ts
packages/ui/src/pbt.fixture.ts
packages/ui/src/rowControls.ts
packages/ui/src/selectionRoving.ts
packages/ui/src/snap.ts
packages/ui/src/themes/testing/mountThemed.tsx
packages/ui/src/tiling.module.css
packages/ui/src/tiling.ts
packages/ui/src/useAsyncOptions.ts
packages/ui/src/useAttachRef.ts
packages/ui/src/useDebouncedText.ts
packages/ui/src/useEditDraft.ts
packages/ui/src/useFieldLocale.ts
packages/ui/src/useIdleSettle.ts
packages/ui/src/useRemovedRowFocus.ts
packages/ui/src/useReorderDragList.ts
packages/ui/src/useRovingTabIndex.ts
packages/ui/src/useRowNavigation.ts
packages/ui/src/useScrollSpy.ts
packages/ui/src/useTextDraft.ts
packages/ui/src/useTypeahead.ts
packages/ui/src/wrapLine.ts

<!-- done: 3 findings, files read: 44 -->
