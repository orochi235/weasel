---
'@weasel-js/routing': patch
---

With two dispatchers on one surface, a keystroke the one holding the keys declines no longer asks the other's `over` bindings a second time: one trace record, one `enabled` call, and one refusal per keystroke.

<!-- entry: fix -->
