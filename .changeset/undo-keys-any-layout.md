---
"@weasel-js/gestures": patch
"@weasel-js/routing": patch
---

Undo, redo and every `matchesKeyBinding` shortcut fire on a non-Latin keyboard layout. They read the letter the key bears, as canvas bindings already did.

<!-- entry: fix -->
