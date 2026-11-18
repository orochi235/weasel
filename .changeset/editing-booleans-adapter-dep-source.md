---
'@weasel-js/editing': major
---

`useBooleansAdapterSource` is `useBooleansAdapterDepSource`, named like the other hooks that publish a dep.

```ts
// before
useBooleansAdapterSource(scene, operands, adapter);
// after
useBooleansAdapterDepSource(scene, operands, adapter);
```

<!-- entry: breaking api -->
