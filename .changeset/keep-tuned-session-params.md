---
'@weasel-js/routing': patch
---

An action with a tuning that keeps the last-operation panel's params no longer remembers them as session params of its own. Those session params lay over a tool's options and froze them at the last committed run, so after one polygon or star was drawn, changing its sides or points in the options row, or with the arrow keys mid-drag, no longer reached the next one.
