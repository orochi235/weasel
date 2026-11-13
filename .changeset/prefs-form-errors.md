---
'@weasel-js/ui': minor
---

`PrefsForm` and `PrefsDialog` take `errors`, a message per leaf path, shown under that leaf's row as an alert.

```tsx
<PrefsForm schema={schema} values={values} onChange={set}
  errors={new Map([['account.name', 'Name is required']])} />
```

<!-- entry: api new -->
