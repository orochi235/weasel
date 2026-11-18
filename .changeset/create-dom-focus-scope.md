---
'@weasel-js/ui': major
---

`domFocusScope` and `domMeasureEnv` are `createDomFocusScope` and `createDomMeasureEnv`.

They are named as the factories they are; their arguments are unchanged.

```ts
// before
const scope = domFocusScope(root);
const env = domMeasureEnv(el);
// after
const scope = createDomFocusScope(root);
const env = createDomMeasureEnv(el);
```

<!-- entry: breaking api -->
