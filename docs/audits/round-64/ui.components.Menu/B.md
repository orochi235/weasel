I wasn't allowed to write `.skulkr/out/findings.md`, so the whole document is below. Also, this tree's HEAD is `6f634fabe1`, not the `49e5a07e` the brief names, so the line numbers are from `6f634fabe1`.

# Audit round 64: ui.components.Menu

## A panel is placed and sized once, when it mounts, so a row that grows while the menu is open pushes it past the viewport and leaves the controller's panel rect stale
- where: packages/ui/src/components/Menu/MenuPanel.tsx:123-144 (usePlacement)
- scenario: A menu sits near the viewport's right edge and has a color row with no color yet (it shows `—`) or a number row (`UnitField width="fit"`). The user picks a color in that row's picker, or types a longer number.
  - The row's value column widens (`—` becomes a swatch plus `#rrggbb`).
  - The fixed panel grows to the right, past `window.innerWidth`. Placement never runs again: its deps are `[c, level, anchor]` with exhaustive-deps disabled.
  - `c.setPanel(level, …)` still holds the width and height measured at mount, so the controller's geometry no longer matches the panel on screen.
  - Expected: place the panel again, and report its new rect, whenever its own size changes (for example with a ResizeObserver).
- evidence: read
- severity: low

## A text row's typed draft is lost when the menu closes any way other than through useDismiss
- where: packages/ui/src/components/Menu/MenuValue.tsx:57-69 (MenuTextValue end/onBlur); packages/ui/src/components/Menu/ContextMenuHost.tsx:54-83 (OpenPanels)
- scenario: The user focuses a text row's field and types without pressing Enter. The menu then goes away without a press or wheel outside, a resize or a window blur. Examples: the app calls `host.close()` or `host.open()`, or a menu bar swaps the `open` it hands to `OpenPanels` (keyed by `seq`, so the panels unmount).
  - The focused `<input>` is removed from the DOM. Browsers then move focus without firing `blur`.
  - So `onBlur` → `end('blur')` → `c.setText` never runs, and the draft is dropped.
  - `useDismiss` blurs the field first precisely so the typed text is kept. Whether it survives therefore depends on which path closed the menu.
  - Expected: commit the draft on every way the menu closes, either on unmount or by blurring the focused field when OpenPanels tears down.
- evidence: read
- severity: low

## A trigger menu opened silently leaves focus on the body when it is dismissed while one of its fields has focus
- where: packages/ui/src/components/Menu/useMenuTrigger.tsx:49-52 (close); packages/ui/src/components/Menu/useDismiss.ts:13-17
- scenario: A menu is opened with `show(entries, source, true)` (silent). The user moves focus into one of its number or text fields, then resizes the window (or the window blurs).
  - `useDismiss`'s close blurs the field first, so `document.activeElement` is the body when `useMenuTrigger`'s `close` runs.
  - `inMenuOf(body, id)` is false and `quietNow` is true, so the button doesn't get focus.
  - The panel unmounts and focus is left on the body. Focus was inside the menu, which is exactly the case `close` is written to give back to the button.
  - Expected: check whether focus was in the menu before the field is blurred, or have useDismiss blur the field only after `close` has read it.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Menu/AccessLabel.tsx
packages/ui/src/components/Menu/ContextMenuHost.stories.module.css
packages/ui/src/components/Menu/ContextMenuHost.stories.tsx
packages/ui/src/components/Menu/ContextMenuHost.tsx
packages/ui/src/components/Menu/Menu.module.css
packages/ui/src/components/Menu/MenuColorValue.tsx
packages/ui/src/components/Menu/MenuPanel.tsx
packages/ui/src/components/Menu/MenuRow.tsx
packages/ui/src/components/Menu/MenuValue.tsx
packages/ui/src/components/Menu/index.ts
packages/ui/src/components/Menu/menuParts.ts
packages/ui/src/components/Menu/menuUnder.ts
packages/ui/src/components/Menu/useContextMenu.ts
packages/ui/src/components/Menu/useDismiss.ts
packages/ui/src/components/Menu/useMenuPortal.tsx
packages/ui/src/components/Menu/useMenuTrigger.tsx

<!-- done: 3 findings, files read: 16 -->