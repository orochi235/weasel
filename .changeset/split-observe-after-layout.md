---
'@weasel-js/labkit': patch
---

A `Split` with no `viewport` no longer makes Chrome report "ResizeObserver loop completed with undelivered notifications" when its content pane mounts. It now starts measuring its strip after the frame's resize notifications have gone out, rather than in the middle of them.
