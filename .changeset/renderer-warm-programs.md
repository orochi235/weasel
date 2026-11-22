---
'@weasel-js/renderer': minor
---

`warmPrograms()` starts a renderer's first-frame shaders compiling at startup, so a canvas made soon after need not wait on them.

Call it once, as early as the app runs, before the data a canvas waits on arrives. It compiles on a context of its own, which the browser shares with the renderer made later, and lets that context go when the programs finish. It does nothing without WebGL2 or `KHR_parallel_shader_compile`.

```ts
import { warmPrograms } from '@weasel-js/renderer';
warmPrograms();
```

<!-- entry: rank=5 perf api -->
