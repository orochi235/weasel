---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

Fixes: the canvas-2D text paths read a tab as one space, where `layoutRuns` runs it to the next stop. `measureText` and `layoutMarkdown` now measure and wrap a tab to its stop, `tabSize` spaces apart (default 8), so both end a line where the GL tier does. This changes behavior, on an agent's judgment: the alternative was to keep the canvas's own reading of a tab.

- `layoutMarkdown` returns a tab as a `PositionedRun` of its own, as wide as its advance, so `createMarkdownRenderer` paints what follows at the stop and a rule runs across it. It takes `tabSize` as a seventh argument, and `MarkdownFontOptions` gains `tabSize`.
- Adds API: `MeasuredText.spans`, each line's text split at its tabs with the x every piece starts at (type `MeasuredSpan`). `fillText` still draws a tab as a space, so a painter that fills `lines[i]` whole misplaces what follows a tab; fill each span at its `x` instead.
