# @weasel-js/menu

The headless model behind weasel's context menus: entries (items, separators, submenus, number rows
edited in place, and read-only color rows), a
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
| `@weasel-js/core` | The public `menu.context` action (`contextMenuAction`, `openContextMenu`), which opens a menu from a right-click or the ContextMenu key, with or without a scene; re-exports `useMenus`. |
| `@weasel-js/ui` | `<ContextMenuHost>`, the DOM renderer, and `useContextMenu` for opening a menu from chrome; `<MenuBar>`, a bar of menu groups across the top of an app; `<MenuButton>`. |
| `@weasel-js/hud` | `attachMenuHost`, the WebGL renderer. |

The DOM renderer does not use React Aria's `Menu`, which keeps its own state and key handling: a
second copy of the model's that would drift from the WebGL menu's.

## Decisions

These are not visible in the code; each was a choice between alternatives.

- A menu holds no code. A row names a registered action; `useCommand` turns a callback into one, so
  every menu can be saved as data and edited in the asset editor.
- A menu bar is new surface. Nothing moves onto it out of the component that owns it — a trial's
  title bar, a tool palette, a header — it holds what is declared for it.
- Access letters are supported, never required. The default chord is Alt; Chrome on Windows is said
  to open its own menu on Alt+F, and nobody has checked it there.
- The `role="menubar"` element holds only the titles. Anything else at a bar's top level draws after
  them in declared order, because ARIA allows only menu items in a menubar.
- After a row runs from a menu opened by pointer, focus returns to where it was before the bar.
  Only Escape lands on the title.
- An action naming a parametric action lists every variant in a menu or an `actions` group, but a
  bar `action` leaf naming the bare id draws a dead button: a button is one thing, so a bar names
  the variant (`viewport.zoom:in`).
- An enum draws as radio rows between separators, not as a submenu. A number draws as a row edited
  in place, stepped by `+` and `-` while highlighted, and the menu stays open. Menus sharing an id append
  their children in order with a separator between (a later duplicate key gets `~n`).
- `useCommand`'s `variants` are `ActionVariant`s, so a command's variants carry `tags` like any action's.
- labkit's trials stay separate action roots. The lab's own dispatcher still hears only its own
  node (`hears: 'own'`), as a guard in case trials ever nest. Lab-wide globals are values, drawn
  as enum rows, not commands.
- The WebGL host neither underlines access letters nor marks the current row, though letters work
  there through the shared controller.

## Usage

Declare menus as data, mount one host, and open one from chrome:

```tsx
import { ActionsProvider, useMenus, type MenuDef } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { ContextMenuHost, useContextMenu } from '@weasel-js/ui';

const MENUS: MenuDef[] = [
  { id: 'edit', menu: pref.group('', { duplicate: pref.action('duplicate'), delete: pref.action('delete') }) },
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
