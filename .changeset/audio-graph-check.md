---
"@weasel-js/audio": minor
---

`AudioGraph.check(patches)` throws the structural error `apply` would throw for a batch, without changing the graph.

An `apply` that throws after a passing `check` has landed every patch, and only a source's start or a param write failed.

<!-- entry: api -->
