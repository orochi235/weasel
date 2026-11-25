## `slots` reorders siblings after a drop from outside: `arrive` orders the already-shifted siblings against the slot set for one fewer child
- where: packages/guides/src/layout/strategies/sequence.ts:167 (sequenceLayout `arrive`), with packages/guides/src/layout/strategies/slots.ts:60 (`order`)
- scenario: `slots({ arrangement: rowSlots() })` over a 300-wide container holding `c@50`, `z@150`, `a@250` (centers; ids chosen so `a` sorts before `z`). Drag `x` in from another container onto index 0. `commitDrop` writes the four-slot arrangement x@37.5, c@112.5, z@187.5, a@262.5, and the preview showed that order. The layout pass then calls `arrive` (core `layoutPass.ts:200`, "a drag onto the container arrives here too, after `commitDrop` has placed it"). `arrive` runs `seq.order(container, held, held.length)`, so `slots.order` maps those four-slot positions onto the three-slot set (50, 150, 250): c@112.5 → slot 1 and z@187.5 → slot 1 tie, and the id tiebreak decides between them. Any pair of shifted siblings can tie this way, so the final arrangement depends on ids, not on the order the user dropped into: here `c` and `z` (or `z` and `a`) can trade places after the release. `arrive` should order the siblings with the count whose arrangement they currently sit in. For a drop that count is `children.length`, since `commitDrop` already shifted them. For an insert, which shifts nothing, it is `held.length`.
- evidence: read
- severity: medium

## `pack({ overflow: 'grow' })` stops following its content when a reorder, a child resize or a width change alters how many shelves there are
- where: packages/guides/src/layout/strategies/pack.ts:97 (`resize`), packages/guides/src/layout/strategies/sequence.ts:124 (`childPoses`)
- scenario: The grow container is 100 wide and holds children of widths 60, 40, 60, 40, each 50 tall: two shelves, and the container is 100 tall. Drag within the container to reorder them to 60, 60, 40, 40: the shelves become 60 | 60 40 | 40, three shelves, 150 tall. Only `arrive`/`depart` call `seq.resize`, and the layout pass calls those only when a child joins or leaves. A move inside the container, a child growing, or the container being narrowed all run `childPoses` (layoutPass.ts:206), which can only return poses. So the third shelf sits below the container's bottom edge while the container stays 100 tall. The same happens when a child is made taller, which shrinks nothing back either. The docs promise "the container's height follows its content", and it doesn't.
- evidence: read
- severity: medium

## `tileGrid({ overflow: 'grow' })` previews and commits the second member of a multi-select drop into a full grid at a halved pitch, on top of a sibling
- where: packages/guides/src/layout/strategies/tileGrid.ts:233 (`getDropTargets` → `heldBy`), packages/guides/src/layout/strategies/tileCells.ts:51 (`tileGridOf`)
- scenario: The grid is `cols: 2, rows: 1, overflow: 'grow'`, over a 100×50 container already holding a and b. Drag p and q in together from elsewhere. editing's `placeAll` (dropPass.ts:42–70) adds p to `working` before it asks about q. For p, n = 2: one line, so the full grid offers cell 2 at (0,50,50,50). For q, the children are a, b and p, and `heldBy` counts p, so n = 3. `tileGridOf` then spreads `linesFor(3) = 2` lines over the container, which hasn't grown and is still 50 tall, giving a 25-tall pitch. Under that grid a and b index as cells 2 and 3 and p as cell 6, so cells 0 and 1 look free. q's preview and its commit pose are (0,0,50,25), half the height and over `a`. `arrive` later moves q to a free cell at the old pitch, so it lands somewhere other than where it was shown. The grid's pitch for a drop should come from the lines the container currently has, not from the count with earlier placements of the same drop added.
- evidence: read
- severity: medium

## `pack({ overflow: 'grow' })` collapses the container to `minHeight` on a departure when some remaining child is wider than the container
- where: packages/guides/src/layout/strategies/pack.ts:99 (`resize`), packages/guides/src/layout/strategies/sequence.ts:180 (`depart`)
- scenario: A grow container is narrowed below one child's width. `childPoses` gets `null` from `place` and leaves every pose where it was. Now delete any other child. `depart` falls back to `new Map()` for the poses and still calls `arranged` → `resize`. There, `shelve(...)` returns `null`, so `height = Math.max(minHeight, 0)` and the container shrinks to `minHeight` (default 0) while its children stay where they were, now outside it. `resize` should leave the bounds alone (`undefined`) when the sequence cannot be shelved.
- evidence: read
- severity: low

## Files read
packages/guides/src/layout/perContainer.ts
packages/guides/src/layout/snaps.ts
packages/guides/src/layout/strategies/arrangements.ts
packages/guides/src/layout/strategies/freeform.ts
packages/guides/src/layout/strategies/index.ts
packages/guides/src/layout/strategies/pack.ts
packages/guides/src/layout/strategies/quadtree.ts
packages/guides/src/layout/strategies/sequence.ts
packages/guides/src/layout/strategies/slots.ts
packages/guides/src/layout/strategies/snapPoint.ts
packages/guides/src/layout/strategies/testing/moveLayoutStubs.ts
packages/guides/src/layout/strategies/tileCells.ts
packages/guides/src/layout/strategies/tileGrid.ts

<!-- done: 4 findings, files read: 13 -->
