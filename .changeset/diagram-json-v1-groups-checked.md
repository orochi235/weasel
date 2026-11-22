---
'@weasel-js/diagram-formats': patch
---

Reading diagram JSON refuses a version 1 graph page whose `groups` is not a list of items with string ids. A version 2 file's `clusters` was already checked this way.

<!-- entry: fix data -->
