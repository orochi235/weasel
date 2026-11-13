---
'@weasel-js/labkit': major
---

`.resettable()` marks the resolved group itself, `PrefGroup.resettable`, and `ResolvedConfig` no longer has a `resettable` set.

```ts
// Before
resolved.resettable?.has('grid');

// After
(resolved.group.children.grid as PrefGroup).resettable === true;
```

<!-- entry: breaking api -->
