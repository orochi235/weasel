---
'@weasel-js/ui': major
---

`useRovingTabIndex` and `useRowNavigation` report Enter and Space on a row with `onAction`, as `Tree` does; the option was `onActivate`.

```ts
// before
useRovingTabIndex({ orientation: 'horizontal', onActivate: (index) => open(index) });
// after
useRovingTabIndex({ orientation: 'horizontal', onAction: (index) => open(index) });
```

<!-- entry: breaking api -->
