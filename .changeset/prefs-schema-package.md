---
'@weasel-js/prefs-schema': minor
---

New package `@weasel-js/prefs-schema`: the pref builders and leaf, group and section types, without the prefs store

It holds the declaration half of `@weasel-js/prefs`: `pref`, `PrefGroup`, `PrefSection`, `PrefLeaf` and the other leaf kinds, units (`prefUnit`, `PX_UNIT`), conditions and leaf status, `repairPrefValue`, and `PresetDescription`. It depends on icons, paint, quantity and registry only, with no store, no storage and no React. A package that declares settings and leaves storing them to its host depends on this one:

```ts
import { pref, type PrefGroup } from '@weasel-js/prefs-schema';
```

<!-- entry: new api -->
