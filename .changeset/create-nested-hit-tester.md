---
'@weasel-js/core': major
---

`nestedHitTester` is `createNestedHitTester`, since it builds hit-testers.

```ts
// before
const { pickBest } = nestedHitTester(adapter, geometry);
// after
const { pickBest } = createNestedHitTester(adapter, geometry);
```

<!-- entry: breaking api -->
