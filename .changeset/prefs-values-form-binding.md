---
'@weasel-js/prefs': minor
---

`usePrefsValues` returns `form`, which binds a `PrefsForm` or `PrefsDialog` to the store in one spread: values, Auto, and scoped values.

```tsx
const { form } = usePrefsValues(store);
<PrefsForm layout="list" {...form} />
```

The type is `PrefsFormBinding`, from `@weasel-js/prefs/react`.

<!-- entry: api -->
