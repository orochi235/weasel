---
'@weasel-js/audio': patch
---

An audio graph's `add` and `replace` throw on a def the graph already holds: each node takes a def of its own.

<!-- entry: fix -->
