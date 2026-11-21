# Audit round 58: ui.components.Menu

## useContextMenu opens a keyboard-invoked context menu as a pointer one, so no row is highlighted
- where: packages/ui/src/components/Menu/useContextMenu.ts:16 (useContextMenu)
- scenario: focus an element whose `onContextMenu` is this handler and press Shift+F10 or the ContextMenu key. The browser fires `contextmenu` (button 0, pointerType '' in Chromium), and the handler always passes `source: 'pointer'`, so `OpenPanels` builds the controller with `highlightFirst: false` and the menu opens with no highlighted row. The canvas path answers the same question the other way: `openContextMenu` (packages/core/src/interactions/actions/defaults/contextMenu.ts:88) opens Shift+F10 menus with `source: 'keyboard'`, and `useMenuTrigger.click` tells keyboard from pointer by `e.detail === 0`. Expected: a keyboard-raised context menu opens with its first row highlighted, as the canvas's does.
- evidence: read
- severity: medium

## Space on a color, number or text row does nothing, where Enter opens its picker or field
- where: packages/ui/src/components/Menu/MenuPanel.tsx:66-75 (MenuPanel onKeyDown)
- scenario: highlight a color row (role `menuitem`, `aria-haspopup="dialog"`) and press Space. The panel intercepts only `Enter` for value rows; Space falls through to `c.key(' ')`, where `keyStep` treats Enter and Space alike and, for a non-item, non-submenu row, does nothing. So Space runs an item and opens a submenu but never opens a color row's picker or focuses a number/text row's field, unlike Enter. Expected: Space activates a value row as Enter does (both are menu-item activation keys, and the controller itself treats them as one).
- evidence: read
- severity: low

## AccessLabel folds a label's clusters differently from the access letter, so a final sigma is never underlined
- where: packages/ui/src/components/Menu/AccessLabel.tsx:9 (accessSpan)
- scenario: a Greek label with access `ς` (or any label whose only matching cluster is `ς`). `accessLetter` folds through `foldText`, which maps `ς` to `σ`; `accessSpan` compares `cluster.normalize('NFC').toLowerCase()`, which leaves `ς` as `ς`, so no cluster matches and nothing is underlined although the letter works from the keyboard. The underline should use the same fold (`foldText`) the letter and `accessMatch` use, so the two can't disagree.
- evidence: read
- severity: low

## A DOM menu taller than the viewport cannot be scrolled, and the keyboard highlight runs off screen
- where: packages/ui/src/components/Menu/Menu.module.css:3 (.panel); packages/ui/src/components/Menu/MenuPanel.tsx:34-52 (placement effect)
- scenario: open a menu (or submenu) with more rows than fit in `window.innerHeight`, e.g. a long list of recent files or fonts. `placeMenu`/`placeSubmenu` can only clamp the panel's top to the viewport's top (`flipOrShift` returns `lo` when the panel is longer than the span), and `.panel` sets no `max-height` and no `overflow`, so the rows below the fold are drawn off screen. Pointer users cannot reach them, wheel over the panel scrolls nothing, and ArrowDown moves `aria-activedescendant` to rows nobody can see, since nothing scrolls the highlighted row into view. Expected: the panel is capped at the viewport's height and scrolls, keeping the highlighted row visible.
- evidence: read
- severity: medium

## A modified release over a link row opens it with `window.open` and no `noopener`, handing the new page `window.opener`
- where: packages/ui/src/components/Menu/MenuPanel.tsx:110 (MenuPanel, MenuRow onRelease)
- scenario: with `releaseRuns` armed (press a menu bar title, drag onto a link row, release with Cmd/Ctrl/Shift held), the panel calls `window.open(entry.href, '_blank')`. The click path for the same row lets the browser follow the `<a href>` itself, which opens without an opener. The release path gives the opened page a live `window.opener` reference to the app, which a cross-origin page can use to navigate the app's tab (reverse tabnabbing). The two paths answer "open this link in a new tab" differently. Expected: `window.open(entry.href, '_blank', 'noopener')`, matching what the anchor's own modified click does.
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

<!-- done: 5 findings, files read: 16 -->
