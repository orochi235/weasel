---
'@weasel-js/prefs': minor
---

`usePrefsValues` returns `form`, everything a `PrefsForm` or `PrefsDialog` takes from the store under the props' own names, so one spread binds values, Auto, and scoped values.

```tsx
const { form } = usePrefsValues(store);
<PrefsForm layout="list" {...form} />
```

The type is `PrefsFormBinding`, from `@weasel-js/prefs/react`.

<!-- entry: api -->
