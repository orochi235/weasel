# Audit round 58 — ui.components.Menu

Area files are unchanged between b400d7039e and the checked-out HEAD (`git diff --stat` empty for the directory).

## A release over a color row presses it but never opens its picker, while a click on the same row does
- where: packages/ui/src/components/Menu/MenuPanel.tsx:107 (MenuPanel, `onRelease`), against :103 (`onPress`)
- scenario: a menu opened with `releaseRuns` (a menu bar's press-drag-release). The user drags onto a color row with a `set` and releases. `onRelease` calls only `c.press(level, i)`, which for a color row only highlights it (`openAt` in packages/menu/src/controller.ts:117). The picker never opens and the menu sits open, highlighted on the row. A click on the same row runs `onPress`, which calls `c.press` and then `pick(i)`, so it opens the picker. Enter does the same (:71). The release path should call `pick(i)` too, as the click path does. The text and number rows have the same gap: a release presses them, but their field never gets focus.
- evidence: read
- severity: medium

## A modified release on a link row opens the tab with `window.open` and no `noopener`, so the opened page gets `window.opener`
- where: packages/ui/src/components/Menu/MenuPanel.tsx:110 (MenuPanel, `onRelease`)
- scenario: with `releaseRuns` armed, the user releases with Meta, Ctrl or Shift held over an item with an `href`. The code calls `window.open(entry.href, '_blank')`, which gives the new page a live `window.opener` back to the app (reverse tabnabbing). A modified click on the same row goes to the browser through the `<a href>` (MenuRow.tsx:56-58), and the browser opens that tab with no opener. So one decision gets two answers, and the release path is the unsafe one. It should pass `'noopener'` (and `'noreferrer'` to match what the anchor sends, if wanted).
- evidence: read
- severity: low

## Text typed into a menu text or number row is thrown away when the menu is dismissed by a press outside or a window blur
- where: packages/ui/src/components/Menu/MenuValue.tsx:57-69 (MenuTextValue `end`/`onBlur`), together with useDismiss.ts:7-15
- scenario: the user types "Layer 2" into a text row, then clicks the canvas. `attachMenuDismiss` handles that pointerdown in the capture phase and calls `close()`. React unmounts the panel when it flushes this discrete update, which happens before the mousedown default moves focus. The input is gone before it can blur, so `onBlur` → `end('blur')` → `c.setText` never runs and the draft is lost. The component's doc says "what is typed is written on Enter or blur", and from the user's side a click elsewhere is a blur. Switching apps loses the draft the same way: window blur closes the menu, and `keepOnBlur` spares only a color input. A number row's `UnitField` draft goes the same way (inference: I did not read UnitField's commit path).
- evidence: inference from read code (event order not run)
- severity: low

## A silently opened trigger menu drops focus to `<body>` when it closes while focus is in a color row's picker
- where: packages/ui/src/components/Menu/useMenuTrigger.tsx:49 (`close`), :84-94 (`inMenuOf`)
- scenario: `show(entries, source, /*silent*/ true)` opens a menu. The user opens a color row's picker, and focus moves into the popover. The popover portals outside every `[role="menu"]`, so it is not inside one in the DOM. The menu then closes (Escape on the panel, a row run, or a dismiss). `inMenuOf(document.activeElement, id)` finds no `role="menu"` ancestor and returns false, and `quietNow` is true, so the button is not focused. Then the popover unmounts with focus inside it, and focus falls to `<body>`. `inMenuOf` should also count the parts registered through `MenuPartsContext`, which `Panels` already treats as inside for dismissal (ContextMenuHost.tsx:97-101). That would make the two answers to "is this inside the menu" agree.
- evidence: read
- severity: low

## Enter on the color picker's native color input pulls focus out to the panel, so the window blur from the native dialog then closes the menu
- where: packages/ui/src/components/Menu/MenuPanel.tsx:60-62 (MenuPanel, `onKeyDown`), with MenuColorValue.tsx:29-47 and useDismiss.ts:11-14
- scenario: the popover is rendered inside the row in the React tree, so its keydowns bubble to the panel's `onKeyDown` through the portal. A keyboard user opens a color row's picker, tabs to the native `<input type="color">` and presses Enter to open the system color dialog. `e.target !== e.currentTarget` holds and the key is Enter, so the panel calls `ref.current.focus()`, taking focus off the color input. The native dialog still opens and blurs the window. `keepOnBlur` then sees `document.activeElement` as the panel, not a color input, and closes the menu while the user is picking. The "a row's field gives focus back on Enter" rule is meant for the text and number fields inside the panel, not for the portaled picker.
- evidence: inference from read code (React portal bubbling; not run in a browser)
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

<!-- done: 5 findings, files read: 16 -->
