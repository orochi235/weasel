# Menus as layout assets, and a menu bar

**Status: labkit's menu bar is built; WeaselDraw's menu bar is not.** The shape, the resolver,
`MenuDef` folded in, rect placement, `useCommand`, the asset editor's menu cases, access letters,
`MenuButton` on the renderer, `MenuBar` and labkit's menu bar are built; "Consumers" below is what
remains. Carried in `docs/TODO.md` ("Menus as layout assets") until it lands. Delete this file
when the rest merges.

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

## Landed

These are built, so the code is the reference:

- `as: 'menu'` on groups and sections (`packages/prefs/src/groups.ts`), plus `readout` on value
  leaves and an `actions` leaf that stands for every action in one registry group.
- One resolver, `resolveSchemaMenu` (`packages/routing/src/menus/resolveMenu.ts`), serving context
  menus and a bar's menu groups (`BarMenu` in ui).
- `MenuDef` is `{ id, when?, menu }`; `sections`, `submenu`, and `actionVariants` are gone. An
  action leaf naming a parametric action lists every variant; one naming `id:variant` lists that one.
- An action leaf with only `run` is a dead row that warns in development.
- Context menus hold actions only: the menu host passes no values, so boolean and enum leaves
  drop out there, while a bar's menu group resolves them through the bar's `values`/`onChange`.
- `placeMenuUnder(size, under, bounds)` in `@weasel-js/menu` hangs a menu under a rect, flips it
  above the rect, and right-aligns it at the right edge. `MenuOpenRequest.under` and
  `OpenMenu.under` carry the rect; the DOM renderer (`MenuPanel`, `ContextMenuHost`) and the WebGL
  one (hud `placePanels`, `menuWidget`) honor it, and `BarMenu` passes its button's rect.
- `useCommand(id, label, run, options?)` registers a callback as an action, public from
  `@weasel-js/routing/react` and `@weasel-js/core`. `options` is `CommandOptions`: `enabled`,
  `active`, `keys`, `icon`, `tags`. The latest callback is held in a ref, so an inline function does
  not re-register.
- The asset editor files a menu root, or a bar whose children are all menu groups, under a "Menus"
  heading. A menu root holds no pages and previews open: `BarMenu` takes `defaultOpen`, which
  retries as commands register, and `MenuPreview` remounts on edit.
- Access letters inside an open menu: `accessMatch` (`packages/menu/src/access.ts`) runs a
  declared letter's row, or opens its submenu, ahead of typeahead. `AccessLabel` underlines the
  letter in a row and a menu bar title; a declared letter absent from the label still works.
- `MenuButton` draws with the context menu's renderer (`MenuPanel`, `MenuRow`), and
  `MenuItemEntry.href` draws a row as a link.
- `MenuBar` (`packages/ui/src/components/MenuBar/`): a title per top-level menu group, with the
  pointer and keyboard behavior of a desktop menu bar. F10 focuses it, and its `accessChord` (Alt
  by default) with a title's declared letter opens that title's menu. Those two keys are
  `menu.bar` and `menu.open` in `useMenuBarKeys.tsx`, on a no-canvas `keyboard: 'first'`
  dispatcher of the bar's own, as `LabActions.tsx` runs one; `menu.open` takes `scope: 'hotkey'`.
  A focused text input blocks both.

- labkit's menu bar. `<Lab>` runs on one actions registry (`LabActions.tsx`) with `LabZoom`'s
  provider and dispatcher folded in as `lab.zoom` (variants `in`, `out`, `reset`). The dispatcher
  option `hears: 'own'` makes a dispatcher run only its own node's actions. Lab commands:
  `lab.add.<instrument>`, `lab.mode.auto|light|dark`, `lab.item.<id>` for a header item
  (`LabHeaderItem.keys` binds one; forge's ⌘I listener is `lab.item.fg-info`'s key). `<Lab menus>`
  declares menus between the built-in Lab and View, `menuBar` turns the bar off (it is also off
  with `header={false}` and while presenting), and `<Lab contextMenus>` mounts one lab-level
  `ContextMenuHost` that a right-click, Shift+F10 or the ContextMenu key over a trial's camera
  opens. Per-trial commands and `useTrialKeys` are untouched.
- Trials stay separate roots (each `Trial` is `<WeaselProvider isolate>`); the lab's dispatcher
  still uses `hears: 'own'`, as a guard in case trials ever nest.
- labkit's camera context-menu action (`canvas/cameraContextMenu.ts`) is a second copy of core's
  opener, kept because core's is `@experimental` and unexported; filed in `docs/TODO.md`.
- forge's globals are values, not commands: a Globals menu of enum rows through the bar's
  `values`/`onChange`.

The default chord is unverified: Chrome on Windows is said to open its own menu on Alt+F, and on
macOS Option plus a letter types a character (matched by `code`, so it still opens the menu). Nobody
has checked Chrome on Windows; do that before relying on Alt there.

Some builder's calls went differently from the draft: an enum draws as radio rows between
separators, not a submenu; contributions sharing a menu id append their children in order
with a separator between, keeping keys (a later duplicate key gets `~n`), not merge by key;
outside a bar a menu group draws as a panel (`prefAsBox`), not as a button that opens it; the
`role="menubar"` element holds only the titles, and anything else at the top level draws after
them in declared order, because ARIA allows only menu items in a menubar; and after a row runs
from a menu opened by pointer, focus returns to where it was before the bar, so only Escape
lands on the title. The WebGL host does not underline letters or mark `current`, though letters
work there through the shared controller.

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

## Order

`MenuBar`, access letters, `MenuButton` onto the renderer, and labkit's menu bar have landed; what
remains:

- WeaselDraw: file actions, then its menu bar.

## Left to the builder

- The default access chord, after checking Chrome on Windows.
