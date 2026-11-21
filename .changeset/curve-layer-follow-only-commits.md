---
'@weasel-js/ui': patch
---

A curve layer whose consumer follows `onInput` without writing it back into `state` still commits the drag through `onChange`, and a canceled drag sends that consumer's `onInput` the state it began from.

<!-- entry: fix -->
