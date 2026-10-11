---
'@weasel-js/core': patch
---

Corrected the docs for `<DrawCanvas>` and `<MinimapCanvas>`, which said `className` sizes the canvas: the renderer writes `width` and `height` as inline style, so a class positions the element and cannot resize it. `CursorCoordsHud`'s doc now says it pins to the top-right of the canvas's host, not the top-left of the viewport. `PickHud` converts the pointer to world coordinates through the same `clientToWorld` helper as `CursorCoordsHud`, with no change in what it shows.
