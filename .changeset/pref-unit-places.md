---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
'@weasel-js/prefs-editor': major
---

A linear pref unit names its decimal places `places`, as quantity's displays do; it was `precision`.

The rename covers `PrefLinearUnit`, `ResolvedPrefUnit`, and the options of `prefUnit` and `unitScopedPrefUnit`.
`PrefSchemaEditor` writes `places`. Drafts and submissions it saved with `precision` still open with the same
rounding: they are read as `places` when loaded, and written as `places` from then on.

```ts
// before
const degrees = prefUnit(ANGLE_RADIANS, 'deg', { precision: 1, suffix: '°' });
const percent: PrefLinearUnit = { scale: 0.01, precision: 0, suffix: '%' };
// after
const degrees = prefUnit(ANGLE_RADIANS, 'deg', { places: 1, suffix: '°' });
const percent: PrefLinearUnit = { scale: 0.01, places: 0, suffix: '%' };
```

<!-- entry: breaking api data -->
