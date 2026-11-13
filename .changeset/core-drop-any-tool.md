---
'@weasel-js/core': major
---

core's `AnyTool` type, kept as another name for `Tool`, is removed; import `Tool`.

```ts
// before
import type { AnyTool } from '@weasel-js/core';
// after
import type { Tool } from '@weasel-js/core';
```

<!-- entry: breaking -->
