---
'@weasel-js/core': major
'@weasel-js/measure': minor
---

The measure tool and measurements moved out of `@weasel-js/core` into a new package, `@weasel-js/measure`.

Everything measuring exported now comes from `@weasel-js/measure`, unchanged except where noted: `useMeasureTool`, `createMeasurementsContribution`, `createMeasurements`, `measureNode`, `measurementOf`, `measureEndsOf`, `measureBetween`, `measureMagnification`, `measurePose`, `measureIds`, `currentMeasureId`, `measureHitAt` (core's `measureAt`), `measureEndSource`, `MEASURE_ACTION_IDS`, `MEASURE_LAYER_ID`, `MEASURE_AFFORDANCE_KIND` and their types. The package adds `MEASURE_TOOLS`, a `ToolSet` naming the measure tool, and `useMeasureTools({ measurements })`, which builds it.

Core no longer paints a measurement node by default. `createMeasurementsContribution` registers the painter, now `MEASURE_PAINTER` with the id `measure:measurement` (it was `kit:measure`), in its scene's own node shapes while it is installed; a render with no canvas registers it with `nodeShapesOf(scene).register(MEASURE_PAINTER)`.

```ts
// before
import { createMeasurements, createMeasurementsContribution, useMeasureTool } from '@weasel-js/core';
// after
import { createMeasurements, createMeasurementsContribution, useMeasureTool } from '@weasel-js/measure';
```

<!-- entry: rank=10 breaking api -->
