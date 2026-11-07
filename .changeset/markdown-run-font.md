---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

`layoutMarkdown` and `createMarkdownRenderer` set each run in its own `fontFamily`, `fontWeight` and italic, falling back to the node's the way `resolveRuns` does on the GL tier, and track it by its `letterSpacing` after every grapheme cluster, the last included. Before, every run was measured and painted untracked in the node's family and weight. The renderer paints tracking through the context's `letterSpacing` where it has one, and a cluster at a time where it does not. `MarkdownFontOptions` gains a node-level `letterSpacing`.

Breaking for a caller of `layoutMarkdown` or a writer of its callbacks:

- `MeasureFn` is now `(text, font: MarkdownFont) => number`, where `MarkdownFont` is `{ fontFamily, fontWeight, fontStyle, fontSize }`. It measures glyphs only, and the layout adds tracking itself. It used to be `(text, fontSize, bold, italic)`.
- `FaceMetricsFn` takes the run's `{ fontFamily, fontWeight, fontStyle }` in place of `(bold, italic)`.
- `layoutMarkdown`'s last three positional arguments (`lineHeightFactor`, `faceOf`, `tabSize`) are replaced by one `LayoutMarkdownOptions` object: `{ lineHeight, faceOf, tabSize, family, weight, letterSpacing }`.
- `PositionedRun.size` is gone. Read `PositionedRun.font.fontSize` instead, and `PositionedRun.tracking` for the run's letter spacing in px. `width` now includes the tracking.
- The `font` the renderer sets is `fontString`'s form, with a numeric weight (`normal 700 13px sans-serif`, not `bold 13px sans-serif`).
- `createMarkdownRenderer` and `TextRenderer` live in `markdownRenderer.ts`. The package's exports are unchanged; only a deep import of `markdownText` moves.
