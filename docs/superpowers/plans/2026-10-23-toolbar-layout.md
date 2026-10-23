# Toolbar Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users reorder a toolbar's items and groups, and move whole toolbars between host-declared docks or float them,
with the arrangement held as a host-owned user pref.

**Architecture:** Item order is a schema transform in `@weasel-js/prefs` (`orderPrefGroup`), so a bar, a menu and a
panel drawing one asset share one order. `Bar` applies it and drives the gesture through a `useBarReorder` hook. Bar
layout is a new `ToolbarDock` in `@weasel-js/ui`, controlled by a JSON layout value. Floating placement moves out of
labkit's `FloatingPanel` into `ui` over windease, so the two share it.

**Tech Stack:** React 19, TypeScript, vitest (jsdom projects plus a `browser` project), windease 2.

**Spec:** `docs/superpowers/specs/2026-10-22-toolbar-layout-design.md`

**Base:** branch `toolbar-layout` from `arc/segmented-along`'s tip (80d8f5244 or later): it moves `useRunScroll`,
`useItemLengths` and the curved-row code into `packages/ui/src/components/Along/` and adds `useReorderDragList`'s
`line` option. Rebase onto `main` once that lands there.

## Global Constraints

- Every changeset is `patch`. Never write a `bump-approved` marker.
- Stored order and layout are hints: unknown ids are dropped; a top-level or in-group key missing from a stored order
  takes its schema index; an action missing from an `actions` run's order goes at that run's end.
- The kit persists nothing. No `localStorage` in `packages/ui` for any of this.
- A plain press on any toolbar item still clicks it. Drag sessions open with `{ capture: false }` and capture only past
  the threshold (`gestures.dragPx` kit setting, else `DRAG_THRESHOLD_PX`).
- A drag commits once, on release. Escape cancels and restores.
- Nothing crosses a group boundary: an item moves among its own group's items; a group moves among its parent's
  items.
- Source files stay under 400 lines and functions under 120 (`npm run check:size`).
- Run tests one file at a time locally: `npx vitest run --project=<project> <file>`. `*.browser.test.tsx` files run on
  the fleet only (`npm run test:fleet -- HEAD`).

## Review Focus

