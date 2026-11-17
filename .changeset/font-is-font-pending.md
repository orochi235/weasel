---
'@weasel-js/font': major
---

`fontPending` is `isFontPending`, prefixed like the other predicates.

```ts
// before
if (fontPending('Inter', 700)) return;
// after
if (isFontPending('Inter', 700)) return;
```

<!-- entry: breaking api -->
