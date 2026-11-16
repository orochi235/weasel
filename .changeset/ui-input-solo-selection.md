---
'@weasel-js/ui-input': minor
---

`soloFrom` and `soloSweepFrom` solo items of a selection model, and a `SelectionEdit` can `apply` several changes as one.

`soloFrom(model, index, count, enabled?)` is what an Alt-press does, by `soloChanges`; `soloSweepFrom` is an Alt-sweep's run, worked out from the states at the press. `selectionKeys`' `activate` takes `{ alt }` and solos with it.

<!-- entry: api -->
