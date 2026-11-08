---
"@weasel-js/text": patch
"@weasel-js/text-dom": patch
---

Type fixes from an audit:

- The text edit overlay keeps a run's solid fill opacity. It wrote only the CSS color, so committing an edit dropped the opacity.
- The overlay splits a small-caps run under `textTransform: 'capitalize'` the way the canvas draws it: a run that continues a word started in the run before it has no capital at its start.
- A pasted weight reads as bold by `isBoldWeight`, the same line every other bold check draws.
- `createMarkdownRenderer` underlines, strikes and overlines a small-caps word as one rule at its run's size, as the GL tier does. It drew one rule per piece, the small pieces' thinner and higher. `PositionedRun` gains `lineSize`, the size of the run a piece was cut from.
