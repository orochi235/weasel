---
'@weasel-js/prefs-schema': minor
'@weasel-js/prefs': minor
---

`PrefValuesOf<typeof group>` types the values a prefs group holds, so options can be typed from the schema that draws them.

```ts
const grid = pref.group('Grid', { visible: pref.boolean('Shown', true), pitch: pref.number('Pitch', 8) });
type GridValues = PrefValuesOf<typeof grid>; // { visible: boolean; pitch: number }
```

<!-- entry: rank=10 new api -->
