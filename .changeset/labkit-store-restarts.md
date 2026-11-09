---
"@weasel-js/labkit": patch
---

The lab store gains a `resetTrial(trialId, instruments)` action, which the lab's Reset now goes through; it and the store's `loadSnapshot` start a trial's undo afresh on an instrument's own history whoever calls them, not only through the lab's commands.
