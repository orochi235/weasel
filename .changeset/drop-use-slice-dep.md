---
'@weasel-js/core': major
---

`useSliceDep` is gone; a custom `slice` dep is published with `useDepSource`, as every other dep is overridden.

```tsx
// before
useSliceDep({ commit });
// after
useDepSource('slice', () => ({ commit }));
```

<!-- entry: breaking api -->
