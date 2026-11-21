---
'@weasel-js/svg': patch
---

Importing SVG applies an `@container` rule whose prelude is a comma-separated list of queries when any one of them holds, not only the first.

<!-- entry: fix visual -->
