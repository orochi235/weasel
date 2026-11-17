---
'@weasel-js/clock': major
---

`holdElapsed` is `holdPosition`, since it holds a clock at a recorded `HeldPosition` rather than at an elapsed time alone.

```ts
// before
const hold = holdElapsed(handle, position);
// after
const hold = holdPosition(handle, position);
```

<!-- entry: breaking api -->
