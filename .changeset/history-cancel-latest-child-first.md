---
'@weasel-js/history': patch
---

`Journal.cancel()` unwinds the journals still open inside it in the order of their latest edits, newest first, rather than newest opened first.

<!-- entry: fix -->
