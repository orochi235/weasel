# Audit round 59 — ui.components.ToolbarDock

## A pointer drag measures the held (unaccepted) layout, then drops the hold and computes the move against the host's layout
- where: packages/ui/src/components/ToolbarDock/useDockDrag.ts:117-131 (useDockDrag onStart / onMove), with dockTear.ts:59 (grabBar)
- scenario: a host that ignores or refuses a move (or has not yet sent the accepted layout back) leaves `held` showing the move. The next press past the threshold runs `grabBar(…, latest.current.layout)` against the DOM drawn from `held.next`, then `setHeld(null)` redraws the DOM from `given`. From then on `onMove` reads `was = latest.current.layout` (now `given`), but `grab.boxes`, `grab.drawn`, `grab.row` and the `grab.empties === null`/`[]` decision all describe the held layout. Row indices and bar slots from `dropAt` are applied to a different layout, so the drop marks and the committed layout land the bar in the wrong row or slot (e.g. bar A moved to row 2 and held; dragging B over "before A" in row 2 commits B into row 2 of `given`, where A is not). A dock that is empty only in `given` gets its strip drawn but `grab.empties` is `[]`, so it never takes a drop. The keyboard path (`onKeyDown`) does the opposite and builds on `held.next`, so the two paths answer "what does the next move start from" differently.
- should: measure after the layout the drag will move against is drawn, and use one base layout for both pointer and keyboard moves.
- evidence: read
- severity: medium

## A dock whose rows hold only hidden bars can never take a dragged bar
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:113,134 (dropAt); ToolbarDock.tsx:82 (empties); dockTear.ts:73 (grabBar empties)
- scenario: the docs say a bar whose `render` gives null keeps its place and takes no room. If every bar in a dock is hidden, the dock still has rows in the layout, so it is drawn as a zero-size element and is not counted as empty (`dockRows(...).length > 0`), so no empty-dock strip is drawn. In `dropAt` its only row has `start === end`, so the "over rows" test (`cross < start || cross >= end`) always skips it, and the new-row band is `max(reach, 0)` wide: zero for a bar without `float`, so only a single exact pixel line hits it. Dragging a bar into, say, a right dock whose only bar the host is currently hiding is impossible, while Alt+arrows can still move it there (drawnLayout keeps the empty rows).
- should: treat a dock with no drawn bars as empty for the drag: draw its strip and accept drops on it.
- evidence: read
- severity: medium

## Drag hit-testing for a left or right dock with two or more columns fails in right-to-left
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:95,113-116,136 (measureDocks, dropAt)
- scenario: `.left > .dock` / `.right > .dock` lay their columns with `flex-direction: row`, which runs right to left under `direction: rtl`, so `rows[0]` is the rightmost column. `measureDocks` reads direction only for horizontal rows; for vertical ones it keeps physical `left/right`. `dropAt` then requires `rows[0].start <= cross < rows.at(-1).end`, which with columns in descending order is impossible once there are two columns (rows[0].start is greater than rows.at(-1).end), so the dock never accepts a drop into any of its columns, and the `while (rows[row + 1].start <= cross)` scan and the `cross < first.start ? 0 : rows.length` new-row side are also reversed. RTL is otherwise supported (horizontal rows read `direction`, CSS has `:dir(rtl)` rules).
- should: order vertical-dock columns by inline direction the way horizontal rows already are.
- evidence: read
- severity: medium

## In right-to-left, an empty left or right dock's drop strip is drawn on the opposite side from where the dock appears
- where: packages/ui/src/components/ToolbarDock/ToolbarDock.module.css:103-111 (.empty[data-dock-edge='left'|'right']) vs :5-9 (.root grid)
- scenario: the root grid's `'left main right'` areas follow the inline direction, so under `direction: rtl` the `left` area (and the `.left` dock) is drawn on the physical right. The empty-dock strip uses physical `inset: 0 auto 0 0` for `left` and `0 0 0 auto` for `right`. Dragging a bar onto the strip shown at the left of an RTL dock creates the dock on the right side, and vice versa.
- should: place the strips with logical insets (`inset-inline-start`/`-end`) to match the grid, or make the grid physical; either way one answer for both.
- evidence: read
- severity: low

