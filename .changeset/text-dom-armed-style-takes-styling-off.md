---
"@weasel-js/text-dom": patch
---

Styling armed at a collapsed caret can take styling off: Cmd+B at the end of a bold word types the next character without bold.

The same goes for Cmd+Shift+- at the end of a subscript or a panel clearing a size there, and `effectiveStyle` shows it off. `pendingStyle` may now hold a key as `false` or `undefined`, meaning the next character takes it off.

<!-- entry: fix api -->
