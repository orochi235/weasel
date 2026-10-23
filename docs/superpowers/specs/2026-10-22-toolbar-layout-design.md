# Toolbar layout: reordering items, and moving bars between docks and floating

**Status: designed 2026-10-22, not built.** This document is the spec for the work; nothing in it exists in the tree yet.

For whoever builds and plans this work in `@weasel-js/ui` and the apps that host its toolbars. It answers what a
user can rearrange, how they do it, who decides where things may go, and where the result is kept.

## Intent

Let people arrange their own toolbars:
- put a bar's items in the order they want;
- move whole bars between the places the app offers;
- float a bar over the workspace.

The arrangement belongs to the user and lasts across sessions, so it is a user pref. The app keeps it, not the kit.

**What the user can do is bounded by what the app allows.** An app declares the places a bar can dock, and each
bar declares which of those it fits (decided 2026-10-22). Nothing lets a user stick any bar onto any edge: a vertical
dock exists only where the app provides one, and only bars that can run vertically may go there.

## Goals

- **Reorder items within a bar.** Cmd-drag an item (Ctrl elsewhere) to a new slot; a plain press still clicks it
  (decided 2026-10-22). Alt+←/→ (Alt+↑/↓ on a vertical bar) moves the focused item one slot from the keyboard.
- **Move bars.** When the host enables it, a bar's lead (its name or icon) is a drag handle. Dragging it moves the bar
  to another slot or row of its dock, or to another dock it is allowed in. Dragged past a tear-off distance, it floats
  (decided 2026-10-22: both reorder and float).
- **Float.** A floating bar sits anywhere within the container. It snaps to the container's corners and edges, and
  dropping it on a dock it is allowed in docks it again.
- **Vertical docks.** A dock declares its orientation. A bar laid out in a vertical dock renders with
  `orientation="vertical"`, which `Bar` already supports.
- **Controlled and persisted by the host.** Item order and bar layout are values the host passes in and receives
  changes to. The host stores them as user prefs. Draw keeps them in `ui.surfaces`; other apps decide their own place.
- **Works for curved bars too.** A `Bar` laid along a track shape (`BarAlong`) reorders its items along the run
  the same way. Docks and floating apply to straight bars only.

## Non-goals

- Hiding or adding items (a "customize palette" of available commands). Order only.
- Docks the user creates. Docks are the app's.
- Resizing bars, or wrapping one bar onto two lines.
- Moving an item from one bar to another.

## Anti-goals: failures even if it technically works

- A plain click on a toolbar button starts a drag or is swallowed. Reordering must never cost a click.
- A bar ends up somewhere the app did not offer, or vertical when it was never designed to be.
- The kit stores layout itself (localStorage, its own key), so an app cannot reset, sync or migrate it.
- An item or bar that has been removed from the app since the order was saved breaks the bar or leaves a gap.
  Stored order is a hint: unknown ids are dropped, and new ones take their schema position.

## The model

### Item order, on `Bar`

`Bar` gains two props:
- `order?: readonly string[]` holds the bar's top-level item keys in display order.
- `onReorder?: (order: string[]) => void` is called with the new order after a move. Passing it is what makes a bar's
  items reorderable.

Resolving an `order` against the schema keeps the listed keys that still exist, in their stored order. A key the
schema has that `order` does not is placed at its schema index; a builder can choose how a new key's place is
read, as long as it is stable.

**Items move at two levels, and nothing crosses a group boundary** (decided 2026-10-22). A group (a nested
`section`/`bar`, drawn between dividers) moves as one block among the bar's top-level items. Inside a group, its own
items reorder among themselves. That includes the buttons an `actions` leaf expands into: in draw, each Arrange
group is one `actions` leaf that `BarActions` expands into one button per registered action. So `order` is not one
flat list. It holds the top-level order plus an order per group, keyed by the group's path. Inside an `actions` run
the order names action ids, and an action registered after the order was saved goes at the end of its run.

`'menu'` overflow takes items from the end of the *resolved* order. An item inside the More menu cannot be dragged;
moving one out of the menu is done by moving visible items past it, or from the keyboard. *Builder's call whether the
keyboard can move an item across the menu boundary.*

### Bar layout, in a new container

