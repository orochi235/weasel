---
'@weasel-js/prefs': major
---

A `ResetWrite`'s `write` field is renamed `value`: it holds the value the reset writes.

```ts
// before
for (const { path, write } of plan) set(path, write);
// after
for (const { path, value } of plan) set(path, value);
```

<!-- entry: breaking api -->
