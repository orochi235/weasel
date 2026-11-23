---
"@weasel-js/labkit": patch
---

Closing a lightbox opened inside another open one leaves the shared canvas surface scoped to the outer lightbox, so the tiles behind it stay hidden.

<!-- entry: fix visual -->
