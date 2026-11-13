---
'@weasel-js/editor': patch
---

`nodeSpecsFromSnapshot` takes a reviver that migrates older saved data, typed `(data: TData) => TData`, with no cast.

```ts
const migrate = ({ color, ...rest }: Saved): Saved => (color === undefined ? rest : { ...rest, fill: color });
const specs = nodeSpecsFromSnapshot(json, registry, migrate);
```

<!-- entry: fix -->
