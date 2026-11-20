---
'@weasel-js/labkit': patch
---

Restyling a selection that spans a trial's targets is one undo step, rather than one per target.

Updates sharing a `coalesceKey` now undo and redo together on every target they land on, and keep doing so after the marks are saved and loaded.

<!-- entry: fix data -->
