---
'@weasel-js/geom': major
'@weasel-js/ui': major
---

`easingLabel`, `easingBezier`, `sampleEasing` and `EASING_NAMES` moved from `@weasel-js/ui` to `@weasel-js/geom`, beside `EasingSpec`.

```ts
// before
import { easingLabel, sampleEasing } from '@weasel-js/ui';
// after
import { easingLabel, sampleEasing } from '@weasel-js/geom';
```

<!-- entry: breaking api -->
