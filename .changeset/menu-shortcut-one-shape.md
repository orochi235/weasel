---
'@weasel-js/menu': patch
'@weasel-js/ui': patch
'@weasel-js/routing': patch
---

`MenuShortcut` is now the one shortcut shape. It takes what weasel-ui's `ShortcutInput` took — a key list naming spellings of one keycap, optional modifiers, and `shift: 'optional'` — so a tool's `keybinding` passes as-is, and `formatShortcut`, `formatShortcutParts`, `keySpecsFromShortcut`, and `ToolPalette`'s `lookupShortcut` take it. `ShortcutInput` is gone from `@weasel-js/ui`; import `MenuShortcut` from `@weasel-js/menu`, or `ActionShortcut` from `@weasel-js/core`, which is the same type.
