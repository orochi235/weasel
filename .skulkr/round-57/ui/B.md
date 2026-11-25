# Audit round 57, area `ui` — findings

## A fixed overlay inside a size-container (or `content-visibility: auto`) is placed as though its containing block were the viewport
- where: packages/ui/src/overlays/blockFrame.ts:16 (holdsPositioned), used by containingBlock:45 and overlayFrame.ts fixedBlockFrom/blockForChildOf
- scenario: a popover or tooltip whose portal container sits under an ancestor with `container-type: inline-size` (or `size`), or `content-visibility: auto`. Both apply layout/paint containment, which makes that ancestor the containing block for fixed and absolute descendants. `holdsPositioned` checks `transform`, `filter`, `perspective`, `will-change` and `contain`, but not `container-type` or `content-visibility`, so `containingBlock` walks past it to the root and `blockFrame` returns UNSCALED at (0,0). The overlay's `top`/`left` are then written as viewport coordinates but resolved against the container's corner, so it lands offset by the container's client position. `visibleRegion` misses the same clip for `content-visibility: auto`. It should treat those properties as establishing a containing block, as it already does for `contain: layout|paint`.
- evidence: read
- severity: medium

## `wrapLine` gives the wrong drop index for chips that wrap right to left
- where: packages/ui/src/wrapLine.ts:36 (wrapLine row/pointer), used by components/TokenField/tokenDrag.ts:19
- scenario: a TokenField under `dir="rtl"`, with tokens wrapping over two lines. Each row's position is `line * 1e6 + r.left`, so within a line the DOM order runs with decreasing `left`, while across lines the positions increase. `gapByMidpoint` (ui-input reorder.ts:50) picks forward or backward from the first and last mid only, sees an increasing sequence, and counts `m <= p`. Within each RTL line it counts the wrong side: if a line's mids are [300, 200, 100] and the pointer is at x=250 (between tokens 0 and 1), it returns 2 instead of 1. The ghost marker and the drop land on the mirror gap. `useReorderDragList`'s own `screenLine` handles RTL through `gapByMidpoint`'s backward case, and `useRovingTabIndex` reads `direction`; `wrapLine` assumes left to right ("read left to right").
- evidence: read
- severity: medium

## Clicking the scroll-spy rail on a last section that cannot reach the top shows it for 700 ms, then snaps back to the section before it
- where: packages/ui/src/useScrollSpy.ts:24 (pickActiveSection), :108 (scrollTo release)
- scenario: a settings panel whose last section is shorter than the scroll container. `scrollTo('last')` holds `active = 'last'`, the container scrolls to its maximum, and the last section's top is still below `slack`. On `scrollend` (or the settle timer), `release` calls `measure`, and `pickActiveSection` returns the previous section. The rail highlights the clicked item, then moves to a different one. Plain scrolling to the bottom never marks the last section either. When the container is scrolled to its end, the last section that is visible should win.
- evidence: read
- severity: low

## `createDomFocusScope().tabOrder()` lists elements under `display: none` or `visibility: hidden`
- where: packages/ui/src/createDomFocusScope.ts:15 (isTabbable), :57 (tabOrder)
- scenario: a HUD panel with a collapsed section hidden by a CSS class (`display: none`), not by `[hidden]`. Its buttons have `tabIndex` 0, are not disabled and are not under `[hidden]`/`[inert]`, so `isTabbable` keeps them and the public `tabOrder()` returns them. A consumer that reads `tabOrder()[0]` or its last item to place focus gets an element that cannot take focus. `moveFocus` covers for this only by retrying `focus()`. The doc promises Tab order "over those not … hidden", which the browser also applies to elements that are not rendered.
- evidence: read
- severity: low

## `useIdleSettle` still commits after `enabled` (or `typing.settleWhenIdle`) turns off mid-wait
- where: packages/ui/src/useIdleSettle.ts:28 (useIdleSettle)
- scenario: a user types into a field, which arms the idle timer, and within `idleMs` the field re-renders with `settleWhenIdle={false}` (or the kit setting is switched off). `on` is checked only inside `typed()`, and nothing cancels the pending `after`, so `settle` still runs and commits the draft. A field told not to settle when idle writes once anyway. Turning `on` off should `stop()` the pending timer.
- evidence: read
- severity: low

## `useEditDraft` brings back a stale draft when the value returns to where the abandoned edit began
- where: packages/ui/src/useEditDraft.ts:37 (useEditDraft shown)
- scenario: a commit-only consumer (no `onInput`). An edit sends `onInput(8)` over value 5, so the draft is `{next: 8, from: 5}`, and the edit ends without `onChange` or `onCancel` (the case the doc names: "an edit that ended without a commit"). The value then moves to 6 (shown 6, because `same(5, 6)` is false), but the draft is never cleared. An undo returns the value to 5, `same(draft.from, value)` is true again, and the control shows 8, a value nobody committed. The draft should be dropped once the value moves away from `from`, not only masked.
- evidence: read
- severity: low

## Files read
packages/ui/src/alongTrack.ts
packages/ui/src/byRank.ts
packages/ui/src/color/ColorRamp.stories.module.css
packages/ui/src/color/ColorRamp.stories.tsx
packages/ui/src/createDomFocusScope.ts
packages/ui/src/createDomMeasureEnv.ts
packages/ui/src/cssPx.ts
packages/ui/src/cursors/cursors.stories.module.css
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

<!-- done: 6 findings, files read: 46 -->
