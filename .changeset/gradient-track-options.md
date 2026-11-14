---
'@weasel-js/ui': major
---

`paintGradientTrack`'s options type is `GradientTrackOptions`, under the `Options` suffix every option type takes; `GradientTrackOpts` is gone.

```ts
// before
import type { GradientTrackOpts } from '@weasel-js/ui';
// after
import type { GradientTrackOptions } from '@weasel-js/ui';
```

<!-- entry: breaking -->
