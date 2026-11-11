---
"@weasel-js/diagram": patch
---

A live layout waiting on a planner's answer no longer takes two different graphs for the same one when node ids hold `>`, `,` or `|`: an edge from `>` to `` read the same as one from `` to `>`, so a stale plan could land on a changed graph.
