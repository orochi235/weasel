---
'@weasel-js/plot': major
---

`setGanttEnd` is `setGanttEndDay`: it takes a day number, beside `setGanttTaskEnd`, which takes a written `GanttEnd`.

```ts
// before
const next = setGanttEnd(data, 0, 2, day);
// after
const next = setGanttEndDay(data, 0, 2, day);
```

<!-- entry: breaking api -->
