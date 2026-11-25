# Audit round 84 — ui.components.ToolbarDock

## A drag that starts while a move is held measures the held layout, then drops into the host's layout
- where: packages/ui/src/components/ToolbarDock/useDockDrag.ts:110 (onPointerDown → onStart)
- scenario: a host ignores a move (or has not yet sent the new `layout`), so the dock draws `held.next`. The next drag's `onStart` measures the DOM drawn from `held.next` (`grabBar(..., latest.current.layout)`: boxes, row indices, `drawn`, whether there are empty docks), then calls `setHeld(null)`, which redraws the dock from `given`. Every later `onMove` resolves the stale boxes' row/slot indices against `latest.current.layout`, now `given`: marks and drops land in a different row or slot from the one under the pointer, the bars jump under the press, and `grab.empties` is `[]` (never measured) when `held.next` had no empty dock but `given` does, so the strips drawn for those docks can never be dropped on. Should measure after clearing the hold, or keep drawing the held layout for the drag.
- evidence: read
- severity: medium

## Keyboard moves ignore right-to-left direction
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:166 (keysFor), used by keyTarget
- scenario: in an RTL row (which `measureDocks`, `gapByMidpoint` and the CSS drop marks all mirror), Alt+ArrowLeft maps to `alongBack` and moves the bar to a lower index, which is drawn to its right; Alt+ArrowRight moves it left. In a left or right dock under RTL the columns are laid right-to-left too (`.left > .dock` is `flex-direction: row`), so Alt+ArrowLeft/Right across columns are also mirrored. Arrows should follow the drawn direction.
- evidence: read
- severity: medium

## Pointer drops in a left/right dock with several columns fail under RTL
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:125 (dropAt)
- scenario: `measureDocks` records a vertical dock's columns with `start = r.left`, in DOM order. Under RTL `.left > .dock` (flex row) draws column 0 rightmost, so `rows[0].start > rows.at(-1).end`; the guard `cross < rows[0].start || cross >= rows.at(-1).end` rejects every point, so no column of a 2+-column vertical dock accepts a drop, the row loop's `rows[row+1].start <= cross` assumes ascending order, and the new-row zone `cross < first.start ? 0 : rows.length` puts the new column on the wrong side. Horizontal rows handle RTL (`rtl` in measureDocks), vertical docks do not.
- evidence: read (layout direction inferred from the CSS)
- severity: medium

## Empty-dock drop strips use physical insets while the grid mirrors under RTL
- where: packages/ui/src/components/ToolbarDock/ToolbarDock.module.css:104 (.empty[data-dock-edge='left'/'right'])
- scenario: `.root`'s grid areas `'left main right'` flip in an RTL container, so the `left` dock is drawn on the physical right. The strip for an empty `left` dock is placed with `inset: 0 auto 0 0` (physical left). In RTL the user drops on the left-side strip and the bar appears on the right; the strip for `right` likewise sits opposite where its dock draws.
- evidence: read
- severity: low

## A drop beside the only bar of an RTL row lands on the wrong side
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:131 (dropAt → gapByMidpoint)
- scenario: `gapByMidpoint` detects a backward (RTL) line only from `mids.length > 1`. Dragging a bar into another RTL row holding one bar, with the pointer to that bar's right (its start side in RTL), gives gap 1, so the bar goes after it (drawn to its left), opposite to where the pointer is. The row's own RTL reading is known (`box.from > box.to`) but not used.
- evidence: read
- severity: low

## A dock whose bars all draw nothing cannot be dragged into
- where: packages/ui/src/components/ToolbarDock/ToolbarDock.tsx:82 (filled), dockTear.ts:73 (grabBar empties)
- scenario: a host hides every bar of dock X (`render` returns null), which the docs say keeps their place. X still has rows, so it is "filled": drawn with zero-size rows (all slots `display: none`), measured with zero extent by `measureDocks`, and not offered as an empty strip (`empties` requires no rows). A pointer drag can never drop into X, though Alt+arrows (keyTarget over drawnLayout's kept empty rows) do move a bar into it. One decision answered two ways; the dock should count as empty for drag purposes when nothing in it is drawn.
- evidence: read
- severity: medium

## Reported least lengths are never cleared, so a stale `--dock-least` outlives its reporter
- where: packages/ui/src/components/ToolbarDock/dockContext.ts:24 (useReportDockLeast); ToolbarDock.tsx:78 (leasts)
- scenario: the layout effect reports `least` but has no cleanup reporting `undefined`. When the component calling `useReportDockLeast` unmounts (the bar's `render` switches to content without it, e.g. a different orientation or state) the old px stays in `leasts`, and the slot keeps a `min-inline-size` the bar no longer needs, so a squeezed row cannot shrink it. Entries for bars removed from `bars` are never dropped either.
- evidence: read
- severity: low

## A layout object passed again after a held move is replaced by that move
- where: packages/ui/src/components/ToolbarDock/useDockDrag.ts:76 (held)
- scenario: `held` is never cleared on acceptance, only compared by identity with `given`. Host has layout A (resolved R_A, memoized), user moves → `held = {next, over: R_A}`; host accepts with B; later the host restores A (undo or "reset" in a store that returns its cached object) with unchanged `docks`/`bars`, so `useMemo` returns R_A again → `held.over === given` and the dock draws the old `held.next` instead of A. Should drop `held` once `given` changes away from `held.over`.
- evidence: read
- severity: low

## Dev-only nowhere warning is keyed without the docks offered, so it does not re-fire when they change
- where: packages/ui/src/components/ToolbarDock/ToolbarDock.tsx:42 (warnNowhere)
- scenario: the key is the bar id plus `bar.docks`, though the message reports the docks on offer, and whether the bar can go anywhere depends on them. A bar that has nowhere to go with docks {top} warns once; after `docks` changes to another set where it again has nowhere to go (as the lab's dock toggles do), nothing warns, and the first message's "docks on offer" list is stale. The module-level Set also grows for the life of the page.
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
