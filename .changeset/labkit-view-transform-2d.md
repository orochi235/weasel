---
'@weasel-js/labkit': major
---

labkit's 2D camera type is exported only as `ViewTransform2D`; the `ViewTransform` name, which core uses for a different shape, is gone.

```ts
// before
import type { ViewTransform } from '@weasel-js/labkit';
// after
import type { ViewTransform2D } from '@weasel-js/labkit';
```

<!-- entry: breaking api -->
