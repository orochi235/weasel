---
'@weasel-js/ui': patch
---

A curve layer whose consumer reads `onInput` without writing it back into `state` still commits its drags.

`onChange` gets the dragged state, and a canceled drag sends `onInput` the state it began from.

<!-- entry: fix -->
