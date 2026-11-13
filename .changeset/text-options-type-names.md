---
'@weasel-js/text': major
'@weasel-js/core': major
---

`@weasel-js/text`'s option types all end in `Options`, as `FitTextPoseOptions` and `TextToPathOptions` already did: `LayoutRunsOpts`, `PaintRunsOpts`, `MeasureTextBoundsOpts`, `TextLineBoxesOpts` and `PointInTextPoseOpts` are renamed.

```ts
// before
import type { LayoutRunsOpts, PaintRunsOpts } from '@weasel-js/core';
// after
import type { LayoutRunsOptions, PaintRunsOptions } from '@weasel-js/core';
```

<!-- entry: breaking -->
