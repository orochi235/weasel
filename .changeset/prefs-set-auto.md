---
'@weasel-js/prefs': minor
---

`usePrefsValues` returns `setAuto`, the handler `PrefsForm`'s `onAutoChange` takes: false pins a leaf at the value it reads now, true unpins it.

It is `store.setAuto`, which does nothing to a leaf whose schema declares no `auto`.

```tsx
const { values, set, auto, setAuto } = usePrefsValues(store);
<PrefsForm schema={schema} values={values} onChange={set} auto={auto} onAutoChange={setAuto} />
```

<!-- entry: api fix -->
