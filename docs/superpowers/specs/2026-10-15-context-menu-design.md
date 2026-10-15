# Context menus

**Status: unbuilt (2026-10-15).** Nothing here exists yet; branch `context-menu`. Delete this
file when the last arc merges.

For whoever implements or reviews context-menu support. It answers: what opens a menu, where its
contents come from, and how one menu model draws in both the DOM and WebGL.

## What exists today

The input half is done. A right-click (or a touch long-press nobody claims) is a `contextMenu`
gesture the dispatcher routes to a binding, and the canvas suppresses the browser's menu
(`useSurfaceInput`). `Action` already carries what a menu row shows — `label`, `icon`, `group`,
`shortcut`, `variants`, `enabled(deps, at)`, `active` — and `registry.trigger(id, params)` runs
an immediate action from UI, as `CommandPalette` does. Nothing draws a menu, and no default
binds `contextMenu`.

## Layers

| Package | Adds |
|---|---|
| `@weasel-js/menu` (new) | Headless model: entry types, state machine, placement. Depends on nothing in weasel. |
| `@weasel-js/routing` | `MenuDef`; `menus` on `ToolDef` and `Contribution`; `resolveMenu`; `evaluateEnabled` takes `at` |
| `@weasel-js/core` | `contextMenu` standard action; `menuHost` dep; `clientX`/`clientY` in immediate params for `contextmenu` |
| `@weasel-js/ui` | `<ContextMenuHost>` (DOM renderer); `useContextMenu` for chrome |
| `@weasel-js/hud` | `attachMenuHost(hud)` (WebGL renderer) |

The DOM renderer does **not** use React Aria's `Menu`: it keeps its own state and keyboard
handling, which would be a second copy of the model's and drift from the WebGL menu's.

## Contents: declared menus

A menu is data. Items reference actions; there are no callbacks, so the menu, the palette, the
toolbar and the keyboard run the same commands.

```ts
type MenuDef = {
  id: string;
  /** Canvas only: which hit this menu answers. Chrome names a menu by id. */
  when?: { bodyTarget?: BodyTarget | BodyTarget[]; bodyKind?: string | string[] };
  /** A separator is drawn between sections. */
  sections: MenuDefEntry[][];
};
type MenuDefEntry =
  | { action: string; params?: Record<string, unknown>; label?: string }
  | { submenu: string; label: string; sections: MenuDefEntry[][] }
  | { actionVariants: string };   // one row per ActionVariant
```

- Contributed like bindings: `ToolDef.menus`, `Contribution.menus`, `<SceneCanvas menus>`.
  Definitions sharing an `id` merge section by section in contribution order; a tool's come after
  ambient ones.
- `resolveMenu(def, registry, deps, at)` produces model entries. Label, icon, shortcut chip
  (`actionShortcuts`), enabled and checked (`active`) come from the registry. A disabled item
  shows grayed. An unregistered action, or a section left empty, drops out.
- Choosing an item calls `registry.trigger(id, { ...params, worldX, worldY })`.

## Opening

```
canvas right-click ─▶ dispatcher ─▶ core `contextMenu` action ─┐
                                                               ├─▶ menuHost.open(req) ─▶ renderer
chrome right-click ─▶ useContextMenu(menuId, { params }) ──────┘           │
                                                          item chosen ─▶ registry.trigger
```

**`menuHost`**: a store created by `ActionsProvider`, one per registry, so chrome outside
`<SceneCanvas>` reaches it. `open(req)`, `close()`, `current()`, `subscribe()`; exposed as the
`menuHost` dep and `useMenuHost()`. One menu at a time; opening replaces.
`req = { entries, client: { x, y }, world?, viewId?, source: 'pointer' | 'keyboard' }`.

**Core `contextMenu` action**: immediate, `defaultBinding: { kind: 'contextMenu' }` plus
`Shift+F10` and the `ContextMenu` key. In order:

