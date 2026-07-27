# pointer

`@experimental`

One file: an ambient context publishing the world-space position of the canvas
pointer.

## Why it's ref-based, not state-based

Cursor moves fire dozens of times per second. Routing them through React state
would re-render every consumer in the tree on every mouse twitch. So the
context exposes:

- `pointerRef` — a **stable ref** whose `.current` the publisher mutates
  directly. No re-render, ever.
- `getDropPoint()` — a thunk that reads it on demand.

Consumers pull inside their callbacks. No subscription, no re-render. If you
find yourself wanting to *render* from this value, you want state somewhere
else — don't convert this context, or every pointermove becomes a render pass.

`.current` is set to `null` on `pointerleave` — the pointer isn't over the
canvas, so there is no world position. Handle the null; don't treat a stale
last-known point as current.

## Who uses it

`<SceneCanvas>` publishes automatically. `useClipboardOps` consumes it when the
caller didn't pass an explicit `getDropPoint` — that's how "paste lands under
the cursor" works without threading pointer state through the app.

Other hit-on-cursor consumers (drop-zone hover, context-menu anchor) can reuse
the same context rather than attaching their own `pointermove` listener.
