---
'@weasel-js/registry': minor
---

`getOwn` takes a record that may be `undefined` or `null`, and reads nothing from it.

```ts
getOwn(opts.labels, key); // was: opts.labels && getOwn(opts.labels, key)
```

<!-- entry: api -->
