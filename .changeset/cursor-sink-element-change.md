---
'@weasel-js/cursor': patch
---

When a cursor sink's target element changes, the element its override was on gets back the cursor it showed without it, rather than keeping the override's cursor.

<!-- entry: fix -->
