---
'@weasel-js/ui': patch
---

`ShortcutSheet`'s search reads a `+` standing alone or ending a word as joining keys. `Cmd + Z` finds Undo, and `Ctrl+` keeps listing the Ctrl shortcuts while typing; `+` alone or `Ctrl++` still names the plus key.

<!-- entry: fix -->
