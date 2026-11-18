---
'@weasel-js/stroke': major
'@weasel-js/core': major
---

`resolveStrokeWidth` is removed; `resolveScreenLength` from `@weasel-js/paint`, which it only called, resolves a stroke width the same way.

```ts
// before
import { resolveStrokeWidth } from '@weasel-js/stroke';
const w = resolveStrokeWidth(stroke.width ?? 1, scale);
// after
import { resolveScreenLength } from '@weasel-js/paint';
const w = resolveScreenLength(stroke.width ?? 1, scale);
```

<!-- entry: breaking api -->
