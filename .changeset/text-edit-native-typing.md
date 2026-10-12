---
'@weasel-js/text-dom': patch
---

Changes: `useTextEdit` leaves a typed character to the browser. It used to cancel every `insertText` and insert the character itself, so no `input` event followed a keystroke, typing was not on the browser's undo stack (both measured in headless Chromium), and input naming a range of its own, such as the double-space period or a text replacement, would have landed at the caret instead. It now inserts by hand in two cases only: under an armed style, which has to open a run of its own, and at a caret between two run spans, where a browser would type into the run before it.

Fixes: a center- or bottom-aligned overlay is re-placed in the same task as a keystroke that changes its line count, as it already was for a paste or a delete.

Behavior change: a character typed with the caret past a trailing line break now goes where the browser draws that caret, at the end of the line before the break. The hand insertion put it after the break, on a line the caret was not shown on.
