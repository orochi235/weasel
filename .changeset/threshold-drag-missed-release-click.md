---
'@weasel-js/routing': minor
'@weasel-js/ui': patch
---

`startThresholdDrag` takes `missedRelease: 'click'` to report a press below its threshold whose release the page never saw as a click; `useReorderDragList` passes it, so such a press still reports its row.

<!-- entry: api fix -->
