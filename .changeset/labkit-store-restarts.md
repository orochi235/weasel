---
"@weasel-js/labkit": patch
---

The lab store gains a `resetTrial(trialId, instruments)` action, which the lab's Reset goes through.

It and the store's `loadSnapshot` start a trial's undo afresh on an instrument's own history whoever calls them, not only through the lab's commands.

<!-- entry: api fix -->
