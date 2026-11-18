---
'@weasel-js/prefs': major
---

`filed` from `@weasel-js/prefs/edit` is renamed `fileActions`: it adds a catalog pref for each action not yet in the catalog.

```ts
// before
const root = filed(catalog, actions);
// after
const root = fileActions(catalog, actions);
```

<!-- entry: breaking api -->
