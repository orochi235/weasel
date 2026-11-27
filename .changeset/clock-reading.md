---
'@weasel-js/clock': minor
---

A `Reading` is a measurement that runs on between updates, `{ value, at, rate }`, read at any host time with `readingAt`.

`nextReading(shown, next)` re-anchors on each update. Where an update lands behind what is already shown, it holds the shown value until its own line catches up, so a count never runs backward. One further behind than `maxHold` (default 2000 ms of host time), or one that has stopped, snaps instead. `holdEndOf` says when a hold lets go.

<!-- entry: rank=5 new api -->
