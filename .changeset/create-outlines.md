---
"@weasel-js/core": patch
"@weasel-js/font": patch
"@weasel-js/geom": patch
---

Text can become path geometry. `textToPath(data, pose)` returns a text node's
glyph outlines and decoration rules in world space, as one `'nonzero'`
compound path whose filled region is their union. Glyphs keep the font's
curves, and each glyph is re-wound so faces that disagree on winding still
fill their overlaps. It works at any size, not only above the outline-tier
threshold, and applies synthetic italic the way the renderer does. When some
run has no outline geometry it throws a `TextOutlinesError` whose `reason` is
`'no-outlines'`, `'outlines-loading'`, `'outlines-failed'` or
`'synthetic-bold'`. Faux bold is refused rather than drawn at the regular
weight, because a path has no distance field to thicken.
`loadTextOutlines(data)` waits for the faces a text is set in.

The new `createOutlines` action (Shift+Mod+O, group `'text'`, under the
`paths` feature) replaces each selected text node with a path node in one
undoable batch. Each path takes its text node's slot in the stacking order.
Consumers publish a `CreateOutlinesAdapter` with `useCreateOutlinesAdapter`;
its `createPathNode(path, sourceId)` carries the text's fill and stroke. The
pure core is `applyCreateOutlines`, and the icon is `CreateOutlinesIcon`.

Boolean ops take text operands: `BooleansAdapter` gains an optional
`getTextSource(id)`, consulted when `getWorldPath` has no path. This change is
additive, with one exception: `BooleanOpResult` has a new
`{ kind: 'failed', reason: 'text-outlines' }` variant, and a text operand
without outlines now leaves the scene untouched. Code that switches
exhaustively over `BooleanOpResult` needs a case for it.

Also new: `loadFontOutlines(family, variant?)` in `@weasel-js/font` (also
re-exported from core) resolves once a registered face has loaded or failed.
`@weasel-js/geom` adds `pathSignedArea` and `reversePath`.
