---
'@weasel-js/routing': minor
'@weasel-js/core': patch
---

A carry or a `useDragHandle` drag whose release the page never saw drops nothing, and a `startThresholdDrag` press below its threshold no longer reports it as a click; each cancels instead.

`openPointerSession` takes `missedRelease: 'cancel'` (or a function answering at that moment) to make the same choice, reported as the cancel reason `'missedrelease'`; the default, `'end'`, is unchanged.

<!-- entry: fix api behavior -->
