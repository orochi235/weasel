# pointer

`@experimental`

One file: a store publishing the world-space position of the canvas pointer,
and the view it is over.

## Why it's a store, not state

Cursor moves fire dozens of times per second. Routing them through React state
would re-render every consumer in the tree on every mouse twitch. So the
context is an external store:

- `get()` — the latest `{ worldX, worldY, viewId }`, or `null`.
- `subscribe(fn)` / `getVersion()` — for a reader that follows it, such as a
  linked cursor. Subscribers hear only a changed value.
- `usePointerPosition()` — the same through `useSyncExternalStore`, for a
  component that renders from it.
- `getDropPoint()` — `get` as a stable thunk.

A consumer that only reads on demand pulls inside its callback and never
re-renders.

The position is `null` on `pointerleave` — the pointer isn't over the canvas,
so there is no world position. Handle the null; don't treat a stale
last-known point as current.

`viewId` is the id of the `<CanvasView>` the pointer is over, or `null` for
the surface's own camera; the coordinates are in that view's world.

## Sharing one pointer

`<SceneCanvas>` publishes automatically and mounts a provider only when none
is in scope. Put one `<PointerContextProvider>` around several surfaces and
they share a pointer: `<MinimapCanvas>` publishes into it under its own view
id, and the linked cursor on each side draws where the other's pointer is.
Surfaces also publish it as the `pointer` dep, which is how a contribution
reads it.

## Who uses it

`useClipboardOps` consumes it when the caller didn't pass an explicit
`getDropPoint` — that's how "paste lands under the cursor" works without
threading pointer state through the app. `features/minimap` draws its linked
crosshair from it.
