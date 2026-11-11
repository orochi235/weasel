---
"@weasel-js/editor": patch
---

`docFromSnapshot` reads each document value back as `serializeReplacer` was handed it, so it agrees with the undo stack saved beside it. That includes a value shaped like the writer's `{ "__raw": … }` wrapper or like a tagged typed array.

<!-- entry: rank=-5 fix data -->
