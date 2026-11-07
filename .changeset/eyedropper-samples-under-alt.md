---
'@weasel-js/core': patch
---

The eyedropper engaged by holding Alt, its default hotkey, never sampled: the click still carried Alt, and its binding forbade every modifier. Its click now accepts the modifier its hotkey names.