## Alt+ArrowLeft/Right move a bar the wrong way on screen in right-to-left
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:176-177,192-193 (keysFor, keyTarget)
- scenario: in a top or bottom dock `keysFor` maps ArrowLeft to "back" (lower index, toward the row's start), with no regard to direction. In an RTL row the start is on the right, so Alt+ArrowLeft moves the bar to the right and Alt+ArrowRight to the left. In a left/right dock under RTL, where columns run right to left, ArrowLeft goes to the previous column, which is to the right. The pointer path reads `direction`; the keyboard path does not.
- should: swap the physical arrows under RTL so a bar moves the way the arrow points.
- evidence: read
- severity: low

## The drag and refocus queries are not scoped to this dock, so a ToolbarDock nested in the workspace gets mixed in
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:58,83 (drawnBars, measureDocks); dockTear.ts:41-42,83 (barElement, measureEmpties); useDockDrag.ts:87 (refocus)
- scenario: each of these uses `root.querySelectorAll('[data-dock]' | '[data-dock-bar]' | '[data-dock-empty]')`, and `root` contains `.main`, the host's workspace children. If the workspace holds another `ToolbarDock` (an inner editor pane with its own docks), the outer drag measures the inner docks too: an inner dock id the bar does not list makes `dropAt` return null over it (blocking the outer drop band behind it); an inner dock with the same id as an outer one (e.g. both `top`) yields a target in the outer layout with the inner dock's row indices. `barElement` and the refocus lookup take the first match by id, and since the floating layer comes after `.main` in the DOM, a floating outer bar whose id is also used by an inner bar measures (and refocuses) the inner one.
- should: query only this dock's own elements (e.g. stop at the nearest root, or match `closest('[data-dock-layer]'/root)` back to this root).
- evidence: read
- severity: low

## A bar that stops reporting its least length keeps the old one, and the per-bar caches never drop removed bars
- where: packages/ui/src/components/ToolbarDock/dockContext.ts:22-25 (useReportDockLeast); ToolbarDock.tsx:87-88 (leasts); useDockDrag.ts:194-201 (useStableHandlers made)
- scenario: `useReportDockLeast` reports in a layout effect with no cleanup, so when the reporting component unmounts (the bar's `render` switches from a `BarLine`/menu bar to content that does not report, or to null and back with different content) the dock's `leasts` keeps its last value and the slot keeps `--dock-least`, holding a squeezed row open for content that no longer needs it. Neither `leasts` nor `useStableHandlers`' `made` map ever deletes the entry of a bar removed from `bars` (barHosts.ts prunes its own map), so a host with generated bar ids grows both without bound.
- should: report `undefined` on unmount, and prune both maps against `bars` as `useBarHosts` does.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/ToolbarDock/ToolbarDock.module.css
packages/ui/src/components/ToolbarDock/ToolbarDock.tsx
packages/ui/src/components/ToolbarDock/barHosts.ts
packages/ui/src/components/ToolbarDock/dockContext.ts
packages/ui/src/components/ToolbarDock/dockDrop.ts
packages/ui/src/components/ToolbarDock/dockTear.ts
packages/ui/src/components/ToolbarDock/floatingLayer.tsx
packages/ui/src/components/ToolbarDock/index.ts
packages/ui/src/components/ToolbarDock/lab/ToolbarDock.stories.module.css
packages/ui/src/components/ToolbarDock/lab/ToolbarDock.stories.tsx
packages/ui/src/components/ToolbarDock/layout.ts
packages/ui/src/components/ToolbarDock/useDockDrag.ts

<!-- done: 7 findings, files read: 12 -->
