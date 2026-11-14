---
'@weasel-js/geom': minor
---

`niceStep` rounds a number to 1, 2 or 5 times a power of ten, up, down or to the nearest.

```ts
import { niceStep } from '@weasel-js/geom';

niceStep(47.6); // 50: up by default, never under
niceStep(0.8, 'down'); // 0.5: never over, as a scale bar that has to fit
niceStep(3.1, 'nearest'); // 2: the closer by ratio, as an axis asking for about five ticks
```

<!-- entry: api -->
