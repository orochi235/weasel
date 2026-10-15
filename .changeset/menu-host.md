---
'@weasel-js/routing': patch
---

Declared menus. A `MenuDef` lists action ids in sections; tools and contributions carry them as `menus`, and `useMenus` declares them from any component. `<ActionsProvider>` now creates a `MenuHost`, reachable with `useMenuHost()` and as the `menuHost` dep, that picks the menu for a right-click, resolves its rows from the registry, and holds the open menu for a renderer to draw.
