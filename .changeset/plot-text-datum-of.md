---
'@weasel-js/plot': major
---

`plotTextOf` is `plotTextDatumOf`: it returns the datum of an editable text mark, not its text.

```ts
// before
const datum = plotTextOf(node);
// after
const datum = plotTextDatumOf(node);
```

<!-- entry: breaking api -->
