---
'@weasel-js/core': patch
---

The pen tool continues an existing open path. With nothing drawn, pressing an
open path's first or last anchor picks that path up; the clicks that follow
extend it from that end (a first-anchor pick-up prepends and keeps the path's
direction), and finishing — Enter, ⌘-click, double-click, or clicking the far
end to close it — writes the result back to the same node as one undoable
edit rather than making a new node. Dragging from the endpoint pulls that
anchor's own handle. The pick-up radius is `closeHitRadius`, in screen pixels.

This is additive. The pen now reads existing paths through the `areaSelect`
and `editAnchors` deps, which `<SceneCanvas>` already publishes; a host
without them gets the old behavior. `PenScratch` gains a `continuing` field.
