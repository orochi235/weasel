---
'@weasel-js/routing': major
'@weasel-js/core': major
---

`startThresholdDrag` names its callbacks for a drag's start and end, as a pointer session does: `onActivate` is `onStart` and `onCommit` is `onEnd`.

```ts
// before
startThresholdDrag(e, { onActivate: begin, onMove: follow, onCommit: finish });
// after
startThresholdDrag(e, { onStart: begin, onMove: follow, onEnd: finish });
```

<!-- entry: breaking api -->
