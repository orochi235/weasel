---
'@weasel-js/path-tools': major
---

`livePathEdit` is `createLivePathEditAction`, spelled like the other action factories.

```ts
// before
const inset = livePathEdit({ id: 'inset', label: 'Inset', param: 'distance', params, edit, commit });
// after
const inset = createLivePathEditAction({ id: 'inset', label: 'Inset', param: 'distance', params, edit, commit });
```

<!-- entry: breaking api -->
