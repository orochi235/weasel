---
'@weasel-js/labkit': major
---

A resolved leaf that is never auto has no `auto` field, where it said `auto: false`.

```ts
// Before
leaf.auto === false;

// After
!prefCanAuto(leaf);
```

<!-- entry: breaking api -->
