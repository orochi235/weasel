---
'@weasel-js/ui': patch
---

A `Timeline` key drag cut short because its row or the timeline unmounts no longer sends `onInput` the tracks as they were at the press, or calls `onCancel`.

<!-- entry: fix -->
