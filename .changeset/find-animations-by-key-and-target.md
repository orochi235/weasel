---
'@weasel-js/animator': patch
---

Starting an animation under a `cancelKey`, and stopping a target, no longer cost more the more animations are running. Each searched the animator's whole table: a start for whoever held its key, `target.stop()` and a table's `remove(row)` for the animations on the target, and `cancelKey`, `isActive(key)`, `pauseKey`, `resumeKey`, and `setTimeScaleByKey` likewise. The animator now keeps its animations by key and by target. With 10,000 tweens running and 100 restarted a frame, a keyed start took 434 µs and takes 12, a cancel by key 325 µs and now 83, and a `target.stop()` 381 µs and now 69 (`node tests/perf/target-reads/run.mjs churn 10000 keyed` and `... churn 10000 stop`, one run each before and after on a machine busy with other work). What a cancel still costs is blits forgetting the voice. Nothing a caller sees changes.
