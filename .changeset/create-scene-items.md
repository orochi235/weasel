---
'@weasel-js/core': minor
---

`createScene` takes the flat `{ items }` form `useScene` takes, so a scene of plain items can be built outside React.

```ts
const scene = createScene({ items: [{ id: 'a', x: 0, y: 0, width: 10, height: 10 }] });
```

<!-- entry: api -->
