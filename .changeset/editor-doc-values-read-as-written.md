---
"@weasel-js/editor": patch
---

`docFromSnapshot` reads each document value back as `serializeReplacer` was handed it. A value shaped like the writer's `{ "__raw": … }` wrapper or a tagged typed array was written wrapped and read back with the wrapper still on, so it disagreed with the undo stack saved beside it, which is revived.
