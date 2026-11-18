---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
'@weasel-js/labkit': major
---

The functions that read or write a value at a dotted path drop `Path` from their names, as the kit's `…At` functions do.

prefs-schema's (and prefs') `prefValueAtPath` is `prefValueAt`, and `assignPrefValueAtPath` is `assignPrefValueAt`. labkit's `valueAtPath`, `withValueAtPath` and `schemaNodeAtPath` are `configValueAt`, `withConfigValueAt` and `schemaNodeAt`.

```ts
// before
const v = valueAtPath(config, 'grid.size');
const next = withValueAtPath(config, 'grid.size', 12);
// after
const v = configValueAt(config, 'grid.size');
const next = withConfigValueAt(config, 'grid.size', 12);
```

<!-- entry: breaking api -->
