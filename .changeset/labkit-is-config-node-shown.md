---
'@weasel-js/labkit': major
---

`isEntryShown` is renamed `isConfigNodeShown`: it judges a config schema node's `showIf`, and "entry" means a list item in prefs.

```ts
// before
if (!isEntryShown(entry, config, schema)) continue;
// after
if (!isConfigNodeShown(entry, config, schema)) continue;
```

<!-- entry: breaking api -->
