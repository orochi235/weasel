---
'@weasel-js/prefs': major
---

`resetReading` is renamed `resetReader`, since it returns a reader function.

```ts
// before
const read = resetReading(source);
// after
const read = resetReader(source);
```

<!-- entry: breaking api -->
