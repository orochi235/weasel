---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
---

`PREF_STATUS` is renamed `ROOT_PREF_STATUS`: it is the status a schema's root sits in.

```ts
// before
let status = PREF_STATUS;
// after
let status = ROOT_PREF_STATUS;
```

<!-- entry: breaking api -->
