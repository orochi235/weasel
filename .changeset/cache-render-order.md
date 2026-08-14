---
'@weasel-js/core': patch
---

Cache `renderOrder()` and `renderOrderNodes()` between structural edits.

Both walk the whole tree, and both run per frame and per hit-test query, on a
sequence that only changes when something structural moves. They now build once
and are served from a cache until it does. On a 10,000-node, four-layer scene a
repeat call drains in 0.0033 ms against a 0.33 ms rebuild (`npm run bench`,
`min`).

Invalidation hangs off the four writers that can reorder the scene — `attach`,
`detach`, `kit:setLayer`, `rebuildLayerIndex` — plus `loadState`. Pose and data
edits do **not** invalidate: they change no order and fire every frame during a
drag, which is exactly when the cache earns its keep.

Repeat calls now return the same array instance rather than a fresh one. It is
still a snapshot — a structural edit builds a new array, so a reference taken
earlier keeps the order it was taken with — but callers must not mutate what
they get back. Both return types have always been `readonly`.
