---
"@weasel-js/core": patch
---

`useSceneTextEdit` edits a node with no font size at the size the canvas draws it; its `defaultFontSize` option is deprecated and ignored.

The option sized only the editing overlay, never the canvas's glyphs or the double-click's caret, so any value but 16 set the text being typed off the text it stood in for. Remove it.

<!-- entry: deprecates fix -->
