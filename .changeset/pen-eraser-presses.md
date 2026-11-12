---
'@weasel-js/gestures': minor
'@weasel-js/routing': minor
'@weasel-js/core': minor
'@weasel-js/ui': patch
'@weasel-js/diagram': patch
---

A pen's eraser end presses, drags and draws on a canvas and on kit controls as its tip does; its barrel button is a secondary press.

`isPrimaryPress(e)` and `pressButtonOf(e)` are new, exported from `@weasel-js/gestures` (and `isPrimaryPress` from `@weasel-js/routing` and `@weasel-js/core`): the one answer to which button a pointer press was made with.

<!-- entry: fix api -->
