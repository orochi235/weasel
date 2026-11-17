---
'@weasel-js/hud': major
---

`measureLabel` is `textWidth`, since it measures the width of any text, not only a label.

```ts
// before
const width = measureLabel(text, 13, family);
// after
const width = textWidth(text, 13, family);
```

<!-- entry: breaking api -->
