---
'@weasel-js/ui': patch
---

A `Timeline` with no `onInput` no longer calls `onCancel` when a key drag is canceled or released back on its own time, since it sent no input to put back.

<!-- entry: fix -->
