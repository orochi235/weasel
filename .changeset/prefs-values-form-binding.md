---
'@weasel-js/prefs': minor
---

`usePrefsState` returns `form`, which binds a `PrefsForm` or `PrefsDialog` to the store in one spread: values, Auto, and scoped values.

```tsx
const { form } = usePrefsState(store);
<PrefsForm layout="list" {...form} />
```

The type is `PrefsFormBinding`, from `@weasel-js/prefs/react`.

<!-- entry: api -->
