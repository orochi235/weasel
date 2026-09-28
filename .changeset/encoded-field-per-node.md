---
'@weasel-js/ui': patch
---

`SelectionPanel` reads and writes an encoded field of an object leaf against each node's own object. Two strokes at different widths that are both dashed now show Dashed, and choosing Dotted writes each one an array scaled by its own width, where before the panel showed no style and wrote one array computed for no width into both.

`PropertyRenderContext` gains `each` (the value each selected node holds at the path) and, for a field of an object leaf, `eachSiblings` (each node's own object); `update`'s callback now also receives that node's object. A consumer that builds a `PropertyRenderContext` by hand must now supply `each`.