- **An item hidden by a condition, or an action unregistered, while a saved order names it**: the bar draws, the
  others keep their saved order. (Task 1's tests.)
- **Cmd-press then release without moving** on a button: the button's action fires exactly once and no reorder is
  committed. (Task 3's tests.)
- **Cmd-drag on a curved bar**: reorders; a plain drag still scrolls the run. (Task 3's tests.)
- **Alt+← in a number field** inside a bar: moves the caret, does not move the item. (Task 4's tests.)
- **A layout naming a bar the app no longer has, or a dock that is gone**: the dock draws every known bar exactly once.
  (Task 6's tests.)

---

## Stage 1: item order

### Task 1: `orderPrefGroup` and `actions` order in prefs

**Files:**
- Create: `packages/prefs/src/order.ts`, `packages/prefs/src/order.test.ts`
- Modify: `packages/prefs/src/action.ts` (`PrefActions` gains `order?: readonly string[]`), `packages/prefs/src/index.ts`
  (export), `packages/ui/src/components/Prefs/registeredActions.ts` (`actionsLeafActions` honors `leaf.order`)
- Test: `packages/prefs/src/order.test.ts`, `packages/ui/src/components/Prefs/registeredActions.test.ts` (create if absent)

**Interfaces:**
- Produces:
  - `type PrefOrder = Readonly<Record<string, readonly string[]>>`: keyed by container path (`''` for the group's top
    level, a nested group's dotted path, or an `actions` leaf's path); each list names child keys (last path segment) or,
    for an `actions` leaf, action keys.
  - `resolveOrder(keys: readonly string[], stored: readonly string[] | undefined, missing: 'schema' | 'end'): string[]`
  - `orderPrefGroup(group: PrefGroup, order: PrefOrder | undefined, path?: string): PrefGroup`, which returns `group`
    itself when `order` is empty or names nothing that applies.

- [ ] **Step 1: Write the failing tests**

```ts
test('resolveOrder keeps stored keys that still exist, in stored order', () =>
  expect(resolveOrder(['a', 'b', 'c'], ['c', 'x', 'a'], 'schema')).toEqual(['c', 'a', 'b']));
test("resolveOrder puts a key the store lacks at its schema index", () =>
  expect(resolveOrder(['a', 'n', 'b', 'c'], ['c', 'b', 'a'], 'schema')).toEqual(['c', 'n', 'b', 'a']));
test("resolveOrder 'end' puts a key the store lacks last", () =>
  expect(resolveOrder(['a', 'n', 'b'], ['b', 'a'], 'end')).toEqual(['b', 'a', 'n']));
test('orderPrefGroup reorders the top level and a nested group, each by its own path', ...);
// group children { x: leaf, g: group{ p, q }, y: leaf }, order { '': ['y','g','x'], 'g': ['q','p'] }
// → Object.keys(result.children) = ['y','g','x'], Object.keys(result.children.g.children) = ['q','p']
test('orderPrefGroup sets an actions leaf’s order from its path', ...);
// children { run: actions leaf }, order { run: ['b','a'] } → result.children.run.order = ['b','a']
test('orderPrefGroup returns the same object when there is nothing to apply', ...); // toBe(group)
```

And in `registeredActions.test.ts`: `actionsLeafActions` with `leaf.order = ['b']` over registered `a`, `b`, `c`
yields keys `['b', 'a', 'c']`.

- [ ] **Step 2: Run** `npx vitest run --project=weasel-ui packages/prefs/src/order.test.ts`. Expected: FAIL, the module
  doesn't exist.
- [ ] **Step 3: Implement** `order.ts` (pure, no React), the `PrefActions.order` field (doc: "Action keys in the order
  to draw them; one not named goes at the end"), and the sort in `actionsLeafActions` using `resolveOrder(..., 'end')`.
- [ ] **Step 4: Run** both test files. Expected: PASS.
- [ ] **Step 5: Commit** "order a prefs group's children and an actions run by a stored order".

### Task 2: `Bar` takes `order`, and marks what can move

**Files:**
- Modify: `packages/ui/src/components/Bar/Bar.tsx` (props), `BarLayout.tsx` (`BarLayoutProps` passes reorder through),
  `barItems.tsx` (`BarItem` gains `in` and `unit`), `BarActions.tsx` (each button's wrapper carries the unit attributes)
- Create: `packages/ui/src/components/Bar/barOrder.ts` (attribute names, and `movedOrder` below)
- Test: `packages/ui/src/components/Bar/Bar.order.test.tsx`

**Interfaces:**
- Consumes: `PrefOrder`, `orderPrefGroup` (Task 1).
- Produces:
  - `BarProps.order?: PrefOrder` and `BarProps.onReorder?: (order: PrefOrder) => void`. `Bar` draws
    `orderPrefGroup(schema, order)`.
  - DOM contract, set only when `onReorder` is given:
    - `data-bar-unit="<key>"` and `data-bar-in="<container path>"` on every cell, and on every button of an `actions`
      run, whose container is the leaf's path and whose key is its action key;
    - `data-bar-group="<path>"` on the first and last item of each group's run.
    The constants live in `barOrder.ts`: `BAR_UNIT`, `BAR_IN`, `BAR_GROUP`.
  - `movedOrder(order: PrefOrder, container: string, keys: readonly string[], from: number, to: number): PrefOrder`
    returns `order` with `container`'s list set to `keys` with index `from` moved to `to`.

- [ ] **Step 1: Write failing tests** in `Bar.order.test.tsx`:
  - `order` changes the drawn order of cells (`getAllByRole('button')` names in the stored order);
  - with `onReorder`, each cell carries `data-bar-unit`/`data-bar-in`, and an `actions` run's buttons carry their action
    key with the leaf path as `data-bar-in`;
  - without `onReorder`, no `data-bar-unit` appears.
  Plus `movedOrder` unit tests for moving down, moving up, and a container with no prior entry.
- [ ] **Step 2: Run** `npx vitest run --project=weasel-ui packages/ui/src/components/Bar/Bar.order.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** `barItems` records each item's container path from the `run` it was walked in (`''` at top
  level). `BarActions` reads whether units are marked through a small context set by `BarLayout`, not a prop threaded
  through every cell.
- [ ] **Step 4: Run** the test file plus `Bar.test.tsx` and `Bar.along.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit** "draw a Bar in a stored order, and mark the items and groups a reorder can move".

### Task 3: `useBarReorder`, Cmd-drag along straight and curved bars

**Files:**
- Create: `packages/ui/src/components/Bar/useBarReorder.ts`, `packages/ui/src/components/Bar/useBarReorder.test.tsx`,
  `packages/ui/src/components/Bar/Bar.reorder.browser.test.tsx`
- Modify: `BarLayout.tsx` (`BarLine` wires it), `BarAlong.tsx` (wires it with the run measure),
  `packages/ui/src/components/Along/useRunScroll.ts` (a press with Cmd or Ctrl is not a scroll),
  `Bar.module.css` (the drop mark and the lifted item)

**Interfaces:**
- Consumes: the DOM contract and `movedOrder` (Task 2); `startThresholdDrag` (`@weasel-js/core`); for a curved bar,
  `positionAt` (exported from `useRunScroll` on the base branch), or `useReorderDragList`'s `line` option where it fits.
- Produces: `useBarReorder(opts: { root: RefObject<HTMLElement | null>; order: PrefOrder | undefined; onReorder?: (order:
  PrefOrder) => void; measure: (el: HTMLElement, at: { clientX: number; clientY: number }) => number; }): { onPointerDownCapture: (e: ReactPointerEvent) => void }`.
  `measure` is the distance along the line: the x or y of the point for a straight bar, `positionAt` for a curved one.

Behavior:
- Only a primary press with Cmd (mac) or Ctrl (elsewhere) on a `data-bar-unit` starts one.
- With Shift, the unit is the item's group: every unit sharing its `data-bar-in`, moved as one among its parent's
  units. A top-level item with Shift moves as itself. This is my call: the spec leaves open how a group is grabbed.
- The drop index is where the pointer's `measure` falls against the centers of the same-container siblings.
- While dragging, `data-bar-dragging` goes on the unit and `data-bar-drop="before|after"` on the target sibling.
- Escape cancels. A release past the threshold calls `onReorder` once and swallows the click that follows.
- No capture at press.

- [ ] **Step 1: Write failing tests** in `useBarReorder.test.tsx`, with jsdom boxes stubbed as `Bar.along.test.tsx`
  does:
  - a Cmd-drag from the first cell past the third calls `onReorder` with `{ '': [b, c, a] }`;
  - a plain press, and a Cmd-press released without moving, call nothing, and the click reaches the button;
  - Escape mid-drag calls nothing;
  - Cmd+Shift-drag on an item in group `g` moves `g` among the top-level units;
  - a Cmd-drag inside an `actions` run reorders only that run (`{ run: [...] }`);
  - `setPointerCapture` is not called at press. This is a proxy, since jsdom cannot show a lost click; say so in the
    test.
  In `Bar.along.test.tsx`: a Cmd-press on a curved bar does not scroll the run, and a plain drag still does.
- [ ] **Step 2: Run** each file. Expected: FAIL.
- [ ] **Step 3: Implement** the hook and wire it. `BarLine` passes `measure = (_, p) => vertical ? p.clientY :
  p.clientX`. `BarAlong` passes the run measure. Add `Bar.reorder.browser.test.tsx`: in real Chromium, a Cmd-drag
  reorders and a plain click on the same button runs its action once.
- [ ] **Step 4: Run** the jsdom files. Expected: PASS. The browser file is checked on the fleet at the stage gate.
- [ ] **Step 5: Commit** "reorder a Bar's items and groups by Cmd-drag, along a straight or a curved bar".

### Task 4: Alt+arrow reordering, announced

**Files:**
- Create: `packages/ui/src/components/Bar/useBarReorderKeys.ts`, its `.test.tsx`
- Modify: `BarLayout.tsx` and `BarAlong.tsx` (wire it; `aria-keyshortcuts` on units)

**Interfaces:**
- Consumes: the DOM contract and `movedOrder` (Task 2).
- Produces: `useBarReorderKeys(opts: { root; order; onReorder; vertical: boolean; label?: string }): { onKeyDownCapture:
  (e: ReactKeyboardEvent) => void; announcement: string }`. `announcement` renders into a visually hidden
  `role="status"` element.

Behavior:
- Alt+←/→ moves the unit holding focus one slot. A vertical bar uses Alt+↑/↓; a curved bar uses ←/→ in reading order.
- Alt+Shift moves the unit's group.
- A target that is a text-entry `input` or a `textarea` is left alone, so word motion still works.
- At either end the key does nothing.
- Focus stays on the moved control.
- The announcement reads "`{name}`, `{n}` of `{m}`".

- [ ] **Step 1: Write failing tests:**
  - Alt+→ on the first of three buttons calls `onReorder` with it second, and focus stays on it;
  - Alt+→ inside a `type=number` input calls nothing;
  - Alt+Shift+→ moves the group;
  - the status text names the new position.
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the file and `Bar.order.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit** "move a Bar's focused item or group with Alt+arrows, and announce where it landed".

### Task 5: draw keeps the order in `ui.surfaces`

**Files:**
- Modify: `apps/draw/src/surfaces/types.ts` (`SurfaceState.order?: PrefOrder`), `surfaceState.ts` (`SurfaceBinding`
  gains `order` and `onReorder`), `SchemaSurfaces.tsx` (`SchemaBar` passes both to `Bar`; `SchemaMenu` and
  `SchemaPanel` draw `orderPrefGroup(asset.schema, order)`), and the prefs declaration of `ui.surfaces` if it
  validates its shape (`apps/draw/src/prefs*`)
- Test: `apps/draw/src/surfaces/surfaceState.test.ts`, `apps/draw/src/surfaces/surfaces.test.tsx`
- Create: `.changeset/toolbar-item-order.md` (`@weasel-js/prefs` and `@weasel-js/ui`, `patch`)

- [ ] **Step 1: Write failing tests:**
  - a reorder through the binding writes `ui.surfaces[id].order` and leaves `surface`, `hidden` and `collapsed` as they
    were;
  - the same asset drawn as a menu lists its items in the stored order;
  - hiding and showing the asset keeps the order.
- [ ] **Step 2: Run** `npx vitest run --project=draw apps/draw/src/surfaces/surfaceState.test.ts` (and the other).
  Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** both. Expected: PASS.
- [ ] **Step 5: Commit** "keep each draw toolbar's item order in ui.surfaces, and draw its menu and panel in that order".

**Stage 1 gate:** `npm run test:fleet -- HEAD` and `npm run test:fleet:postbuild -- <sha>` green, then merge to `main`,
`npm run test:fleet` on `main` in the background, and push.

## Stage 2: `ToolbarDock`, docks and rows

### Task 6: the layout model

**Files:**
- Create: `packages/ui/src/components/ToolbarDock/layout.ts`, `layout.test.ts`, `index.ts`

**Interfaces:**
- Produces:
  - `type DockEdge = 'top' | 'bottom' | 'left' | 'right'`
  - `interface DockSpec { id: string; edge: DockEdge }`
  - `interface DockBar { id: string; label: string; docks: readonly string[]; float?: boolean; vertical?: boolean; render: (orientation: BarOrientation) => ReactNode }`
  - `interface FloatPlace { x: number; y: number; anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null; orientation: BarOrientation }`
  - `interface ToolbarLayout { docks: Record<string, string[][]>; floating: Record<string, FloatPlace> }`
  - `resolveLayout(docks: readonly DockSpec[], bars: readonly DockBar[], layout: ToolbarLayout | undefined): ToolbarLayout`:
    - every bar appears exactly once;
    - unknown bar and dock ids are dropped, and empty rows are removed;
    - a bar placed in a dock it no longer allows moves to its first allowed dock's last row;
    - a bar absent from the layout goes to its first allowed dock, at the end of its last row;
    - a floating bar whose `float` is no longer true docks.
  - `moveBar(layout, barId, to: { dock: string; row: number; index: number } | { float: FloatPlace }): ToolbarLayout`
    (pure; a row index one past the last makes a new row).
- [ ] **Steps:**
  1. Test-first the rules above, one test each, plus `moveBar` within a row, across rows, to a new row, and into
     floating.
  2. Run `npx vitest run --project=weasel-ui packages/ui/src/components/ToolbarDock/layout.test.ts`; expect FAIL.
  3. Implement.
  4. Run again; expect PASS.
  5. Commit "model a toolbar dock layout: docks, rows and floating bars, resolved against the bars an app has".

### Task 7: `ToolbarDock` renders docks, and a bar's lead becomes its handle

**Files:**
- Create: `ToolbarDock/ToolbarDock.tsx`, `ToolbarDock.module.css`, `dockContext.ts`, `ToolbarDock.test.tsx`
- Modify: `packages/ui/src/components/Bar/BarLayout.tsx` (the lead reads `useDockHandle()`), `Bar.module.css`,
  `packages/ui/src/index.ts` (export `ToolbarDock` and the layout types)

**Interfaces:**
- Consumes: Task 6.
- Produces:
  - `<ToolbarDock docks bars layout onLayoutChange movable className>{workspace}</ToolbarDock>`. The top, left, right and
    bottom docks sit round `children`, which fills the middle. Docks with no bars take no room.
  - `useDockHandle(): DockHandle | null`, where `DockHandle` is `{ barId: string; props: HTMLAttributes<HTMLElement> }`.
    When it is non-null and the dock is `movable`, the lead is still a direct child of the bar root (overflow measuring
    finds it by `:scope > [data-bar-lead]`). It drops `aria-hidden`, takes `tabIndex=0`, `role="button"`, an
    `aria-label` of "Move `{label}` toolbar", `aria-keyshortcuts`, and a `DragGrip` before the label.
  - The dock root is not a `toolbar`.
- [ ] **Steps:**
  1. Write tests:
     - bars render in their rows;
     - a bar not `movable` keeps an `aria-hidden` lead;
     - when movable, the lead is focusable with that name;
     - a bar with no lead gets a grip-only handle named the same.
  2. Run the tests and expect FAIL.
  3. Implement.
  4. Run again and expect PASS.
  5. Commit "lay toolbars out in docks round a workspace, and make a movable bar's lead its handle".

### Task 8: moving bars by their handle

**Files:**
- Create: `ToolbarDock/useDockDrag.ts`, `useDockDrag.test.tsx`, `ToolbarDock.browser.test.tsx`
- Modify: `ToolbarDock.tsx`, `ToolbarDock.module.css`

**Interfaces:**
- Consumes: `moveBar` (Task 6) and the handle (Task 7).
- Produces: dragging a handle past the threshold lifts the bar.
  - The drop is resolved against the rows of the docks the bar allows, by pointer position. A drop beside a row's ends
    is a new row.
  - Docks the bar may not enter get `data-dock-unavailable`.
  - Escape cancels, and the release calls `onLayoutChange(moveBar(...))` once.
  - Keyboard on a focused handle: Alt+←/→ moves within the row, and Alt+↑/↓ moves to the previous or next row, then
    the next allowed dock.
- [ ] **Steps:**
  1. Test-first:
     - a drag reorders within a row;
     - a drag onto another allowed dock moves the bar there;
     - a drop on a disallowed dock is refused;
     - Escape restores;
     - the keyboard moves the bar;
     - nothing calls `setPointerCapture` at press. This is a proxy; say so in the test.

     The browser test drags a real handle and checks that a button on that bar still clicks once.
  2. Run the jsdom tests and expect FAIL.
  3. Implement.
  4. Run again and expect PASS.
  5. Commit "move a toolbar within and between docks by dragging its handle or by Alt+arrows".

### Task 9: draw's toolbars move to their own dock row

**Files:**
- Modify:
  - `apps/draw/src/CommandBar.tsx`: drop `surfaces`; the `role="toolbar"` row keeps the menus, file, kit groups,
    path, corner, text, compound, record, debug and app.
  - `apps/draw/src/Editor.tsx`: a `ToolbarDock` with one `top` dock wraps the workspace under `CommandBar`.
  - `apps/draw/src/surfaces/StripSurfaces.tsx`: becomes `useStripBars(): DockBar[]`; every strip asset drawn as a bar
    or a menu is a dock bar, `SwitchMenus` included.
  - `apps/draw/src/prefs*`: a new `ui.toolbars` pref holding a `ToolbarLayout`, default `{ docks: {}, floating: {} }`.
  - CSS for the dock row.
- Test: `apps/draw/src/surfaces/surfaces.test.tsx`, plus a new `apps/draw/src/toolbarDock.test.tsx`
- Create: `.changeset/toolbar-dock.md` (`@weasel-js/ui`, `patch`)

- [ ] **Steps:**
  1. Write tests:
     - the strip assets render inside the dock, not inside the CommandBar toolbar;
     - moving a bar writes `ui.toolbars`;
     - hiding an asset keeps its slot (the dock gets every known asset id; a hidden one renders nothing but stays in
       the layout).
  2. Run the tests and expect FAIL.
  3. Implement.
  4. Run again and expect PASS.
  5. Check in a headless browser that draw loads with the dock row under the menus and nothing shifts while bars are
     dragged. Post the screenshot to the wall.
  6. Commit "move draw's toolbars out of the command row into a dock of their own".

**Stage 2 gate:** same as stage 1.

## Stage 3: tear-off and floating

### Task 10: shared floating placement in `ui`

**Files:**
- Create: `packages/ui/src/floating/useFloatingPlacement.ts` and its test, moved from the placement half of
  `packages/labkit/src/primitives/FloatingPanel.tsx`
- Modify: `packages/ui/package.json` (dependency `"windease": "^2.0.0"`), `FloatingPanel.tsx` (uses the hook),
  `package-lock.json`

**Interfaces:**
- Produces: `useFloatingPlacement(opts: { containerRef; panelRef; placement: FloatPlace-like; onPlacementChange; inset?:
  number; snapCorners?: readonly Corner[] }): { style: CSSProperties; startDrag: (e: ReactPointerEvent) => void; dragging: boolean }`.
  The signature is whatever `FloatingPanel` already computes, lifted unchanged. Its tests move with it.
- [ ] **Steps:**
  1. Move the code and its tests, then run `FloatingPanel`'s existing tests (labkit project) and the moved ones; they
     pass unchanged.
  2. Run `npm run check:imports` (a single script, not a suite) and expect it to pass.
  3. Commit "lift FloatingPanel's placement into ui so toolbars can float the same way".

### Task 11: tear off, float, re-dock

**Files:**
- Modify: `ToolbarDock/useDockDrag.ts`, `ToolbarDock.tsx` (a floating layer over the workspace), the module CSS, tests
- Create: `ToolbarDock/floatingLayer.tsx`

**Interfaces:**
- Consumes: `useFloatingPlacement` (Task 10), `moveBar` with `{ float }` (Task 6).
- Produces: dragging a handle more than `TEAR_PX = 24` px across the line of the dock it is in, when the bar has
  `float: true`, makes the bar float under the pointer.
  - On release it is placed with corner snapping, keeping the orientation it had.
  - Dragging a floating bar's handle over an allowed dock shows the drop slot, and releasing docks it.
  - Keyboard: Alt+Enter on a handle floats a docked bar at its current spot, or docks a floating one into its first
    allowed dock. My call; the spec leaves the keys to the builder.
- [ ] **Steps:**
  1. Test-first:
     - tear-off past 24 px floats the bar, and less doesn't;
     - a bar without `float` never tears;
     - a floating bar re-docks on drop;
     - Alt+Enter floats and docks;
     - the placement is written to `layout.floating`.

     The browser test covers tear-off and the corner snap.
  2. Run the jsdom tests and expect FAIL.
  3. Implement.
  4. Run again and expect PASS.
  5. In draw, set every strip bar to `float: true`, then check in a headless browser and post to the wall.
  6. Commit "tear a toolbar off its dock to float over the workspace, and dock it again".

**Stage 3 gate:** same as stage 1. Include `npm run test:fleet:matrix`, since this adds a dependency.

## Stage 4: vertical docks

### Task 12: left and right docks

**Files:**
- Modify: `ToolbarDock.tsx` (left/right docks lay rows as columns and render bars with `orientation: 'vertical'`),
  `useDockDrag.ts` (the axis follows the dock), `layout.ts` (`resolveLayout` and `moveBar` refuse a bar without
  `vertical: true` in a left or right dock), tests
- Create: `packages/ui/src/components/ToolbarDock/lab/ToolbarDock.stories.tsx` (a forge lab with top, left and right
  docks, three bars of which one is horizontal-only, and the layout as a readout), `.changeset/toolbar-dock-vertical.md`

- [ ] **Steps:**
  1. Test-first:
     - a bar with `vertical: true` docks left and renders vertical;
     - one without is refused by drag, by keyboard and by `resolveLayout`;
     - a bar floated from a vertical dock floats vertical.
  2. Run the tests and expect FAIL.
  3. Implement.
  4. Run again and expect PASS.
  5. Screenshot the lab in a headless browser and post it to the wall.
  6. Commit "dock toolbars down the left and right edges where an app offers a dock there and a bar can run vertical".

**Stage 4 gate:** same as stage 1. Then:
- delete this plan and the spec's "not built" status line;
- move anything in the spec still worth keeping into `packages/ui`'s docs for `ToolbarDock`;
- delete the spec;
- update `docs/TODO.md` if any entry covered this.
