---
'@weasel-js/cursor': patch
---

A cursor sink with no base takes its override off the element when it is cleared, even when the browser reads the cursor back spelled differently from how it was written.

<!-- entry: fix -->
