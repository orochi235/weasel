---
'@weasel-js/prefs': minor
---

A `PrefsMigration` is handed `auto`, the leaves marked auto at its version, so a migration that renames a leaf can keep it auto.

```ts
const renameGrid: PrefsMigration = (records, auto) => {
  if (records.has('grid.size')) records.set('grid.step', records.get('grid.size'));
  records.delete('grid.size');
  if (auto?.delete('grid.size')) auto.add('grid.step');
};
```

A migration that ignores `auto` leaves every mark where it was, now stamped with the version reached.

<!-- entry: api fix -->
