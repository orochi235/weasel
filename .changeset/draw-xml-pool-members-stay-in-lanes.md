---
'@weasel-js/diagram-formats': patch
---

Draw-style XML writes a node a pool's lane holds inside that lane, even when the pool's own `members` name it too. A node only a pool's `members` name is written outside the pool, as the diagram draws it.

<!-- entry: fix data -->
