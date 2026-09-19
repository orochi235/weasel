---
'@weasel-js/labkit': patch
---

A saved snapshot now remembers which fields were auto. Loading it restores that
set along with the config and state, so a field the snapshot had pinned comes
back pinned instead of being overwritten by the resolver. Snapshots saved by an
earlier version have no such record and load as before, leaving the trial's
current auto fields alone. Additive: `SavedSnapshot` gains an optional `auto`.
