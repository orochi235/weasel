---
'@weasel-js/core': major
'@weasel-js/routing': major
'@weasel-js/renderer': major
---

The remaining `*Opts` types are `*Options`: `BindingOptions`, `ZoomClampOptions`, `WheelPanOptions`, `TilePatternOptions`.

`makeViewportWheelPanAction`'s options, which were `WheelPanOptions`, are now `ViewportWheelPanOptions`; `WheelPanOptions` is `wheelPan()`'s, which were `WheelPanOpts`. Only type names change.

```ts
// before
import type { BindingOpts, WheelPanOptions, WheelPanOpts } from '@weasel-js/core';
// after
import type { BindingOptions, ViewportWheelPanOptions, WheelPanOptions } from '@weasel-js/core';
```

<!-- entry: breaking api -->
