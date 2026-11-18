---
'@weasel-js/text': major
---

The canvas run layout's types are `CanvasRunsLayout`, `CanvasRunsLine`, `CanvasPositionedRun` and `CanvasMeasureFn`, named for `layoutCanvasRuns`.

They were `LayoutResult`, `LayoutLine`, `PositionedRun` and `MeasureFn`, generic names at the package root for one layout path.

```ts
// before
import type { LayoutResult, LayoutLine, PositionedRun, MeasureFn } from '@weasel-js/text';
// after
import type { CanvasRunsLayout, CanvasRunsLine, CanvasPositionedRun, CanvasMeasureFn } from '@weasel-js/text';
```

<!-- entry: breaking api -->
