---
'@weasel-js/core': major
---

`ResizeAdapter` and `RotateAdapter` are gone; type a resize or rotate adapter as `MoveAdapter`, which carries every member they had.

Nothing in the kit read either type, and `SceneCanvasAdapter` already satisfied both through `MoveAdapter`.

```ts
// before
import type { ResizeAdapter } from '@weasel-js/core';
const adapter: ResizeAdapter<Node, Pose> = …;
// after
import type { MoveAdapter } from '@weasel-js/core';
const adapter: MoveAdapter<Node, Pose> = …;
```

<!-- entry: breaking api -->
