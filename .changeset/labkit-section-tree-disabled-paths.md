---
'@weasel-js/labkit': major
---

`sectionTree`'s set of disabled paths is now `disabledPaths`, the name `PrefsForm` takes it under.

```tsx
// before
<PrefsForm schema={tree.group} values={tree.values} disabled={tree.disabled} onChange={write} />
// after
<PrefsForm schema={tree.group} values={tree.values} disabledPaths={tree.disabledPaths} onChange={write} />
```

<!-- entry: breaking api -->
