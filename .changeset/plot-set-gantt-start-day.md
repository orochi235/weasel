---
'@weasel-js/plot': major
---

`moveGanttTask` is `setGanttStartDay`: it sets a task's start day, while plot's other `move…` functions reorder.

```ts
// before
const next = moveGanttTask(data, 0, 2, day);
// after
const next = setGanttStartDay(data, 0, 2, day);
```

<!-- entry: breaking api -->
