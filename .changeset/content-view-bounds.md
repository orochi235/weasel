---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

A scene canvas can bound its view to its content. `<SceneCanvas viewBounds="content">` keeps the view within what the scene draws plus a 200-pixel margin, and `viewBounds={{ content: { margin, include } }}` sets the margin, in screen pixels, and adds world rects that count as content though nothing draws them, such as a page. The content is every visible root's drawn bounds and whatever a gesture in flight proposes, read at each write to the view, so dragging content outward takes the bounds with it. A write never moves the view further from the content than it already is. A fixed world rect works as before. Exports `ContentViewBounds`, `SceneCameraProps`, and `DEFAULT_CONTENT_MARGIN`.

A drag held near the canvas's edge scrolls the view. It runs for a drag whose `OngoingHandle` sets the new `autoPan` flag, which move, resize, insert, clone, the anchor and segment drags, marquee, and lasso now do. Each frame the view scrolls, faster the closer the pointer is to the edge, and the dispatcher sends the held pointer's move again so the drag follows. `viewport={{ edgePan }}` turns it off with `false`, or takes an `EdgePanOptions` with `zone`, `speed`, and `limit`. `limit` holds the drag's pointer inside a world rect, or `{ past }` world units past the content as it stood when the drag began, so what the drag moves stops there and the scroll stops with it. `useGestureDispatcher` takes a `heldPointer` callback, handed a `HeldPointerFeed` that reports the held pointer and sends its last move again.

`viewport.zoom` has a Fit Content variant, `viewport.zoom:fit`, on Cmd-Alt-0, matched by the physical key so Option's character on a Mac doesn't stop it. It fits the view to the `view` dep's new `contentBounds()`, which `<SceneCanvas>` wires. Cmd-0 is unchanged.
