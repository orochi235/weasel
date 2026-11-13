---
'@weasel-js/forge': major
---

A native story seeds its state with `initialState`, the name an instrument gives it; `story({ state })` is gone.

```ts
// before
export const Dragging = story({ config, state: (c) => ({ drags: 0, start: c.value }), render });
// after
export const Dragging = story({ config, initialState: (c) => ({ drags: 0, start: c.value }), render });
```

<!-- entry: breaking -->
