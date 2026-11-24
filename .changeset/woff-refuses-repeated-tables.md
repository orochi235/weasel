---
'@weasel-js/font': patch
---

The outline parser refuses a WOFF file that lists a table twice or points two tables at the same bytes, rather than inflating the shared data once for each record.

<!-- entry: fix -->
