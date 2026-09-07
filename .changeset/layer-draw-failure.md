---
'@weasel-js/core': patch
---

A layer whose `draw` throws now paints nothing and names itself in the console,
instead of taking the frame down with it.

The paint runs on the frame loop, so a throw out of `draw` surfaced as an
uncaught `requestAnimationFrame` error on the window: the canvas went blank and
stayed stale until something unrelated asked for a redraw. `drawOneLayer` — the
one path both the canvas and a viewport's inner pass go through — catches it,
drops that layer for the frame, and paints the rest.

`drawLayers` and `drawOneLayer` take an `onLayerError` callback for a consumer
that wants to route the failure somewhere of its own; the default reports the
layer id and the error to `console.error`. The layer's cached commands are
dropped with it, so the next frame is a real re-attempt rather than a stale tree
served under fresh deps.
