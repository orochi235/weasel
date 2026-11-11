---
"@weasel-js/text-dom": patch
---

Styling armed at a collapsed caret can now take styling off. Cmd+B at the end of a bold word, Cmd+Shift+- at the end of a subscript, or a panel clearing a size there used to arm nothing, so the next character kept the styling; it now types without it, and `effectiveStyle` shows it off. An armed bold or weight also lands as a write of it would: bold armed after a light `fontWeight` run drops the weight, and a weight armed after a bold run drops the flag, where the character used to carry both. `pendingStyle` may now hold a key as `false` or `undefined`, meaning the next character takes it off.
