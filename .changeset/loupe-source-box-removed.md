---
'@weasel-js/loupe': major
'@weasel-js/labkit': major
---

`SourceBox` is gone from `@weasel-js/loupe` and `@weasel-js/labkit/loupe`; a canvas source's `box` is geom's `Rect`, the same `x`, `y`, `width`, `height`.

```ts
// before
import type { SourceBox } from '@weasel-js/loupe';
// after
import type { Rect } from '@weasel-js/geom';
```

<!-- entry: breaking api -->
