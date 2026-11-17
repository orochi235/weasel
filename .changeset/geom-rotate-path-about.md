---
'@weasel-js/geom': major
'@weasel-js/core': major
---

`rotatePathAround` is renamed `rotatePathAbout`, the pivot word the rest of the kit uses (`rotateAboutPoint`).

```ts
// before
const turned = rotatePathAround(path, cx, cy, rad);
// after
const turned = rotatePathAbout(path, cx, cy, rad);
```

<!-- entry: breaking api -->
