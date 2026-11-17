---
'@weasel-js/core': major
---

`UseMoveOptions`, `UseResizeOptions` and `UseRotateOptions` are `MoveOptions`, `ResizeOptions` and `RotateOptions`.

They configure the move, resize and rotate actions; no `useMove` hook exists.

```ts
// before
import type { UseMoveOptions } from '@weasel-js/core';
// after
import type { MoveOptions } from '@weasel-js/core';
```

<!-- entry: breaking api -->
