---
'@weasel-js/text-dom': patch
---

Fixes: editing text that ends in a line break dropped that break. `useTextEdit` removes one trailing newline when it reads the overlay back, since a browser adds one to hold the caret on an empty last line, and it removed the node's own the same way: `"abc\n"` became `"xabc"` when an `x` was typed at its start, and a styling change alone did the same. Chromium adds no second newline to text that already ends in one, so a break the text opened with now stays until an edit removes it.
