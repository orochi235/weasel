---
'@weasel-js/ui': patch
---

Splitting a `BandEditor` band left of the selected one moved the selection onto a different band, because the indices shifted and `onSelect` was not called. It is now called with the selected band's new index.
