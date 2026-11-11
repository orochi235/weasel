---
"@weasel-js/animator": patch
---

A timeline canceled by one of its own event handlers fires nothing more, as one a handler seeks stops firing where the seek left it. The rest of the frame's crossings still fired, in the frame the handler canceled it.
