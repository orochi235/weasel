---
'@weasel-js/clock': minor
---

A `ramp` that starts a held clock releases its `holdAt` or `holdPosition` hold, as a rate write does.

The new `Clock.ramping` reads whether a ramp is running; `rate` stays where it stood until the next sync.

<!-- entry: fix api -->
