---
'@weasel-js/prefs': major
---

`ONE` from `@weasel-js/prefs/edit` is renamed `LONE_SCHEMA_ID`: the asset id a lone schema is edited as.

```ts
// before
const mine = assets.find((a) => a.id === ONE);
// after
const mine = assets.find((a) => a.id === LONE_SCHEMA_ID);
```

<!-- entry: breaking api -->
