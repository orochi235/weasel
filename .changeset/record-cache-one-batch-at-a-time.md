---
'@weasel-js/storage': patch
---

A record cache sends one batch of writes at a time. Two flushes close together (the debounce and a `pagehide`, or an explicit `flush()`) used to send two overlapping batches, with two consequences. A write storage rejected was queued again even when a newer write to the same record had already landed, so the retry put the older value back in storage while memory kept the newer one. And `flush()` resolved true, and `close()` returned, while an earlier batch was still on its way and could yet fail. `flush()` now resolves once everything queued before it has landed or been refused.
