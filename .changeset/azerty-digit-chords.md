---
'@weasel-js/gestures': patch
---

A shortcut on a digit, such as Mod+1, fires on AZERTY and other layouts whose unshifted digit row types punctuation.

`ChordSource` gains an optional `shiftKey`: a shifted digit-row chord (Ctrl+Shift+1 typing `!`) still reads as what it typed.

<!-- entry: fix api -->
