---
"@weasel-js/core": patch
---

Canceling an in-place edit of text something derives from, such as the hidden text of a Text Along Path, now leaves no undo entry and keeps the redo stack. Its keystrokes still reach the curved copy as you type, but they are shown through a data override rather than written into the node, so the document holds none of them; a commit records one entry from the text before the edit to the text after it. A write made to the node during the edit, such as a fill change, shows through the draft and is kept, and undoing it after a cancel brings back no draft text.
