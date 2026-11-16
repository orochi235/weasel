---
'@weasel-js/core': major
'@weasel-js/routing': minor
---

`startThresholdDrag` and its `ThresholdDragOptions` and `ThresholdDragHandle` types move from `@weasel-js/core` to `@weasel-js/routing`.

This is breaking: import them from `@weasel-js/routing`. The function itself is unchanged.

```ts
import { startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/routing';
```

<!-- entry: breaking api -->
