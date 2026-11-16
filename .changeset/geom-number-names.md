---
'@weasel-js/geom': minor
---

`numberName` and `namedNumber` convert between a number JSON cannot hold and the name a tagged typed array writes it under.

Those numbers are `NaN`, `Infinity`, `-Infinity` and `-0`.

```ts
numberName(-Infinity); // '-Infinity'
numberName(3);         // undefined
namedNumber('-0');     // -0
```

<!-- entry: api -->
