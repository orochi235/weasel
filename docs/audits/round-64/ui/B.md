I couldn't write `.skulkr/out/findings.md` because the write permission was denied, so the whole document follows.

# Audit round 64: area `ui`, blind reviewer

The frozen commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4 does not exist in this checkout (`git cat-file` fails; HEAD is 6f634fabe1). I read the listed files from the working tree as it stands, which has uncommitted edits to several of them. Line numbers are the working tree's.

## walkControls takes over Left and Right inside a text input (or any control that uses arrows) in a row's control cell
- where: packages/ui/src/rowControls.ts:14-29 (walkControls)
- scenario: An ItemList in `grid` mode, or a treegrid, has a row whose control cell holds an `<input type="text">`, `<textarea>`, `[contenteditable]`, `<select>` or `<input type="range">`. All of these match `CONTROL_SELECTOR`, and the callers (useRowInput.ts:73-76, treeGridKeys.ts:24-25) send every Left, Right and Escape from the cell to `walkControls`. So when focus is in the text input and the user presses Left or Right to move the caret, `walkControls` calls `preventDefault()` and moves focus to the next control or back to the row. The caret never moves by arrow key. Shift+Left/Right text selection is taken too, because no modifier is checked, and a range input can't be stepped with arrows. It should leave the key alone when the focused control edits with that arrow or a modifier is held.
- evidence: read
- severity: medium

## useRovingTabIndex keeps the tab stop on an item that a class or style change has hidden
- where: packages/ui/src/useRovingTabIndex.ts:128-133 (listen), 75-79 (canStop)
- scenario: A toolbar item that holds the tab stop is hidden by its own component switching a class to `display: none`, without the toolbar re-rendering. The MutationObserver only watches child-list changes and the `disabled`, `aria-disabled`, `hidden` and `inert` attributes, so `place` never runs again. The stop stays on an element that isn't drawn, every other item has tabindex -1, and Tab skips the whole toolbar. The doc (lines 169-172) promises that an item "not drawn" is passed over, and that changes move the stop without the container re-rendering.
- evidence: read
- severity: low

## createDomFocusScope never lets Tab land on an `<area href>`, though its selector lists it
- where: packages/ui/src/createDomFocusScope.ts:5 (TABBABLE), 19-21 (isTabbable); packages/ui/src/isRendered.ts:2-10
- scenario: The scope holds an image map with `<area href>` links. `isTabbable` requires `isRendered`, but an `area` has no box: `checkVisibility()` returns false, and in the fallback path its default style is `display: none`, which also fails. So `tabOrder` and `moveFocus` skip every image-map link while the browser's own Tab stops on them. That contradicts the doc's "Tab order is the browser's", and the `area[href]` entry in the selector can never match a tabbable element.
- evidence: read
- severity: low

## moveFocus from a focused element outside the tab order jumps to a positive-tabindex item instead of the next one in the document
- where: packages/ui/src/createDomFocusScope.ts:76-78 (moveFocus), `follows` at 45
- scenario: The root holds A, then a focused X with tabindex -1, then B, then P with tabindex 1 (last in the document). The tab order is `[P, A, B]`. X is not in it, so `tabStep` (ui-input/src/tabOrder.ts:12-26) looks for the first entry that comes after X in document order. P is first in the array and comes after X in the document, so it returns P. The browser Tabs from X to B. A document-order search over an order that puts positive tabindex first gives the wrong answer whenever a positive tabindex is present.
- evidence: read
- severity: low

## useRemovedRowFocus reads focus from the element's own document in one place and the global `document` in another
- where: packages/ui/src/useRemovedRowFocus.ts:52 vs 63-64 (useLayoutEffect)
- scenario: A list is rendered through a portal into another window's document (a popped-out panel, an iframe). When the focused row is removed, `rowRef` correctly records it using `was.ownerDocument.activeElement`. The layout effect then checks the main window's `document.activeElement`, which is not that window's body. So it returns early as though something else took focus, and focus is never handed to the row that should take over. That is the exact loss the hook exists to prevent. The effect should read the held element's `ownerDocument`.
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
packages/ui/src/cursors/cursors.stories.tsx
packages/ui/src/dlog.ts
packages/ui/src/dropTarget.ts
packages/ui/src/handles.ts
packages/ui/src/icons.gen.ts
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

I read only the type list, the group list and the mark sections of the generated `icons.gen.ts`, and did not read `cursors/cursors.stories.module.css`.

<!-- done: 5 findings, files read: 48 -->