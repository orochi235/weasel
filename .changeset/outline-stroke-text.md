---
'@weasel-js/core': patch
---

Outline Stroke works on stroked text. A selected text node that wears a stroke, its own or one of its runs', is replaced by its glyph outlines by paint, with each stroke as a path of its own over the glyphs it outlined, where it used to be passed over until Create Outlines had run. Text with no stroke stays text. The action is enabled on stroked text, and waits for a face's outlines to load as Create Outlines does.

New in the API: `applyOutlineStroke` can answer `{ kind: 'failed', reason: 'text-outlines', error }` when a stroked text's face has no outlines, changing nothing, so a `switch` over `OutlineStrokeResult` has one more case.
