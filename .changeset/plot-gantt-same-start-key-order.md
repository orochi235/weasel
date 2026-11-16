---
'@weasel-js/plot': patch
---

`setGanttTaskStart` and `setGanttTaskEnd` hand back the chart unchanged for the start or end a task already has, whatever order its keys are written in.

<!-- entry: fix -->
