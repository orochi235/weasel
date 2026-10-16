---
'@weasel-js/ui': patch
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

`<ContextMenuHost>` draws the open context menu in the DOM: rows with menu roles, shortcut chips, submenus that open beside their row, keyboard navigation and typeahead, and placement that keeps every panel on screen. It closes on a choice, Escape, a press or wheel outside, and window blur, and gives focus back to where it was. Core now re-exports `useMenuHost`, `useMenus` and the menu types (`MenuDef`, `MenuHost`, `OpenMenu`, `MenuOpenRequest`, `MenuHit`).

The gesture dispatcher leaves a key pressed inside an element with `role="menu"` to that menu, so menu keys never fire canvas bindings, even from a `keyboard: 'first'` dispatcher.

`<LayerList>` takes `onRowContextMenu(id, event)`, called on a right-click on a row, so an app can open a context menu for a layer.
