---
'@weasel-js/font': major
---

`getFont` is `getAtlasFont`: it looks up a registered atlas face only, never an outline or canvas one.

```ts
// before
const entry = getFont('Inter', 700);
// after
const entry = getAtlasFont('Inter', 700);
```

<!-- entry: breaking api -->
