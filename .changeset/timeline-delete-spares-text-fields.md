---
'@weasel-js/ui': patch
---

`Timeline` no longer deletes the selected keyframe when Delete or Backspace is typed into a field inside it. Correcting a digit in an input drawn by `renderKeyEditor` removed the key and unmounted the editor under the cursor. The shortcut now skips a key press whose target is an input, textarea, select, or contenteditable element, and one a child already handled with `preventDefault`.
