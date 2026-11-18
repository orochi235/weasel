---
'@weasel-js/symmetry': major
---

`handleChange` is `symmetryHandleChange`: one frame's change to a symmetry group from a handle drag, not an event handler.

```ts
// before
const change = handleChange(press, origin, from, to, snap);
// after
const change = symmetryHandleChange(press, origin, from, to, snap);
```

<!-- entry: breaking api -->
