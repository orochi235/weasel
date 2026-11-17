---
'@weasel-js/editing': major
---

`useResizePolicy` is `useResizePolicyDepSource`, like the other hooks that publish a dep, and takes `UseResizePolicyDepSourceOptions`.

```ts
// before
useResizePolicy({ constraints });
// after
useResizePolicyDepSource({ constraints });
```

<!-- entry: breaking api -->
