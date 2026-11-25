---
'@weasel-js/cursor': minor
'@weasel-js/core': minor
---

A canvas that unmounts gives its input element back the cursor it had before the tool cursor was written, and clears its painted base.

`CursorSink` gains an optional `release()`, which `createCursorSink` implements: it gives up the base, and an override still set keeps showing until it clears.

<!-- entry: fix api -->
