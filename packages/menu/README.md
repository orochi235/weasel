# @weasel-js/menu

The headless model behind weasel's context menus: entries (items, separators, submenus), a
controller that owns the highlight, open submenus, keyboard and typeahead behavior, and placement
that keeps a menu on screen. No React, no DOM.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/menu).

## Install

```sh
npm install @weasel-js/menu
```

## How it fits

| Package | Role |
|---|---|
| `@weasel-js/menu` | The model: entries, `createMenuController`, `placeMenu` / `placeSubmenu`. |
| `@weasel-js/routing` | Declared menus (`MenuDef`: a prefs schema drawn as a menu, by `resolveSchemaMenu`) and `MenuHost`, which holds the open menu. |
| `@weasel-js/core` | The `menu.context` action, which opens a menu from a right-click or the ContextMenu key; re-exports `useMenus`. |
| `@weasel-js/ui` | `<ContextMenuHost>`, the DOM renderer, and `useContextMenu` for opening a menu from chrome. |
| `@weasel-js/hud` | `attachMenuHost`, the WebGL renderer. |

The DOM renderer does not use React Aria's `Menu`, which keeps its own state and key handling: a
second copy of the model's that would drift from the WebGL menu's.

## Usage

Declare menus as data, mount one host, and open one from chrome:

```tsx
import { ActionsProvider, useMenus, type MenuDef } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { ContextMenuHost, useContextMenu } from '@weasel-js/ui';

const MENUS: MenuDef[] = [
  { id: 'edit', schema: pref.group('', { duplicate: pref.action('duplicate'), delete: pref.action('delete') }) },
];

function EditButton() {
  const onContextMenu = useContextMenu('edit');
  return <button onContextMenu={onContextMenu}>Edit</button>;
}

function Chrome() {
  useMenus(MENUS);
  return <ContextMenuHost />;
}

// <ActionsProvider><Chrome /><EditButton /></ActionsProvider>
```

Action leaves name registered actions (`duplicate`, `delete`, which act on the selection); a
group drawn `as: 'menu'` is a submenu, and any other group sits inline between separators. And
`EditButton` and `Chrome` must sit under an `<ActionsProvider>`. Any menu opens by id; one with a `when` (`{ bodyTarget, bodyKind }`) also
opens on a right-click of a matching canvas body.

## License

MIT
