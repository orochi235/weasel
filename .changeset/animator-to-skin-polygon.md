---
'@weasel-js/animator': major
---

`skinnable` is `toSkinPolygon`: it converts a path into the polygon a skin indexes.

```ts
// before
const polygon = skinnable(rest);
// after
const polygon = toSkinPolygon(rest);
```

<!-- entry: breaking api -->
