---
'@weasel-js/text': major
---

`nodeHasFlag` is `styleHasFlag`: it reads a `TextStyle`, not a node.

```ts
// before
const bold = nodeHasFlag(style, 'bold');
// after
const bold = styleHasFlag(style, 'bold');
```

<!-- entry: breaking api -->
