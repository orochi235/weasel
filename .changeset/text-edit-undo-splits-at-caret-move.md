---
'@weasel-js/text-dom': patch
---

In the text editor, typing after moving the caret away and back is its own undo step, so Undo takes back only what was typed since the move.

<!-- entry: fix -->
