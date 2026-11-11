---
"@weasel-js/diagram": patch
---

A live layout no longer mistakes two graphs for one when node ids hold `>`, `,` or `|`, so a stale plan cannot land on a changed graph.

<!-- entry: rank=-5 fix -->
