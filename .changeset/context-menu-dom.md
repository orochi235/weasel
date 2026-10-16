---
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

`<ContextMenuHost>` draws the open context menu in the DOM: rows with menu roles, shortcut chips, submenus that open beside their row, keyboard navigation and typeahead, and placement that keeps every panel on screen. It closes on a choice, Escape, a press or wheel outside, and window blur, and gives focus back to where it was. Core now re-exports `useMenuHost`, `useMenus` and the menu types (`MenuDef`, `MenuHost`, `OpenMenu`, `MenuOpenRequest`, `MenuHit`).
