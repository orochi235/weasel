---
'@weasel-js/prefs': minor
---

`usePrefsValues` returns `setAuto`, the handler `PrefsForm`'s `onAutoChange` takes: false pins a leaf at the value it reads now, true resets it.

Its documentation said `reset` served as `onAutoChange`, but `reset` ignores the second argument, so clicking an inheriting leaf's label to pin it reset it again and left it inheriting.

```tsx
const { values, set, unset, setAuto } = usePrefsValues(store);
<PrefsForm schema={schema} values={values} onChange={set} auto={unset} onAutoChange={setAuto} />
```

<!-- entry: api fix -->
