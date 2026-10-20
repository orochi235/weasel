---
"@weasel-js/core": patch
---

A content handler's `IngestCtx` now carries the canvas's `snap` dep as `ctx.snap`, so a handler can place what it inserts where a gesture would: begin a `'point'` session at the would-be position, take `at()`, and `end()` it. The `ingest` and `clipboard.pasteEvent` actions declare `snap` among their `requires`.
