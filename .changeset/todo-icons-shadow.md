---
'@weasel-js/icons-plugin': patch
---

`icon()` calls through a parameter or local declaration that shadows the imported `icon` (or its alias) are no longer rewritten as icon refs; only calls that resolve to the import are.
