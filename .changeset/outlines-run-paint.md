---
"@weasel-js/core": patch
---

Create Outlines keeps every run's paint. A text node whose runs wear different
fills or strokes now becomes one path per paint, each gathering the glyphs and
decoration rules that share it, instead of one path in the node's color.

Additive API: `textToPathsByPaint(data, pose)` returns `{ fill, stroke?, path }`
per distinct resolved paint, built on the same glyph walk as `textToPath`, and
their union is `textToPath`'s outline. `TextOutlineSource` takes optional
`fill` / `stroke` (the node's own), which only `textToPathsByPaint` reads.
`CreateOutlinesAdapter.createPathNode` receives a third argument,
`OutlinePathSpec` `{ fill, stroke?, parent }`: the paint the path must wear and
the parent it goes under. The new optional `createContainerNode(sourceId,
{ parent, bounds })` mints a container that takes the text's slot and holds its
paths; without it the paths are laid flat in that slot. Either way it is one
undo step, and the replacement is what ends up selected.

Behavior change for existing adapters: one that ignores the new argument still
works, but a multi-paint text now yields several flat paths painted however that
adapter paints them, and `resultIds` can hold more than one id per text node.
