---
'@weasel-js/core': patch
---

Resolve the dispatcher and its coordinate lookups per event inside
`useGestureDispatcher`.

The hook took `dispatcher`, `affordanceAt`, `classifyTarget` and `clientToWorld`
as four sibling options and read each through its own ref, and it bound the
dispatcher once when the listener effect ran. Those four are one thing —
everything about handling an event that depends on which view it landed in — so
they are now one internal record, read fresh on each event.

No public change: the four options stay exactly as they are and become that
record. They are the single-view façade, the same way `SceneCanvasProps` is.

This is groundwork for routing input to one of several views. Doing it this way
means the hook keeps mounting once: a canvas with N views gets N dispatchers
behind one listener set, rather than N copies of the hook all firing on every
event.
