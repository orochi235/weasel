---
'@weasel-js/font': patch
---

The outline parser refuses a `.ttc` member that lists a table twice or points two tables at the same bytes, with an error naming them, rather than allocating many times the file's size.

<!-- entry: fix -->
