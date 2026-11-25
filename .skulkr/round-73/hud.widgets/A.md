## A window drawn once on a zero-area host is pinned to (0, 0) by every later setBounds and title drag
- where: packages/hud/src/widgets/window/windowDrag.ts:118 (createHostHold.resize), :113 (clamp)
- scenario: the HUD layer draws before layout (or while the canvas is collapsed / `display: none`) with `dims` 0×0. `resize` stores `dims = {0,0}` even though it returns false. A consumer then calls `win.setBounds({ x: 300, y: 200, … })`, or the user drags the titlebar: `clamp` runs `clampRectWithin(b, {0,0,0,0})`, whose `clampAxis` gives `max(0, min(start, -size))` = 0, so the window lands at (0, 0). When the host later gets a real size, `resize` holds it again, but it is already at the origin, so the requested position is gone. The doc says "a host with no area yet (before layout) places nothing". It should ignore a zero-area size: keep the previous `dims`, or leave `clamp` a no-op until a size with area arrives.
- evidence: read (clampAxis in packages/geom/src/place.ts:60)
- severity: medium

## A rect window's border ring is stroked on its bounds' edge and pokes half its width outside, while a round window's is inset
- where: packages/hud/src/widgets/window/windowFrame.ts:127 (drawWindowFrame)
- scenario: a stance or grade sets `border-width` to 3px. The round path insets the ring by `ringW / 2` (`insetBox(bounds, ringW / 2)`), so the stroke sits inside the circle. The rect path strokes `{ x, y, width: w, height: h }` directly, so 1.5px of the border is painted outside the window's bounds. That area is outside its hit area and its layer-hit rect, and it is unlike the DOM panel's border, which sits inside the box. One decision is answered two ways: the rect ring should be inset by `ringW / 2` too.
- evidence: read
- severity: low

## A list made without `height` silently drops the height a later setBounds gives it
- where: packages/hud/src/widgets/list/list.ts:162 (setBounds → fit)
- scenario: `createList({ …, rows })` with no `height`, then `list.setBounds({ x, y, width: 200, height: 120 })` to make it scroll in a smaller pane. `fit()` sees `opts.height === undefined` and overwrites the height with the rows' measured height, so the list never clips or scrolls and overflows the pane. The caller's height is dropped with no error. Whether a list fits its rows is fixed at creation from `opts.height`, and `setBounds` gives no way to change it.
- evidence: read
- severity: low

## A list's hover highlight stays on the old row after a wheel scroll
- where: packages/hud/src/widgets/list/list.ts:178 (onPointer, wheel branch); listNav.ts:76 (hovermove)
- scenario: the pointer rests over row 3 (`hover = 3`), then the wheel scrolls the list by a row. `holdScroll` moves `scrollTop` and redraws, but `hover` is only recomputed on `hovermove`, so row 3 keeps its `--wzl-surface` fill after it has moved away from the pointer, and the row now under the pointer is not highlighted. A DOM `ItemList`'s `:hover` follows the content under a still pointer. The wheel branch should recompute hover from `rowAt(evt.x, evt.y)` after scrolling.
- evidence: read
- severity: low

## A focused list whose rows went empty and came back has no active row, so the first arrow key skips the home row
- where: packages/hud/src/widgets/list/listNav.ts:111 (rebase), :88 (key)
- scenario: the list holds focus with `active = 0`. `setRows([])` makes `rebase` set `active = null`. Then `setRows([a, b, c])`: `rebase` keeps `active` null, because only `focus(true)` falls back to `home()`. No row is ringed. The user presses Down: `key` takes `at = active ?? home()` = 0, and `rowKey` moves to 1, so row 0 is never landed on. Enter instead activates row 0 while no row shows as active. When the list is focused and `active` is null, `rebase` should land it on `home()` as `focus` does.
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
packages/hud/src/widgets/window/roundZones.ts
packages/hud/src/widgets/window/window.ts
packages/hud/src/widgets/window/windowDrag.ts
packages/hud/src/widgets/window/windowFrame.ts
packages/hud/src/widgets/window/windowLayout.ts
packages/hud/src/widgets/window/windowLook.ts
packages/hud/src/widgets/window/zones.ts

<!-- done: 5 findings, files read: 18 -->