1. On an unselected body, select it. On empty canvas, leave the selection alone.
2. Pick the first `MenuDef` whose `when` matches `bodyTarget` / `bodyKind`.
3. `resolveMenu`, then `menuHost.open`.

No match does nothing; the browser menu stays suppressed. A keyboard open anchors at the
selection's bounding-box center and starts with the first row highlighted.

**Chrome**: `useContextMenu(menuId, { params })` returns an `onContextMenu` handler. Selecting
the row stays the chrome's job.

**Closing**: an item is chosen, Escape, a press outside, window blur, or the view changing while
open. After a pointer open, focus returns where it was.

## Model (`@weasel-js/menu`)

- `createMenuState(entries)` reduces input to `{ openPath, highlight }`: arrows, Home/End,
  typeahead, →/← into and out of submenus, Enter/Space to choose, Escape closes one level, hover
  opens a submenu after a delay (~200ms), and a pointer heading diagonally into an open submenu
  keeps it open.
- `placeMenu(size, anchor, bounds)` and `placeSubmenu(size, rowRect, bounds)` flip and shift to
  stay inside `bounds`. The renderer measures its panel and passes the size in; the model never
  measures text.

## Renderers

| | DOM `<ContextMenuHost>` | WebGL `attachMenuHost(hud)` |
|---|---|---|
| Draws | portaled elements, `role=menu`/`menuitem`/`menuitemcheckbox`, `aria-disabled` | a hud widget's `DrawCommand`s; text via `textCommandFromRuns` |
| Measures | `getBoundingClientRect` after first layout | `@weasel-js/font` metrics |
| Input | DOM events into the model; real focus on the panel | `onPointer` / `onKey` into the model; claims every gesture while open |
| Bounds | viewport | canvas |
| Accessibility | full | `accessibleName` only |

Both read the same theme tokens.

## WeaselDraw

| Menu | `when` | Sections |
|---|---|---|
| `draw.selection` | selected body | cut, copy, paste, duplicate, delete ‖ group, ungroup ‖ forward, backward ‖ edit path, edit text |
| `draw.canvas` | empty | paste, select all ‖ undo, redo |
| `draw.layerRow` | layer list rows | as `draw.selection`, with `{ nodeId }` |

Ids: `clipboard.cut` / `copy` / `paste`, `duplicate`, `delete`, `group`, `ungroup`,
`reorder.forward` / `backward`, `enterPathEdit`, `enterTextEdit`, `selectAll`, `undo`, `redo`.
Paste from the canvas menu should land at the click; whether `clipboard.paste` reads
`worldX`/`worldY` today is unchecked — check it first and add it if not.

## Arcs

1. **Model and plumbing.** `@weasel-js/menu`; `MenuDef`, `resolveMenu`, `evaluateEnabled(at)`;
   `menuHost`; the core action; client point in immediate params.
2. **DOM and draw.** `<ContextMenuHost>`, `useContextMenu`, draw's three menus, a site demo.
3. **WebGL.** `attachMenuHost` and a HUD demo. Last because nothing needs it yet; the model is
   substrate-free so it lands without rework.

## Testing

| Layer | Test |
|---|---|
| Model | pure units: key table, typeahead, hover delay on fake timers, diagonal allowance, placement flips at each edge |
| `resolveMenu` | merging, dropping unregistered actions, disabled/checked, `at` reaching `enabled` |
| Core action | dispatcher integration: selects an unselected body, matches `when`, carries client point; long-press reaches it |
| DOM | jsdom for roles and keys; a `*.browser.test.tsx` for placement, which jsdom cannot lay out |
| WebGL | command-list assertions per state; a visual baseline per theme mode |
| Draw | right-click a shape, choose Duplicate, the scene has two |

## Out of scope

Logged in `docs/TODO.md`: a general headless-component layer (P4), and a DOM accessibility
mirror for the WebGL menu (P4). Per-app menu editing is not planned.
