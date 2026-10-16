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
| `@weasel-js/routing` | Declared menus (`MenuDef`: sections of action references) and `MenuHost`, which holds the open menu. |
| `@weasel-js/core` | The `menu.context` action, which opens a menu from a right-click or the ContextMenu key; re-exports `useMenus`. |
| `@weasel-js/ui` | `<ContextMenuHost>`, the DOM renderer, and `useContextMenu` for opening a menu from chrome. |
| `@weasel-js/hud` | `attachMenuHost`, the WebGL renderer. |

The DOM renderer does not use React Aria's `Menu`, which keeps its own state and key handling: a
second copy of the model's that would drift from the WebGL menu's.

## Usage

Declare menus as data, mount one host, and open one from chrome:

```tsx
import { useMemo } from 'react';
import { useMenus, type MenuDef } from '@weasel-js/core';
import { ContextMenuHost, useContextMenu } from '@weasel-js/ui';

const MENUS: MenuDef[] = [
  { id: 'row', sections: [[{ action: 'duplicate' }, { action: 'delete' }]] },
];

function Row({ id }: { id: string }) {
  const params = useMemo(() => ({ id }), [id]);
  const onContextMenu = useContextMenu('row', { params });
  return <div onContextMenu={onContextMenu}>{id}</div>;
}

function Chrome() {
  useMenus(MENUS);
  return <ContextMenuHost />;
}

// <ActionsProvider><Chrome /><Row id="a" /></ActionsProvider>
```

Rows name registered actions (`duplicate`, `delete`), and `Row` and `Chrome` must sit under an
`<ActionsProvider>`. Any menu opens by id; one with a `when` (`{ bodyTarget, bodyKind }`) also
opens on a right-click of a matching canvas body.

## License

MIT
