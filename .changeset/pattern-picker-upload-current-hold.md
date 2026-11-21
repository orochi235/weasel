---
'@weasel-js/ui': patch
---

An image read that finishes while a `PatternPicker` is disabled or read-only commits nothing.

One that finishes after `onChange` changes goes to the new handler.

<!-- entry: fix -->
