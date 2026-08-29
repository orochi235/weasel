---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

Text layout is computed once, and the caret reads the layout that was painted

The paint, the pose silhouette and the click-to-edit caret each ran their own
walk. The paint went through a memoized `layoutRuns`; the silhouette re-ran
`layoutRuns` on every pose change, because it allocates a fresh `ResolvedRun[]`
per call and the cache keyed on array identity; and the caret summed
`ctx.measureText` per character, which sees no kerning, reads system fonts
rather than the registered face, and ignores per-run styling entirely. The
caret could therefore answer with a different line, and a different glyph, than
the one under the pointer — masked in practice only because it asked a WebGL
canvas for a 2D context and got `null`, degrading silently to no caret at all.

`cachedLayoutRuns` now lives in `@weasel-js/text` beside the function it caches,
and all three go through it. It keeps the array-identity `WeakMap` as the
renderer's zero-cost path and falls through to a bounded LRU keyed on the runs'
structure, which is what lets a caller that cannot hold a stable array hit it —
about 230× cheaper than laying out again, at roughly 4× the cost of the
identity hit. `LaidOutLineBox` carries the caret stops the pen produced, so
snapping is to the advance cells the glyphs were actually painted in.

**Breaking:** `caretIndexAt(ctx, x, y, pose)` is now
`caretIndexAt(x, y, pose, opts?)` — the `CanvasRenderingContext2D` is gone, and
an optional `maxWidth` mirrors `textLineBoxes` for nodes the `kit:text` painter
draws unwrapped. `useSceneTextEdit` no longer acquires a 2D context, so a
double-click always seeds the caret instead of falling back to editing from
offset 0. `@weasel-js/text` gains a `./test-seams` entry point exporting
`_resetLayoutCacheForTests`.
