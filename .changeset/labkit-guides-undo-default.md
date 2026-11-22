---
'@weasel-js/labkit': minor
---

`guides.change` is among the events a trial snapshots on by default, so each guide placed, moved or removed is an undo step.

An instrument naming its own `snapshotOn` adds `'guides.change'` to keep them. A saved history leaves these steps out, since the guides are not saved.

<!-- entry: behavior -->
