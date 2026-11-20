---
'@weasel-js/svg': patch
---

`parseSvg` leaves out a hidden or condition-failing `<symbol>` child, or hidden `<use>` target, as it does any other element.

A foreign-namespace child of a `<symbol>` is skipped without a warning, and `keepHidden` keeps hidden ones marked hidden.

<!-- entry: fix visual -->
