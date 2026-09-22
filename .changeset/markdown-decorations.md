---
'@weasel-js/text': patch
---

`createMarkdownRenderer` paints underline, strikethrough and overline, placed and weighted by the same metrics as the GL text tier, one rule across contiguous runs that share decoration, size, baseline and fill. It also takes `StyledRun[]` as well as markdown, since markdown has no spelling for those three, and lays a block out from its left edge under the context's `textAlign`, so a multi-run line no longer overlaps itself under `center` or `right`. `PositionedRun` gains `width`.
