---
'@weasel-js/core': patch
---

A scene slot's `toPose` no longer leaves a derived-path memo entry on every derived node for each function identity it has ever had. The cached paths are held against the `toPose` function and are collected with it.
