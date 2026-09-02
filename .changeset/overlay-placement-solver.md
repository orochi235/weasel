---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

Add an anchored-placement solver and keep HUD windows on their host.

`@weasel-js/geom` gains `placeRect` and `clampRectWithin`. `placeRect` resolves an
overlay against an anchor: it picks a side, flips to the opposite one when the
preferred side has no room, and slides along the alignment axis to stay inside a
boundary. `clampRectWithin` is the containment half on its own — move a rect the
shortest distance that puts it inside a boundary, keeping its size. Both are pure
and take an explicit boundary rect, so a boundary that does not start at the
origin resolves correctly.

A HUD window could previously be dragged fully off its host with no way to
recover it: `createWindow` clamped size but never position. Move drags and
`setBounds` now keep the window on the host. Resize drags are deliberately left
alone, so pulling an edge past the host does not fight the gesture.

`@weasel-js/core` gains `hostAnchorStyle` and `useHostAnchor`, which pin a
fixed-position panel to the canvas host's top-right corner and keep it inside the
viewport. `CursorCoordsHud`, `PickHud` and `ModalityHud` were each carrying their
own copy of that anchor math and now share this one; none of the three clamped
before, so a panel could hang off the edge when the host was scrolled or the
panel was tall.
