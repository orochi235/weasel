---
'@weasel-js/ui': patch
---

A curved row forgets an item's measured length once the item leaves the row, so its work per render stays bounded.

<!-- entry: fix perf -->
