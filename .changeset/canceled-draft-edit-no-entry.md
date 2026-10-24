---
"@weasel-js/core": patch
---

Canceling an in-place edit of text something derives from, such as the hidden text of a Text Along Path, now leaves no undo entry and keeps the redo stack. Its keystrokes still reach the curved copy as you type, but they are no longer recorded; a commit records one entry from the text before the edit to the text after it.
