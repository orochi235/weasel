## In a right-to-left row holding one other drawn bar, a drop lands on the wrong side of it
- where: packages/ui/src/components/ToolbarDock/dockDrop.ts:119 (dropAt)
- scenario: `dropAt` asks `gapByMidpoint(box.bars.map((b) => b.at), along)` for the slot, and `gapByMidpoint`
  (`packages/ui-input/src/reorder.ts:50`) only notices a backward line when it has two or more midpoints. In an RTL
  page, drag bar B from another row into a row whose only bar is A (center at clientX 500), and release at clientX 300,
  which in RTL is after A in reading order. `mids = [500]`, `backward` is false, `500 <= 300` is false, so the gap is 0 and B
  drops before A (to its right), the opposite of where the pointer is; releasing at 700 (before A) drops it after A. The
  same happens when the only other bar is the dragged one's sole neighbour while dragging from elsewhere. `measureDocks`
  already reads the row's direction (`rtl`) but never hands it to the slot choice; nothing in the area's tests covers RTL.
- evidence: read
- severity: medium

## Left and right docks are drawn on the logical side in RTL, but measured, marked and stripped physically
- where: packages/ui/src/components/ToolbarDock/ToolbarDock.module.css:5-9,103-111,124-127; packages/ui/src/components/ToolbarDock/dockDrop.ts:95,113-116,136 (measureDocks, dropAt)
- scenario: `.root`'s grid areas `'left main right'` and `.left > .dock { flex-direction: row }` follow the inline
  direction, so in an RTL document the dock with `edge: 'left'` is drawn on the physical right and its columns run
  right to left. But: (1) the empty-dock strip `.empty[data-dock-edge='left']` uses physical `inset: 0 auto 0 0`, so a
  drag shows the drop strip for an empty "left" dock on the physical left while the dock it creates appears on the
  right; (2) `measureDocks` gives a vertical dock's columns `start: r.left, end: r.right` in DOM order, so with two
  columns `rows[0].start` is greater than `rows.at(-1).end`, and `dropAt`'s guard
  `cross < rows[0].start || cross >= rows.at(-1).end` is true for every point: no drop into an existing column of a
  multi-column side dock is ever found in RTL, and the new-row choice `cross < first.start ? 0 : rows.length` puts the
  new column on the wrong side. The horizontal case does handle RTL (`from`/`to` swapped), so the two orientations
  answer direction differently.
- evidence: read
- severity: medium

## A move the host has not yet taken is dropped at the next drag's start, after that drag measured it
- where: packages/ui/src/components/ToolbarDock/useDockDrag.ts:117-121 (onPointerDown → onStart), 131
- scenario: after a keyboard or drag move, `held` keeps drawing `held.next` until `given` changes. A host that takes
  the move late, or not at all (the doc says it keeps seeing it), starts another drag: `onStart` calls
  `grabBar(..., latest.current.layout)`, measuring rows, `drawn`, `empties` and the bar's own row from the DOM of the
  held layout, and then `setHeld(null)`, which redraws the dock in `given`'s arrangement. Every later `onMove` computes
  `movedLayout(was, …)` with `was = latest.current.layout`, now `given`, against row and slot indices measured in the
  held arrangement. E.g. Alt+Down moves bar X to row 1, the host ignores it, the user then drags bar Y: the rows jump
  back under the pointer, and the drop marks and the committed target refer to the old geometry, so Y lands in a row
  or slot other than the one marked (or X's row index no longer exists). Measured layout and applied layout should be
  the same one: either clear `held` before measuring (after a redraw) or keep `held.next` as the drag's base.
- evidence: read
- severity: low

## resolveLayout throws on a stored layout with a malformed entry, though it is the reconciler for stored prefs
- where: packages/ui/src/components/ToolbarDock/layout.ts:117-118,129-136,152 (resolveLayout)
- scenario: the layout is documented as a hint ("a stale or partial layout is fine"), and WeaselDraw stores it as an
  unvalidated `data` pref (`apps/draw/src/prefs.ts:86-91`). `resolveLayout` coerces a non-finite `x`/`y` and a bad
  anchor, but a stored `{ floating: { view: null } }` throws at `at.x` (TypeError reading a property of null), a row
  that is not an array (`docks: { top: ["text"] }` hand-edited to `docks: { top: "text" }`, or `[["a"], 3]`) throws at
  `row.filter` / iterating a string's characters, and `atEnd: "text"` throws at `.filter`. The throw happens inside
  `ToolbarDock`'s render `useMemo`, so the whole dock (and the app around it) fails to mount instead of falling back to
  default placement. Each malformed piece should be skipped as unknown ids already are.
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

<!-- done: 4 findings, files read: 12 -->
