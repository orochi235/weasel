---
'@weasel-js/menu': patch
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

`MenuShortcut` is now `@weasel-js/gestures`' `ShortcutInput`, the shape the shortcut formatters read, rather than a narrower copy of it: a key list naming spellings of one keycap, optional modifiers, and `shift: 'optional'`. A tool's `keybinding` can be a menu row's shortcut as-is. `@weasel-js/menu` now depends on `@weasel-js/gestures`, for that type only. routing's `ActionShortcut` is still the same type under a third name.
