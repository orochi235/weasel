---
"@weasel-js/core": patch
"@weasel-js/font": patch
---

Scenes with many shapes or much text draw far less work per frame. Two caches
the kit already had were missing on essentially every node of every frame,
because the values they key on were rebuilt each time.

The tessellation cache (`WeakMap<Path, Mesh>`) keys on `Path` identity, but
`kit:shape` allocated a fresh path for every ellipse, polygon and star on every
draw. Painters now memoize `paint` against the node, so the same path comes
back and the cache does its job: 1000 shape nodes went from 6.69 to 0.20
ms/frame through paint and tessellation.

Text layout is the larger one. `layoutRuns` — which walks every codepoint,
resolves a face per run, measures, wraps and places each glyph — ran per text
command per frame. It is now cached in the renderer, keyed on the resolved
runs. 200 wrapped paragraphs went from 31.8 to 0.06 ms/frame, 1000 short
labels from 12.5 to 0.42. The cache drops itself when a font becomes
available, so text still reflows the moment the real face lands.

Two contracts follow from this, for anyone writing a custom painter or calling
these directly:

- The array a painter's `paint` returns belongs to the painter. Treat it as
  immutable and copy before appending — `defaultDrawOne` now does, for its
  label overlay.
- `registerFont` now notifies `subscribeGlyphReady` when a family finishes
  registering, so a font loaded mid-session repaints without waiting for an
  unrelated redraw. `glyphGeneration()` is a new pull-based companion to that
  signal, for caches that can't hold a subscription.
