---
'@weasel-js/history': patch
---

`Journal.cancel()` unwinds the journals open inside it latest edit first. It had gone by the order they were opened.

<!-- entry: fix -->
