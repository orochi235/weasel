---
'@weasel-js/core': major
---

`InertiaConfig` is now `InertiaOptions`, and its duplicate name `HandToolInertiaConfig` is gone.

The type of the `inertia` option on `useHandTool`, `viewport.dragPan` and `SceneCanvas`'s `viewport` prop is spelled as every other options bag is.

```ts
// before
import type { InertiaConfig, HandToolInertiaConfig } from '@weasel-js/core';
// after
import type { InertiaOptions } from '@weasel-js/core';
```

<!-- entry: breaking api -->
