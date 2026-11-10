---
'@weasel-js/core': patch
---

A last-operation panel change made after switching tools is written back to the options of the tool the operation ran with, so the next polygon drawn takes the sides the panel set rather than the ones it had before.
