---
'@weasel-js/renderer': patch
---

A pattern fill whose texture id and image were first uploaded as a font atlas no longer changes the pixels of a draw already batched under that id.

<!-- entry: rank=-5 fix visual -->
