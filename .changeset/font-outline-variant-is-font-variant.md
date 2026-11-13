---
'@weasel-js/font': major
'@weasel-js/core': major
---

`OutlineVariant` is gone; `registerFontOutlines`, `unregisterFontOutlines` and `loadFontOutlines` take the same `FontVariant` that `registerFont` does.

The two types were identical. Import `FontVariant` instead:

```ts
// before
import type { OutlineVariant } from '@weasel-js/font';
// after
import type { FontVariant } from '@weasel-js/font';
```

<!-- entry: breaking -->
