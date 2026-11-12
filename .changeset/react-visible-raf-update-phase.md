---
'@weasel-js/react': minor
---

`useVisibleRaf` takes `phase: 'update'` for a loop whose output others paint, so they paint it the same frame.

A paint loop on the same clock runs a due update loop's frame ahead of its own, and a paint loop asked for from inside an update's frame runs right after it. Default `'paint'`.

<!-- entry: api -->
