# Menus as layout assets, and a menu bar

**Status: designed 2026-10-16, unbuilt.** Carried in `docs/TODO.md` ("Menus as layout assets")
until it lands. Delete this file when the work merges.

For whoever builds it: the decisions here were made with Mike in conversation; the ones marked
*(builder's call, made in drafting)* were not, and can be revisited.

## Intent

weasel has context menus: a headless model (`@weasel-js/menu`), declared menus in routing
(`MenuDef`), a DOM renderer (`ContextMenuHost`) and a WebGL one (`attachMenuHost`). It has
toolbars as layout assets: a prefs group drawn `as: 'bar'`, whose leaves point at settings
(`alias` leaves) and at registered actions (`action` leaves), edited in `AssetEditor`. What it lacks
is a traditional menu bar — File, Edit, Arrange, View across the top of an app.

The menu bar is built from the toolbar asset system, not beside it. A menu is one more way to
draw a prefs group, so a menu bar is a layout asset like any toolbar, and a context menu becomes
the same shape with a rule for when it opens. One definition of "a menu" serves the menu bar,
context menus and `MenuButton`.

## Goals

- A menu is a prefs group drawn `as: 'menu'`, plain data that survives JSON and opens in the
  asset editor.
- A menu bar is a layout asset whose root is a bar of menu groups, drawn by a kit component.
- Context menus use the same shape; `MenuDef` stops being a separate one.
- `MenuButton` draws with the same renderer and controller as the context menu.
- Any callback becomes a registered action through one line of sugar, so menus never need to
  hold code.
- Access letters (Alt+F opens File) are supported for whoever declares them.
- First consumers: WeaselDraw and labkit.

## Non-goals

- Moving existing controls onto the menu bar. The menu bar holds what is declared for it.
- Making labkit's trial toolbar a layout asset. Probably wanted eventually; a separate job.
- A WebGL menu bar. The WebGL context menu keeps working from the shared model; a bar drawn in
  WebGL is not part of this.

## Anti-goals

- **Wholesale relocation.** Taking controls out of the component that owns them — a trial's
  title bar, WeaselDraw's tool palettes — and putting them on the bar at the top. Mike said no to
  this in so many words. The bar is new surface, not a new home for old UI.
- **A second menu model.** Anything that keeps its own highlight, submenu or key state apart from
  `createMenuController`, as React Aria's `Menu` inside `MenuButton` does today.
- **Code in a menu.** A menu row that carries a callback. That splits menus into saveable and
  unsaveable ones; the sugar below exists so nothing needs to.

## The shape

`PrefGroupAs` (`packages/prefs/src/groups.ts`) gains `'menu'`, and so does `PrefSectionAs`, which
derives from it. The children of a menu group become rows:

| Child | Row |
|---|---|
| `action` leaf naming a registered action | an item: the action's label (or the leaf's `label`), icon, shortcut chip from its bindings, disabled from `enabled`, checked from `active` |
| `action` leaf naming a parametric action's variant (`id:variant`) | an item for that variant |
| `alias` leaf to a boolean setting | a check row that toggles the setting |
| `alias` leaf to an enum setting | a submenu named by the leaf, one row per option, the current one checked *(builder's call, made in drafting)* |
| group or section drawn `as: 'section'` | its rows, with a separator before and after; its name is not drawn *(builder's call, made in drafting)* |
| group drawn `as: 'menu'` | a submenu |

An `action` leaf with `run` and no `action` key draws as a dead row and warns in development,
the way `BarActionButton` treats a missing action *(builder's call, made in drafting)*. Leaves of
other kinds are skipped.

`showIf` and `enableIf` on a group or leaf apply as they do in a bar. A group's `hidden` leaves
are skipped.

Both a menu group and a leaf may carry an access letter: an optional `access: string` of one
character, rather than an `&` in the name *(builder's call, made in drafting)*.

`overflow: 'menu'` on a bar already exists and means something unrelated (the cells past the end
of the line open from a button). The two coexist; the docs for each should say which is which.

## One resolver

`resolveMenu` (`packages/routing/src/menus/resolveMenu.ts`) turns a `MenuDef` into `MenuEntry[]`
today. It becomes the one resolver from a menu group, its `over` schema and its values to
`MenuEntry[]`, for every caller. Resolving alias leaves needs `@weasel-js/prefs`, so routing gains
that dependency; prefs depends on nothing in routing, so there is no cycle.

## Context menus

A `MenuDef` becomes `{ id, when?, menu }`, where `menu` is a group drawn `as: 'menu'`.
`sections: MenuDefEntry[][]` and the `{ submenu }` and `{ actionVariants }` entries go.
`actionVariants` becomes a section of `id:variant` action leaves, or stays as an action leaf
option that expands to every variant *(builder's call)*. Contributions' `menus:`, `useMenus`,
`MenuHost`, `pickMenu` and the `menu.context` action keep working against the new def. Every
existing `MenuDef` (WeaselDraw's `DRAW_MENUS`, the site demos, tests) is rewritten in the same
change.

**Merging.** Today `mergeMenuDefs` (`pickMenu.ts`) joins defs sharing an id section by section,
by position, so a tool can add rows to an ambient menu. With keyed children, defs merge by key:
a child whose key the earlier def already has merges into it (a section's rows append), and a new
key appends at the end *(builder's call, made in drafting)*. A contribution aims at a section by
naming its key.

**Context menus hold actions only.** The menu host sees actions and nothing else: no `over`, no
values, no writes. A setting worth toggling from a context menu goes through an action with
`active`, as `view.grid` already does. An alias leaf in a context menu is skipped, with a
development warning. So a context-menu asset needs no `over`: `LayoutAsset.over` becomes optional
for a layout whose root is a menu *(builder's call, made in drafting)*.

## Renderer and placement

The DOM renderer is the context menu's: `MenuPanel` and `MenuRow` over a `MenuController`. Three
things get added:

- **A rect anchor.** `placeMenu` anchors to a point, and its vertical flip mirrors around that
  point. A menu hanging from a title, or from a `MenuButton`, needs a rect: it opens below the
  rect, flips above it, and is never drawn over it.
- **Access letter underlines,** drawn in a row's label and a menu bar title when a letter is
  declared.
- **Access letters inside an open menu,** handled in the controller beside typeahead: a declared
  letter runs its row, or opens its submenu, and wins over typeahead for that key.

`MenuButton` moves off React Aria's `Menu` onto this renderer. Its rows (`value`, `label`,
`href`, `isCurrent`, `isDisabled`) become `MenuEntry`s. `MenuItemEntry` gains an optional `href`:
the DOM renderer draws that row as a link a modified click opens in a new tab, and the WebGL host
navigates. `MenuEntry.label` stays a `string`, because the WebGL host draws it, so
`MenuButtonItem.label` narrows from `ReactNode` to `string` and `textValue` goes. No call site
passes anything but a string today (`LabHeader`, `LabSwitcher`, labkit's `builtins`, `Specimen`,
`EnumControl`, WeaselDraw's `CommandBar`) *(builder's call, made in drafting)*.

## The menu bar

A kit component, `MenuBar`, takes what `Bar` takes (`schema`, `over`, `values`, `onChange`), where
`schema` is a bar of menu groups. Each menu group is a title; anything else at the top level
draws as it would in a bar *(builder's call, made in drafting)*. It has `role="menubar"`.

Pointer:

- Clicking a title opens its menu. Clicking the open title closes it.
- With a menu open, moving onto another title switches to it.
- Press on a title, drag to a row and release: the row runs.
- Submenus use the aim triangle (`packages/menu/src/triangle.ts`).

Keyboard:

- F10 focuses the bar.
- Left and Right walk the titles; Down or Enter opens one.
- Inside a menu the context menu's keys and typeahead apply; Left or Right at the top level moves
  to the neighboring menu, open.
- Escape closes the menu and focuses its title; a second Escape leaves the bar and gives focus
  back to where it was.

## Access letters

Supported, never required: nothing happens where none is declared.

With the bar closed, Alt plus a declared letter opens that menu. These go through the gesture
dispatcher as key bindings: one `menu.open` action with the menu as a param, its bindings
generated from the declared letters, the way `menu.context` binds Shift+F10 and the ContextMenu
key. Unlike `menu.context`, whose bindings are ambient, these take `scope: 'hotkey'` so a tool
binding on the same key cannot take them.

The chord is the host's choice; Alt is the default. Browsers claim some Alt letters for
themselves — Chrome on Windows opens its own menu on Alt+F, and on macOS Option plus a letter
types a character — which is why it has to be configurable. That is from memory, not measured;
check it in Chrome on Windows before settling the default.

Keys reach a dispatcher through `window` (`attachInput.ts`), so a binding fires with focus in
chrome. A canvas dispatcher acts when it holds the keys (`keyHolder` in `ActionsProvider.tsx`).
A dispatcher with no canvas acts whenever its node is active (`dispatchCore.ts`), and with
`keyboard: 'first'` it listens in the capture phase, ahead of the rest — `LabZoom.tsx` runs one at
lab level for Mod+=/-/0. The menu bar's F10 and access letters run on a dispatcher of that kind,
so they need no canvas to hold the keys. A focused text input blocks every binding
(`channels/keyboard.ts`).

## Commands from callbacks

A hook turns a callback into a registered action:

```ts
useCommand('lab.reset', 'Reset', () => trial.reset(), { enabled, active, keys });
```

It holds the latest callback in a ref, so a new inline function each render does not
re-register; only a change of id, label or options does. It is public API. `useAction` is marked
`@experimental`, and this must not hand consumers that surface: either the hook is the public way
to register a command, or `useAction` is promoted alongside it. The name `useCommand` is the
builder's call.

## Asset editor

`as: 'menu'` needs adding wherever the editor lists or draws group kinds:

- `PrefSchemaEditor/kindSchemas.ts` (the `as` choices)
- `PrefSchemaEditor/Palette.tsx` (`GROUP_ICON`, which the compiler will demand, and the palettes)
- the tree icons in `structureRows.tsx`, `UnplacedTree.tsx`, `SettingsTree.tsx`
- `PrefSchemaEditor/PreviewPane.tsx`, which previews by `as`: a menu previews open
- `PrefSchemaEditor/workspace.ts` `headingOf`, and `AssetList.tsx`: a bar whose children are all
  menus is filed under a new "Menus" heading *(builder's call, made in drafting)*
- `PrefSchemaEditor/loose.ts`

and in each renderer that branches on `as`: in ui, `Bar/BarLayout.tsx`, `Bar/Bar.tsx`,
`Prefs/PrefsForm.tsx`, `Prefs/PrefsPane.tsx`, `Prefs/objectRows.tsx`, `Prefs/ObjectLeaf.tsx`,
`Prefs/RailLayout.tsx`, `Prefs/schema.ts`, `SelectionPanel/panelSections.tsx` and
`SelectionPanel/selection.tsx`; in labkit, `controls/panelRows.tsx` and `config/sectionTree.ts`. In a bar, a menu group opens from a button as a menu. In a form, it draws as
a button that opens it *(builder's call, made in drafting)*.

## Consumers

**WeaselDraw.** A menu bar with File, Edit, Arrange and View sits above the command bar, as a strip
of its own. The command bar stays; commands leave it for the menus over time, and it is deleted
once it is empty. WeaselDraw has no menu bar yet and no real layout asset either: this is the
first app to render one.

File needs actions first: New, Open, Import and Save are hand-wired callbacks in `Toolbar.tsx` /
`CommandBar.tsx` (`saveSvg.ts`, `openSvg.ts`, `fileIO.ts`). They become registered actions, Save
gets ⌘S, and the buttons point at them. Most of Edit, Arrange and View already exist as actions
(`undo`, `clipboard.*`, `group`, `reorder.*`, `align.*`, `view.grid`, `viewport.zoom` and the
rest).

An action leaf names an action or one of its variants, and carries no params; that stays so, and
the saved format does not grow. An action a menu lists by parameter becomes parametric with
variants instead: `viewport.zoom`'s in, out and reset (today params of one action), and New's
paper sizes (today `PAPER_OPTIONS` passed to `onNew(size)` in `CommandBar.tsx`)
*(builder's call, made in drafting)*.

**labkit.** A lab declares menus the way it declares controls, and labkit draws them as a menu
bar across the top of the lab. It holds what the lab header holds today — add trial, theme, the
"Lab actions" contributions such as forge's globals and Info — and what a lab declares at lab
level. Per-trial commands stay on the trial windows.

labkit's commands are plain callbacks (`CommandItem.onActivate`), and only header zoom is a
registered action. It gains one lab-wide `ActionsProvider`, and `LabZoom`'s provider and
dispatcher fold into it. Lab-level commands — the header's, and what a lab declares for its menu
bar — register there through `useCommand`; forge's ⌘I `window` listener becomes one. Per-trial
commands and their keys are untouched: `useTrialKeys.ts` keeps routing a key to the focused
trial *(builder's call, made in drafting, following the anti-goal above)*. Mounting
`ContextMenuHost` and turning `contextMenu` back on in labkit's dispatchers then gives labs
context menus.

## Order

Each is its own arc, landing before the next starts:

1. The shape, the resolver, `MenuDef` folded in, the rect anchor, `useCommand`, the asset editor.
2. `MenuBar` and access letters; `MenuButton` onto the renderer.
3. WeaselDraw: file actions, then its menu bar.
4. labkit: the lab-wide registry and its lab-level commands, then its menu bar.

## Left to the builder

- Package placement of `MenuBar` and `useCommand`.
- How an enum pointer and a variant list draw, within the table above.
- Whether `actionVariants` survives as a leaf option.
- The default access chord, after checking Chrome on Windows.
