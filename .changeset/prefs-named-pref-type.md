---
'@weasel-js/prefs': major
---

`prefType` is renamed `namedPrefType`: it stamps a type name on a leaf.

```ts
// before
const Stop = prefType('GradientStop', leaf);
// after
const Stop = namedPrefType('GradientStop', leaf);
```

<!-- entry: breaking api -->
