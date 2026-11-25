# Audit round 84 — ui.components.ToolbarDock

## A dock whose rows hold only bars drawn as nothing can't be dropped into, and shows no empty strip either
- where: packages/ui/src/components/ToolbarDock/ToolbarDock.tsx:86 (`empties`), packages/ui/src/components/ToolbarDock/dockDrop.ts:127 (dropAt)
- scenario: dock `bottom` holds `[['hidden']]`, where `hidden`'s render draws nothing (the documented way to hide a bar but keep its place). `empties` counts the dock as not empty because `dockRows(shown, 'bottom').length` is 1, so no strip is drawn; `grabBar` likewise sets `empties: []` if no other dock qualifies. The dock's row element has zero cross extent (its slot is `display: none`), so dropAt's row hit (`cross >= start && cross < end`) never matches, and the new-row zone is `max(reach, 0/2)` = 0 for a bar without `float`. Dragging any bar to that edge drops nowhere; the dock is unreachable by pointer though it is visually empty and the bar may enter it. It should be treated as an empty dock (strip drawn, drop as new row).
- evidence: read
- severity: medium

## In a right-to-left dock, a single-bar row takes the drop on the wrong side
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:133 (dropAt → gapByMidpoint)
- scenario: `gapByMidpoint` (ui-input/reorder.ts:58) detects a backward (RTL) line only from `mids.length > 1 && last < first`. In an RTL top dock whose target row holds one bar `A` (dragging `X` in from another row), `box.bars` has one midpoint, so the line is read as forward: pointer to A's left (after A in reading order) gives gap 0 → drop before A, and to its right gives after A. The bar lands on the opposite side from the pointer and from the drop mark the CSS draws for `:dir(rtl)`. The direction is known from `getComputedStyle(row).direction` in measureDocks (`from`/`to` already flip) but is not passed to the gap.
- evidence: read
- severity: medium

## Left and right docks can't be dropped into in a right-to-left layout, and their empty strips are on the wrong side
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:111 (measureDocks, vertical branch) and :129-131 (dropAt); packages/ui/src/components/ToolbarDock/ToolbarDock.module.css:5 (`.root` grid), :103-111 (`.empty[data-dock-edge=left|right]`)
- scenario: in RTL, `.left > .dock` is `flex-direction: row`, so a vertical dock's columns run right to left, and rows[0].start is the largest x. dropAt requires `cross >= rows[0].start && cross < rows.at(-1).end`, which no point satisfies once there are two columns, and `while (rows[row+1].start <= cross)` assumes ascending x; the new-row zones are also mirrored (row 0 is put on the wrong side). Separately, the grid's `'left main right'` areas mirror in RTL, so the dock with `edge: 'left'` is drawn on the physical right, while the empty-dock strip for it uses physical `inset: 0 auto 0 0` and is drawn on the left: dropping on the strip puts the bar on the opposite side of the screen. Horizontal docks handle RTL (`from`/`to`, `:dir(rtl)` marks); vertical ones don't.
- evidence: read
- severity: medium

## Alt+Left/Right move a bar the opposite way on screen in a right-to-left top or bottom dock
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:184 (keysFor), :198 (keyTarget)
- scenario: in an RTL top dock, Alt+ArrowLeft is `alongBack` and moves the bar to a lower index, which is drawn to its right. The pointer path and the drop marks are mirrored for RTL; the keyboard path ignores direction, so the arrow moves the bar against its own direction.
- evidence: read
- severity: low

## Removing the dragged bar from `bars` mid-drag throws
- where: packages/ui/src/components/ToolbarDock/ToolbarDock.tsx:134-137 (portal map), floatingLayer.tsx:29 (floatPlaces)
- scenario: a floatable bar is torn off and floating (`view.float` set), and the host drops it from `bars` (a pref toggles it, a mode change) before release. `view` survives the re-render, `floatPlaces` pushes `view.barId`, so `orientations` puts it in `at`, and `byId.get(id)!` is undefined → `<DockedBar bar={undefined}>` reads `bar.id` and throws, unmounting the dock. Should skip ids not in `byId` (and end the drag).
- evidence: read
- severity: low

## A held move is dropped when the next pointer drag starts, but kept by keyboard moves, and the drag measures the held arrangement it then discards
- where: packages/ui/src/components/ToolbarDock/useDockDrag.ts:118-119 (onStart), :91 (layout), ToolbarDock.tsx:20-23 (onLayoutChange doc)
- scenario: a host ignores `onLayoutChange` (or applies it later). After a move, the dock draws `held.next`. The props doc says it "keeps drawing the move until its next `layout`". A pointer drag's onStart measures `grabBar` against the held DOM and `latest.current.layout` (= held.next), then calls `setHeld(null)`, so the bars jump back to the host's layout while the drag's boxes, `drawn` set and empties describe the held arrangement; `onMove` then applies drops computed from stale boxes to the reverted layout (`was` is now `given`), landing the bar at a slot other than the mark shown. A keyboard move in the same state builds on `held.next` instead. The two paths answer "which layout does the next move start from" differently, and neither matches the prop doc.
- evidence: read
- severity: low

## A reported least length outlives the bar content that reported it
- where: packages/ui/src/components/ToolbarDock/dockContext.ts:24 (useReportDockLeast)
- scenario: the layout effect reports `least` but has no cleanup reporting `undefined`. If a bar's `render` switches from content that calls the hook (an overflowing Bar) to content that doesn't, or the reporting child unmounts, `leasts[id]` keeps the old px and the slot keeps `--dock-least`, so a squeezed row still reserves that length for the bar. The cleanup should call `report?.(undefined)`.
- evidence: read
- severity: low

## A new-row zone of a dock the bar can't enter blocks one it can
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:144 (dropAt, second loop)
- scenario: the second loop returns null at the first dock whose new-row zone holds the point if the bar may not enter it, without trying later docks. At the corner below a top dock and right of a left dock, both zones cover the point; for a bar that may enter `left` but not `top`, measureDocks' DOM order puts `top` first and the drop is refused, though the point isn't over the top dock's rows. The doc says null only "over one the bar may not enter".
- evidence: read
- severity: low

## Announced row number counts rows whose bars are all hidden
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:229 (placeWords), :63 (drawnLayout)
- scenario: dock rows `[['h'], ['a','b']]` with `h` drawn as nothing; Alt+Right on `a` announces "row 2" though one row is visible. drawnLayout keeps emptied rows "so row indices hold", and placeWords reads `at.row + 1` from it, so the screen-reader position disagrees with what is drawn.
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

<!-- done: 9 findings, files read: 12 -->
