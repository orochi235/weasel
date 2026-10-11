---
'@weasel-js/ui': patch
---

`PrefsForm`: an alias row is marked as changed when the leaf it shows is named in `changed`, the same path its `auto` and `mixed` states are read at. It was read at the alias's own path, where an owner computing `changed` from stored values has no entry.
