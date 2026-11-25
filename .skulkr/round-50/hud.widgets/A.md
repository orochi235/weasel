I couldn't write `.skulk/out/findings.md` because the write permission wasn't granted, so the full findings document is below.

## A HUD list keeps its keyboard row, pressed row, and hovered row as indexes, so `setRows` that inserts or reorders moves them onto other rows
- where: packages/hud/src/widgets/list/listNav.ts:28-31 (createListNav: `active`, `hover`, `pressRow`; `clamp` at 101-105), packages/hud/src/widgets/list/list.ts:81 (activate reads `rows[i]!.id`)
- scenario: take a layers list with rows [Background, Sketch, Ink] and the keyboard on Ink (`active` 2). The app inserts a layer at the top with `setRows([New, Background, Sketch, Ink])`. `clamp` only pulls indexes that are past the end back into range, so `active` stays 2. The ring now sits on Sketch, and Enter activates Sketch. A press has the same problem: press Ink, the rows reorder before release, and `up` calls `onActivate` for whichever row now holds index 2, because `rowAt(...) === pressRow` is true against the new layout. In DOM `ItemList`, the twin this list copies, DOM focus stays on the focused row's element, so the keyboard row follows the item. Expected: the active, hovered and pressed rows follow their row ids across `setRows`, and fall to a neighbor only when their row is gone.
- evidence: read
- severity: medium

## A HUD list draws each label with no width limit, so a long label runs past its row instead of ellipsizing
- where: packages/hud/src/widgets/list/drawList.ts:60-61, 83 (hudItemList.draw, `text` helper)
- scenario: `createList({ width: 120, rows: [{ id: 'a', label: 'A very long layer name indeed' }] })`. `measureRowList` gives the label a box `box.label.width` wide. But `text()` calls `textCommandFromRuns(x, y, runs, font, undefined, h, 'center')` with no `maxWidth`, so the label draws at full width across the row's right padding, past the list's bounds and over whatever sits beside it. ui's `ItemList.module.css` sets `overflow: hidden; white-space: nowrap` on `.row` and `text-overflow: ellipsis` on `.label`. The HUD window's title already passes a `maxWidth` for this case. Expected: pass `box.label.width` as `maxWidth`.
- evidence: read
- severity: low

## A HUD button draws its label with no width limit, so a label wider than the button spills outside it
- where: packages/hud/src/widgets/button.ts:100-105 (hudButton.draw)
- scenario: `createButton({ width: 60, height: 28, label: 'Export settings' })`. `measureButton` trims the label part to the width the box leaves (ui-logic button.ts:114). But `draw` passes `undefined` as `maxWidth`, so the full label draws past the button's right edge. ui's DOM `Button` clips it with `overflow: hidden` in Button.module.css. Expected: pass the label part's `rect.width` as `maxWidth`.
- evidence: read
- severity: low

## A HUD list with a `height` shorter than its rows draws the rows past its bounds, where no press can reach them
- where: packages/hud/src/widgets/list/drawList.ts:58-93 (hudItemList.draw), packages/hud/src/widgets/list/list.ts:140-142 (hitTest)
- scenario: `createList({ height: 60, rows: eightRows })`. `measureRowList` places every row at `i * (rowHeight + gap)` whatever the height, and `draw` emits every row with no clip. Rows 3 to 8 therefore draw below the 60 px box. `hitTest` stops at the bounds, so a press on one of those drawn rows falls through to the canvas, while the keyboard can still move the ring onto them. Expected: rows past `height` are clipped or scrolled, so every row that is drawn can be pressed.
- evidence: read
- severity: low

## A HUD button presses on Space keydown and again on every auto-repeat, where a native button presses once when Space is released
- where: packages/hud/src/widgets/button.ts:153-157 (onKey)
- scenario: focus a HUD button and hold Space for a second. `onKey` emits `press` on every `keydown` and ignores `evt.repeat`, so a "Delete layer" button fires roughly 30 times. `isPressKey`'s doc says it takes Enter and Space "as a native `<button>` takes them", and a native button activates once, on Space's `keyup`. Expected: Space presses once on keyup and not on repeats; Enter presses on keydown.
- evidence: read
- severity: low

## Files read
packages/hud/src/widgets/ButtonWidget.stories.tsx
packages/hud/src/widgets/button.ts
packages/hud/src/widgets/image.ts
packages/hud/src/widgets/label.ts
packages/hud/src/widgets/list/ListWidget.stories.tsx
packages/hud/src/widgets/list/drawList.ts
packages/hud/src/widgets/list/list.ts
packages/hud/src/widgets/list/listNav.ts
packages/hud/src/widgets/rect.ts
packages/hud/src/widgets/text.ts
packages/hud/src/widgets/widgets.stories.module.css
packages/hud/src/widgets/window/window.ts
packages/hud/src/widgets/window/windowDrag.ts
packages/hud/src/widgets/window/windowFrame.ts
packages/hud/src/widgets/window/windowLook.ts
packages/hud/src/widgets/window/zones.ts

<!-- done: 5 findings, files read: 16 -->