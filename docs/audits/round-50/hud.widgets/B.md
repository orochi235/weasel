# Findings: hud.widgets (round 50)

## A HUD button presses on Space keydown and again on every auto-repeat, where a native button presses once on Space's release
- where: packages/hud/src/widgets/button.ts:153 (createButton → onKey)
- scenario: focus a HUD button and hold Space (or Enter) for a second. `onKey` emits `press` for every `keydown`, `evt.repeat` included (`HudKeyEvent.repeat` is carried by domFocus), so the button fires ~30 presses; Space also fires on keydown rather than keyup, and the Space `keyup` is not claimed, so it falls through to the canvas's dispatcher without its keydown. `isPressKey`'s doc says "as a native `<button>` takes them": a native button fires one click on Space keyup and none on a repeat of Space. Should ignore `repeat` (at least for Space) and press Space on keyup.
- evidence: read
- severity: medium

## A long window title wraps onto extra lines that spill out of the titlebar; it is not ellipsized as the code says
- where: packages/hud/src/widgets/window/windowFrame.ts:107-119 (drawWindowFrame)
- scenario: `createWindow({ title: 'Layer properties for the selected group', width: 160, … })`. The title command gets `maxWidth = w - 2·edge - closeSize - 4` (≈128px) "so a long title is ellipsized rather than running under the ✕", but `TextDrawCommand.maxWidth` is a word-wrap width ("Wrap width. Absent never wraps", packages/renderer/src/DrawCommand.ts:168); nothing in renderer or text ellipsizes. The title breaks into two or three 12px lines, centered on the 24px titlebar, so the first line rises above the window's top edge and the last runs into the content rect, where the content painter is drawn beneath. A single unbreakable word still runs under the ✕. Should be one line cut to the width (or clipped to the bar).
- evidence: read
- severity: medium

## setBounds called from a window's own onMove/onResize ends the drag after its first move
- where: packages/hud/src/widgets/window/window.ts:155 (setBounds) with windowDrag.ts:69 (place)
- scenario: a consumer snaps the window to a grid: `onMove: (b) => win.setBounds(snap(b))`. The drag's first move calls `place` → `onMove` → `setBounds` → `drag.end()`, which nulls `dragZone`; every later `move` of the same gesture hits `if (!dragZone) break`, so the window moves once and then ignores the pointer until the next press. The same happens for a resize handler that constrains aspect ratio through `setBounds`. `drag.end()` is meant for an external move of the window, but nothing tells one from a call made inside the drag's own report; the drag should rebase (`dragStart`/`dragOrigin`) rather than end, or skip ending while inside `place`.
- evidence: read
- severity: medium

## HUD list and button labels are never held to their row/button width, so a long label draws past the widget, where the DOM twin ellipsizes or clips
- where: packages/hud/src/widgets/list/drawList.ts:60-61,83 (hudItemList.draw → text); packages/hud/src/widgets/button.ts:100-105 (hudButton.draw)
- scenario: `hud.list({ width: 120, rows: [{ id: 'a', label: 'A very long layer name indeed' }] })`. `measureRowList` holds the list to `fixedWidth(120)` and gives the label a rect `box.label.width` wide, but `text()` passes `maxWidth` undefined and no clip, so the label runs past the list's right edge over whatever is beside it; `ItemList.module.css` `.label` has `overflow: hidden; text-overflow: ellipsis`. The button does the same with its label part (`rect.width` unused) where `Button.module.css` clips with `overflow: hidden`. The stories put the two side by side, and the HUD one is the only one that overflows.
- evidence: read
- severity: low

## A list given an explicit height shorter than its rows draws every row past its bounds, and the rows below can be keyed to but not clicked
- where: packages/hud/src/widgets/list/list.ts:107-108,140-141 (rowAt, hitTest) with drawList.ts:58,68 (draw)
- scenario: `hud.list({ height: 80, rows: eightRows })`. `measureRowList` with `exactly(w, 80)` still lays all 8 rows at `i·(rowHeight+gap)`; draw emits every one with no clip, so rows 3–8 paint below the widget over the scene. `hitTest` is held to the 80px bounds, so a click on a drawn row 5 falls through to the canvas, while Down/End move the active row (and its ring) onto those rows. There is no scroll. Either clip the drawing to bounds and scroll the active row into view, or don't accept a height under the rows'.
- evidence: read
- severity: low

## A window is held on the host only when it moves, so shrinking the canvas can leave its titlebar off-screen and the window unreachable
- where: packages/hud/src/widgets/window/window.ts:107-114,163-165 (clampOnHost, draw)
- scenario: a window at x=900 on a 1200px-wide canvas; the user narrows the browser to 700px. `draw` only records `hostDims = ctx.dims`; nothing re-clamps `bounds`, so the whole window, titlebar and close box included, now sits past the right edge where no pointer can reach it to drag it back (the move clamp at windowDrag.ts:68 only runs during a drag that can no longer start). `setBounds` and title drags pull the window onto the host, so the decision "a window stays on its host" is answered on two paths and skipped on the third. The draw that sees new dims should pull the bounds back (and report `onMove`).
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

<!-- done: 6 findings, files read: 16 -->
