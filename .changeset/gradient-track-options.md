---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

`paintGradientTrack`'s options type is `GradientTrackOptions`, under the `Options` suffix every option type takes; `GradientTrackOpts` is gone.

It is renamed in `@weasel-js/ui` and in labkit's `weasel-ui` passthrough alike.

```ts
// before
import type { GradientTrackOpts } from '@weasel-js/ui';
// after
import type { GradientTrackOptions } from '@weasel-js/ui';
```

<!-- entry: breaking -->
