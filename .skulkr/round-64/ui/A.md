# Audit round 64, area `ui` — reviewer findings

## walkControls takes Left/Right away from a text input, select or range in a row's control cell
- where: packages/ui/src/rowControls.ts:14-30 (walkControls)
- scenario: an ItemList in `grid` mode (or a Tree row) whose trailing control cell holds an `<input>` (a rename
  or number field), a `<select>`, or an `<input type=range>`; all of them match `CONTROL_SELECTOR`. With focus in
  the input, ArrowLeft/ArrowRight reach `useRowInput`/`treeGridKeys`, which call `walkControls`; that calls
  `e.preventDefault()` unconditionally and moves focus to the neighboring control or back to the row. So the caret
  cannot move inside the text, and a range cannot be stepped with the arrows. It should leave the arrow keys to a
  control that edits its own value with them (the rule `useRovingTabIndex`'s doc states for compound controls),
  only walking off buttons/checkboxes/links. Escape is unaffected.
- evidence: read (rowControls.ts; callers packages/ui/src/components/ItemList/useRowInput.ts:73-77 and
  packages/ui/src/components/Tree/treeGridKeys.ts:24-25; CONTROL_SELECTOR in
  packages/gestures/src/ui/controlTarget.ts:2 includes input, select, textarea)
- severity: medium

## useScrollSpy drops a clicked section in a container that does not scroll, or one that cannot reach the top
- where: packages/ui/src/useScrollSpy.ts:43-46 (heightAtEnd), with pickActiveSection at :29-40 and release at :162-170
- scenario: a settings panel whose sections all fit (`scrollHeight <= clientHeight`). `heightAtEnd` returns
  undefined for it, so `pickActiveSection` only ever marks the section at the top. Click "Advanced" (the third
  section) in the rail: `scrollTo` holds "Advanced", nothing scrolls, the 700 ms settle timer fires `release`,
  `measure` runs and the rail snaps back to the first section (or to null). A container that is scrolled as far as
  it goes because it cannot scroll at all is the case `endHeight` exists for. The same release step also replaces
  a clicked middle section that cannot reach the top with the last visible one: short sections B, C, D at the end,
  click C, the scroll stops at the end and D is marked.
- evidence: read
- severity: low

## The roving and row-focus hooks read the global `document`'s focus, not their container's document
- where: packages/ui/src/useRovingTabIndex.ts:220-223 (focusedItem); packages/ui/src/useRemovedRowFocus.ts:63-64
  (the layout effect); packages/ui/src/useRowNavigation.ts:93
- scenario: a toolbar or list portaled into another document (a popout window or an iframe the app renders
  into, which `createDomMeasureEnv` and `createDomFocusScope` in this same area are written to support through
  `ownerDocument`). Focus on item 3 of a roving bar with `tabStopIndex: 0`; any re-render runs
  `place(focusedItem())`, `document.activeElement` is the opener's body, so `focusedItem()` is null and the stop
  moves to item 0 while item 3 holds focus; Shift+Tab from item 3 then lands on item 0 inside the bar instead of
  leaving it. In `useRemovedRowFocus`, the "something else took focus" guard reads the opener's `activeElement`
  (its body), so it refocuses the heir row even when another element of the popout took focus in that commit, while
  `rowRef` in the same file correctly reads `was.ownerDocument.activeElement`.
- evidence: read
- severity: low

## useRovingTabIndex keeps the tab stop on an item hidden by a class or style change
- where: packages/ui/src/useRovingTabIndex.ts:128-133 (listen, the MutationObserver)
- scenario: `canStop` passes over an item that is not drawn (`isRendered`: `display: none`, `visibility: hidden`),
  but the observer that re-places the stop when "children change without this component rendering" only watches
  `disabled`, `aria-disabled`, `hidden` and `inert`. An item (or its wrapper) hidden by toggling a class or a
  `style` — a child component collapsing itself, an overflow toolbar hiding what does not fit — keeps
  `tabIndex = 0` while every other item has -1, so Tab skips the whole container until something re-renders the
  hook's owner.
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
packages/ui/src/icons.table.ts
packages/ui/src/index.ts
packages/ui/src/isRendered.ts
packages/ui/src/kitSettings.ts
packages/ui/src/measureContext.ts
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
packages/ui/src/revealInBox.ts
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

(packages/ui/src/icons.gen.ts was only skimmed — its exports and the start of ICON_GROUPS — as a generated file; not counted.)

<!-- done: 4 findings, files read: 48 -->