A new `ui` component, named here `ToolbarDock` (*the name is the builder's call*), owns a container and lays bars out
in it. It takes:
- **docks** the host declares, each with an `id`, an `edge` (`top`, `bottom`, `left` or `right`), and therefore an
  orientation. A dock holds rows, and each row holds bars in order. *Builder's call whether a dock can have more than
  one row on day one; the layout value allows it.*
- **bars**, each with an `id`, the node to render, the dock ids it may sit in, and whether it may float.
- **a layout value** and `onLayoutChange`. The value is plain JSON:
  `{ docks: { [dockId]: string[][] }, floating: { [barId]: placement } }`, where `placement` is the floating anchor
  and offset. Bars absent from the value go to their first allowed dock, at the end of its last row. Unknown ids are
  dropped.
- **`movable`**, which turns bar dragging on. When it is off, the lead is the plain label it is today.

The rest of the container belongs to the host: the workspace sits inside it, and the docks take the edges.

### Floating placement

Floating uses the corner-and-edge snapping that windease's `floatingStrategy` already computes, the code labkit's
`FloatingPanel` calls. *My call:* `@weasel-js/ui` takes `windease` as a dependency so the two share it, rather than
`ui` growing its own copy. Edge snapping beyond corners is new to windease if it is wanted; *builder's call whether
day one snaps to corners only*.

A floating bar keeps the orientation of the dock it left. *Builder's call whether a floating bar may be turned.*

### Saved state outlives a bar's current form

*My call, 2026-10-22:* the host passes the dock every bar id it knows, including those currently hidden or drawn as a
menu or a panel. Only ids the app no longer knows are dropped, so hiding an asset or switching its form keeps its
saved slot and item order for when it comes back. Item order is resolved by one shared function, not inside `Bar`,
so a menu or panel drawing the same asset uses the same order.

## Gestures and keys

| Action | Pointer | Keyboard |
|---|---|---|
| Move an item within its bar | Cmd/Ctrl-drag the item | Alt+←/→ (Alt+↑/↓ when vertical) on the focused item |
| Move a bar within or between docks | Drag its lead | Focus the lead, then Alt+arrows to move a slot, row, or dock |
| Float a bar | Drag its lead past the tear-off distance | *Builder's call* |
| Dock a floating bar | Drop it on an allowed dock | *Builder's call* |

- *My call, 2026-10-22:* a field item (a text or number input) reorders by pointer only. The Cmd-press is taken on
  the field's cell, outside the input itself. Alt+arrows are left alone inside text inputs, where they already move
  the cursor by a word.
- While a drag is in progress, the drop slot is shown, and docks the bar may not enter are shown as unavailable.
- Escape cancels a drag and puts everything back.
- A drag commits one `onReorder` / `onLayoutChange` on release, never one per frame.

## Accessibility

- When `movable` is on, the lead becomes a focusable handle with an accessible name ("Move Tools toolbar") and a
  `DragGrip` glyph. Today it is `aria-hidden`, so this is a change to its role.
- The keyboard moves above are announced: `aria-keyshortcuts` on the handle and on reorderable items, and a live
  region that says the new position.
- A bar that is a `toolbar` keeps its role. Draw's strip today nests toolbars inside the `CommandBar` toolbar; once
  the dock owns the strip, the dock is not itself a `toolbar`.

## Where the state lives

| App | Item order | Bar layout |
|---|---|---|
| draw | `ui.surfaces[id].order` (new field on `SurfaceState`) | a new `ui.toolbars` pref, beside `ui.surfaces` |
| chart, labkit | *their call when they adopt it* | same |

The kit ships no persistence. Reset is resetting the pref.

## Constraints and traps (from the code, 2026-10-22)

- **Pointer capture kills clicks.** Open drag sessions with `{ capture: false }` and capture only once the threshold is
  passed, as `FloatingPanel` and `useRunScroll` do. jsdom cannot show this failure: test that nothing called
  `setPointerCapture` at press, and say in the test that it is a proxy.
- **Overflow measurement finds the lead by `:scope > [data-bar-lead]`** (`useBarOverflow`, `useItemLengths`). Keep the
  lead a direct child of the bar root when it becomes a handle.
- **Curved bars already claim the press.** `useRunScroll`'s capture-phase pointerdown turns any press on a curved bar
  into a run scroll past its slop. A Cmd-press must go to reordering instead; a plain press keeps scrolling.
- **Toolbars already rove arrows.** `ToolPalette` roves focus with the arrows, so the reorder keys need Alt. `Bar`
  deliberately does not rove, so its fields keep plain arrows.
- **`useReorderDragList`** (`packages/ui/src/useReorderDragList.ts`) does list reordering with a threshold, an axis and
  drop resolution. Item reordering should be built on it rather than beside it. It reads the threshold from the
  `gestures.dragPx` kit setting.
- **Draw's strip is a flex row inside one `role="toolbar"`** (`apps/draw/src/CommandBar.tsx`, with
  `surfaces/StripSurfaces.tsx` rendering `SchemaBar`s). **The toolbars move out of it into a dock row of their own,
  under `CommandBar`** (decided 2026-10-22). The menus, record controls and the rest of `CommandBar` stay in its row.
  The dock row and the workspace beneath it are the container bars float in. This visibly adds a row to draw's chrome,
  and it ends the nesting of toolbars inside the `CommandBar` toolbar. Every strip asset the dock lays out is a dock
  entry, whether it is currently drawn as a bar or as a menu button (`SwitchMenus` included).

## Stages

Each stage merges on its own:
1. **Item reorder** on `Bar` (straight and curved): groups as blocks, and items within each group, `actions` runs
   included. Draw stores the order in `ui.surfaces`.
2. **`ToolbarDock`** with docks, rows and bar reordering by the lead, both pointer and keyboard. Draw's toolbars
   move out of `CommandBar` into a top dock row of their own.
3. **Tear-off and floating**, with snapping and re-docking.
4. **Vertical docks**, and draw offering one if it wants: a vertical bar is already a `Bar` mode, so this is mostly
   the dock's layout and the bars' permissions.

## Left to the builder

The component's name, the drop-slot visuals, the tear-off distance, the exact keyboard map for floating and docking,
and the calls marked *builder's call* above.
