---
'@weasel-js/geom': major
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

`sampleByInterpolation` and `InterpolationMode` moved from `@weasel-js/ui` to `@weasel-js/geom`, beside the samplers they pick from.

`sampleCatmullRom` and `sampleMonotone` are new exports. `@weasel-js/labkit/weasel-ui` no longer re-exports the pair, and ui's `CurveSamplePoint` is gone: the samplers take and return geom's `Point`.

```ts
// before
import { sampleByInterpolation, type CurveSamplePoint } from '@weasel-js/ui';
// after
import { sampleByInterpolation, type Point } from '@weasel-js/geom';
```

<!-- entry: breaking api -->
