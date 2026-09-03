---
'@weasel-js/labkit': patch
'@weasel-js/core': patch
---

Draw on a lab's instrument: the `annotations` capability gets its overlay.

An instrument that declares `annotations` now gets a drawing surface on every
target it names — weasel tools, weasel selection, marks that pan and zoom with
what they mark — plus a palette (select, freehand, line, arrow, rectangle,
ellipse, text) and its own tool slot. `useAnnotations()` reaches the store from
the instrument's render or from a chrome contribution, and re-renders its
caller as marks change.

The lab's shared surface grew the buffer that makes this possible: one
`<canvas>` over `.lk-lab__body`, and `SurfaceHandle.registerPainter`, which is
how a resize of that buffer reaches every tile rather than the one that moved.
`getContainer()` names the element tile rects are measured against.

A mark is a weasel scene node in a scene of its own per target — a pane's
hit-test, marquee and paint walk the whole scene they are handed, so one shared
scene would put a neighbour's marks under the pointer. An annotation's id is
therefore `<target>/<node>`, and `createAnnotationStore` takes `targets` alone
plus an optional `restore`; `SerializedAnnotations` carries `scenes`, keyed by
target. Marks still do not survive a reload — the storage slot is the next arc.

Core adds `ArrowIcon` to the built-in tool glyphs.
