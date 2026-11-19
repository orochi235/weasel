---
'@weasel-js/core': major
---

Core's op factories move to `@weasel-js/core/ops` under short names, and leave the main and engine entries

```ts
// before
import { createInsertOp, createSetPoseOp } from '@weasel-js/core';
ctx.applyBatch([createInsertOp({ node }), createSetPoseOp({ id, from, to })]);

// after
import * as ops from '@weasel-js/core/ops';
ctx.applyBatch([ops.insert({ node }), ops.setPose({ id, from, to })]);
```

Each short name drops `create` and `Op`: `insert`, `delete`, `setPose`, `reparent`, `swap`, `insertNode`, `deleteNode`, `geometryData`, `setData` and the rest. `@weasel-js/core` and `@weasel-js/core/engine` no longer export any `create…Op`; the ops entry loads no 2D code, so an engine host imports it too.

<!-- entry: breaking api -->
