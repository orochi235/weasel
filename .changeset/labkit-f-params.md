---
'@weasel-js/labkit': minor
---

`f.params` turns a library's plain-data `ParamShape` into an instrument's config, with no converter of its own.

Each param becomes the `f` leaf of its kind and each group an `f.group`, so a value sits at the same path in the config as in the description, and the config is typed from it. `options.defaults` supplies values a description leaves out. `configFromParams` is the same function, exported from `@weasel-js/labkit/config`.

```ts
const config = f.params(TUNING_SCHEMA, { defaults: DEFAULT_TUNING });
```

<!-- entry: rank=5 new api -->
