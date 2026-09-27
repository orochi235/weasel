---
"@weasel-js/core": patch
---

`window.__weaselTest.getActiveToolId()` now reports the canvas's active tool. It read a ref nothing wrote, so it returned `null` whatever tool was active; it now reads the tool registry directly.
