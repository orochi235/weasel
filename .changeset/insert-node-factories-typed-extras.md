---
'@weasel-js/core': minor
---

An `insertNodeFactories` entry for a kit kind receives that kind's own extras, so a `pencil` factory reads `extras.samples` with no cast.

The map's type is the new `InsertNodeFactories`: `pencil`, `line`, `polygon`, `star`, `path` and the other kit kinds each get `Extract<InsertExtras, { kind }>`, and any other key still takes an `InsertNodeFactory` over the whole union. `InsertNodeFactory<E>` takes the extras type as an optional parameter.

```tsx
const factories: InsertNodeFactories = {
  pencil: (_bounds, { samples }) => ({ data: { path: polygonFromPoints(samples) } }),
};
```

<!-- entry: api -->
