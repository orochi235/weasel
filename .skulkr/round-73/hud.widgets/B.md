# Audit round 73 — hud.widgets (blind reviewer)

## A host drawn once at 0×0 makes every later clamp pin the window to (0, 0)
- where: packages/hud/src/widgets/window/windowDrag.ts:116 (createHostHold.resize / clamp)
- scenario: the HUD layer draws before layout with `ctx.dims = {0, 0}`. `resize` returns false, as the doc's "places nothing" promises, but it has already stored `dims = {0, 0}`. From then until a draw at a real size, `clamp` runs `clampRectWithin(b, {0,0,0,0})`. That works out to `max(0, min(x, 0 - width)) = 0` per axis. So a `setBounds({x: 300, y: 200, …})`, or a title drag, in that window snaps the window to (0, 0). The draw at a real size then holds it at (0, 0), because the position is already gone. It should leave `b` unclamped while the host has no area, exactly as it does before any draw (store `dims` only when it has area, or have `clamp` skip zero-area dims).
- evidence: read (geom `clampAxis` at packages/geom/src/place.ts:60)
- severity: medium

## The list's focus ring ignores the HUD's focus-visible state, so tabbing into it shows no focus at all
- where: packages/hud/src/widgets/list/listNav.ts:47 (ring getter), packages/hud/src/widgets/list/list.ts:162 (`focusRing: false`)
- scenario: the list sets `focusRing: false`, so the HUD never draws its own ring (layerDraw.ts:44 checks `hud.focusVisible`). The list draws its own ring only when `focused && keyed`, and `keyed` turns true only after the list handles a key. Tab into a list: `hud.focusVisible` is true, and `focus(true)` puts the active row on the selected row. But `keyed` is false (at first, or after any earlier pointer press), so nothing marks the focused list until an arrow key is pressed. The HUD and the list answer "is focus visible" two different ways. The DOM `ItemList` shows `:focus-visible` on Tab-in.
- evidence: read
- severity: medium

## `setBounds` on a list with no `height` option silently drops the caller's height
- where: packages/hud/src/widgets/list/list.ts:168 (setBounds → fit)
- scenario: a list created without `height`, then `list.setBounds({x, y, width: 200, height: 120})` to make it scroll inside a smaller pane. `fit()` checks `opts.height === undefined` and overwrites `bounds.height` with the rows' measured height. The list never clips or scrolls, and the 120 is dropped without notice. A height passed to `setBounds` should count as an explicit height, the same as `opts.height` (or the interface should say that `setBounds` ignores height).
- evidence: read
- severity: medium

## Wheel-scrolling a list leaves the hover highlight on a row the pointer has left
- where: packages/hud/src/widgets/list/list.ts:176 (onPointer 'wheel'), listNav.ts:69 (hover)
- scenario: the pointer rests over row 3 of an overflowing list, and the wheel scrolls it 40 px. `scrollTop` changes, but `nav.hover` keeps index 3, which has moved up under the clip. The hover fill is drawn on row 3 at its new place, not on the row now under the pointer. It stays wrong until the next `hovermove`. The DOM `ItemList` re-hovers on scroll. The wheel branch should recompute hover from the event point via `rowAt`.
- evidence: read
- severity: low

## A rect window's border stroke straddles its bounds; a round window's is inset
- where: packages/hud/src/widgets/window/windowFrame.ts:120 (drawWindowFrame ring path)
- scenario: with `--wzl-border-width` of 2px, a rect window strokes `{x, y, width: w, height: h}` centered on the bounds edge, so 1px is drawn outside the widget's bounds and hit area. A window held at x=0 by the host clamp loses half its left and top border off the canvas. The round branch insets by `ringW / 2` so the stroke stays inside, as a DOM border does. One decision answered two ways. The rect ring should use `insetBox(bounds, ringW / 2)` too.
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
