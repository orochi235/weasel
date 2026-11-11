---
"@weasel-js/editor": patch
"@weasel-js/core": patch
---

A document saved through `serializeReplacer` reads back equal through `reviveTypedArrays`, whatever its data holds. A plain object shaped like a tagged typed array, or plain numbers under a `commands` or `coords` key, is written inside a `{ "__raw": … }` wrapper that the reader takes off; older saves read as before.

<!-- entry: fix data -->
