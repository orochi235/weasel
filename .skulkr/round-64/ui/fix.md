walkControls takes Left/Right from a text field, select, or range in a row's control cell (A+B): fixed f7a38dad42. The fix also leaves Up/Down to such a control in `ItemList` and `Tree`, which took them the same way.

useScrollSpy drops a clicked section in a container that does not scroll, or one that cannot reach the top (A): fixed d51dceab66

Roving and row-focus hooks read the global `document`'s focus (A): fixed 5d05e64995

useRovingTabIndex keeps the tab stop on an item hidden by a class or style change (A): duplicate of B's "keeps the tab stop on an item that a class or style change has hidden"

walkControls takes over Left and Right inside a text input (B): duplicate of A's walkControls finding, fixed f7a38dad42

useRovingTabIndex keeps the tab stop on an item a class or style change hid (B): fixed d28be5c274

createDomFocusScope never lets Tab land on an `<area href>` (B): fixed 770b1221bd

moveFocus from a focused element outside the tab order jumps to a positive-tabindex item (B): fixed 02b70ba122

useRemovedRowFocus reads focus from the global `document` in its layout effect (B): duplicate of A's global-`document` finding, fixed 5d05e64995

[r56-2] holdsPositioned misses `container-type`, `content-visibility: auto`, and `will-change: contain` (carried): fixed 9c9ce2b908. `container-type` and `content-visibility` were already handled; `will-change: contain` was still missed. ui now uses one predicate, `containsFixed`, newly exported from gestures, which also adds `content-visibility: hidden` to gestures' own check.

[r56-3] Row and roving focus read the main window's `document.activeElement` (carried): duplicate of A's global-`document` finding, fixed 5d05e64995

Extra defects:
- Seven ui components compared the global `document.activeElement` with an element they held (UnitField's wheel, GradientStops, MenuBar's hasFocus, EffectList, useDockDrag, useBarReorderKeys, the Timeline lane): fixed 2d08b34489
- Menus and tooltips read the global document's focus too, and `useDismiss` listens on the global `window` (useMenuTrigger, ContextMenuHost, useDismiss, useMenuBarFocus, Tooltip): not fixed, filed in `docs/TODO.md` 1432498feb. Fixing them means moving each window-level listener to the window the menu's own panel is rendered into, which is too big for this pass.
- The HUD's moveFocus from a hidden focused widget made the same mistake as createDomFocusScope and skipped ahead to a widget with a declared `tabOrder`: fixed a8de12f955, plus c214c0e329 to move its comparison out of createHud for check:size

Follow-up commit: fd6cc295c4 shortens the changeset titles to under 140 characters for check:changesets.

Checks:
- vitest, one file at a time, all pass: ItemList.test.tsx, Tree.controls.test.tsx, Tree.test.tsx, useRovingTabIndex.test.tsx, useRovingTabIndex.disabled.test.tsx, useRovingTabIndex.rtl.test.tsx, useRemovedRowFocus.test.tsx, useRowNavigation.test.tsx, useScrollSpy.test.tsx, createDomFocusScope.test.ts, createDomFocusScope.pbt.test.ts, UnitField.wheel.test.tsx, UnitField.test.tsx, MenuBar.test.tsx, EffectList.test.tsx, Lane.test.tsx, blockFrame.test.ts, overlayMarker.test.tsx, overlayPortal.test.tsx, reactAriaPin.test.ts, gestures fixedSeat.test.ts, hud focus.test.ts, hud.focus.pbt.test.ts, text-dom useTextEdit.overlayFrame.test.ts, text-tools useSceneTextEdit.frame.test.ts
- Not run here (browser): ItemList.removedFocus.browser.test.tsx, Tree.removedFocus.browser.test.tsx, overlayTheme.browser.test.tsx
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed check:size on hud.ts; c214c0e329 fixed it.
- `npm run check:changesets`: "OK — 3440 changeset(s)."
- `npm run lint -w` for ui, hud, and gestures: fail, `Missing script: "lint"`. None of the three packages has a lint script, so I ran eslint on every changed .ts/.tsx file instead: exit 0, no output.
- No unruled calls were needed. The tree is clean.

tally: 11 of 11 fixed, 2 extra fixed