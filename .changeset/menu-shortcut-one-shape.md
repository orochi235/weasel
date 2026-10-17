---
'@weasel-js/menu': patch
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

`MenuShortcut` is now the one shortcut shape, and `@weasel-js/gestures`' `ShortcutInput` is an alias of it rather than a wider copy: a key list naming spellings of one keycap, optional modifiers, and `shift: 'optional'`. A tool's `keybinding` can be a menu row's shortcut as-is. `@weasel-js/gestures` now depends on `@weasel-js/menu`, for that type only; menu still needs no React and no DOM. routing's `ActionShortcut` is the same type under a third name.
