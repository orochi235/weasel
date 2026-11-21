---
'@weasel-js/theme': patch
---

`derive` reports a pin or component whose fields have the wrong types, and makes no token of it.

This covers `value`, `type`, `description`, `alpha`, and `scope`, so `emitCss` no longer throws on a bad description. An `alpha` outside 0 to 1, on a pin or a semantic `ref`, is reported too.

<!-- entry: fix -->
