---
'@weasel-js/history': patch
---

A history can now be read and moved by time, using each entry's `timestamp` (taken from `now()`, which a caller can point at any clock). `timestampAt(i)` reads an entry's stamp in time order without allocating, `depthAt(t)` gives the undo depth at time `t`, so `goto(depthAt(t))` seeks either way, and `prune(t)` evicts undo entries stamped before `t` through `onEvict`, never touching redo. Serialized entries now carry `timestamp`, which `restore()` used to reset to 0. `goto` to the depth it is already at no longer notifies subscribers.
