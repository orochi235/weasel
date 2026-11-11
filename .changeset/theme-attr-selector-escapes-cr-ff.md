---
'@weasel-js/theme': patch
---

A theme name or axis value holding a carriage return or a form feed no longer breaks the selector `applyTheme` and the token stylesheet write for it. Both end a CSS string as a newline does, and only the newline was escaped, so the rule was dropped as invalid.
