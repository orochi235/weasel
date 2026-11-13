---
'@weasel-js/pdf': major
---

`@weasel-js/pdf` no longer exports a `Rect` type of its own; `WritePdfOptions.rasterize` takes `@weasel-js/geom`'s `Rect`, which has the same fields.

```ts
// before
import type { Rect } from '@weasel-js/pdf';
// after
import type { Rect } from '@weasel-js/geom';
```

<!-- entry: breaking -->
