---
'@weasel-js/react': major
'@weasel-js/core': major
---

`useCanvasFocus`'s return type is `UseCanvasFocusReturn`, as every other hook's `*Return` type is named; it was `CanvasFocusReturn`.

```ts
// before
import type { CanvasFocusReturn } from '@weasel-js/react';
// after
import type { UseCanvasFocusReturn } from '@weasel-js/react';
```

<!-- entry: breaking api -->
