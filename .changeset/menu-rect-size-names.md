---
'@weasel-js/menu': major
---

`@weasel-js/menu`'s `Rect` and `Size` are `MenuRect` and `MenuSize`.

The `{ x, y, w, h }` box no longer shares a name with geom's `Rect`, which spells its size `width` and `height`.

```ts
// before
import type { Rect } from '@weasel-js/menu';
// after
import type { MenuRect } from '@weasel-js/menu';
```

<!-- entry: breaking api -->
