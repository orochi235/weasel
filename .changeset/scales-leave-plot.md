---
'@weasel-js/plot': major
'@weasel-js/scales': minor
---

The scales move from `@weasel-js/plot` and its `./scales` entry to `@weasel-js/scales`.

This is breaking: `@weasel-js/plot/scales` is gone, and `@weasel-js/plot` no longer exports `linearScale`, `logScale`, `powScale`, `warpScale`, `timeScale`, `bandScale`, `ordinalScale`, `polarScale`, `formatTick`, `formatNumber` or their types. Import them from `@weasel-js/scales`. A polar scale's points are geom's `Point`, the same `{ x, y }` as plot's `PlotPoint`.

```ts
import { linearScale, formatTick } from '@weasel-js/scales';
```

<!-- entry: breaking api -->
