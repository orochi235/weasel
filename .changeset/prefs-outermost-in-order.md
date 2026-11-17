---
'@weasel-js/prefs': major
---

`carried` from `@weasel-js/prefs/edit` is renamed `outermostInOrder`: the outermost of the paths given, in schema order.

```ts
// before
const paths = carried(root, chosen);
// after
const paths = outermostInOrder(root, chosen);
```

<!-- entry: breaking api -->
