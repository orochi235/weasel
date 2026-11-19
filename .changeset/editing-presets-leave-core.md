---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

The editing presets, preset names, `useStandardActions`, and align, distribute, flip and reorder move to the new `@weasel-js/editing`.

This is breaking. Core keeps its view presets, `view` and `viewTools` on `@weasel-js/core/presets`, so a canvas given only those draws, pans and zooms. Everything else a canvas got from core's presets now comes from editing's `@weasel-js/editing/presets` entry: `presets.draw`, `presets.pick`, `presets.transform`, `presets.select`, `presets.outline`, `presets.move`, `presets.resize`, `presets.rotate`, `presets.edit` and its parts (`presets.escape`, `presets.contextMenu`, `presets.selectAll`, `presets.duplicate`, `presets.delete`, `presets.group`, `presets.nudge`, `presets.style`, `presets.clipboard`), `presets.arrange` and its parts (`presets.flip`, `presets.reorder`, `presets.align`, `presets.distribute`), `presets.pathfinder`, `presets.ingest`, `presets.selectTools` and `presets.shapeTools`.

```tsx
// before
import { drawPreset, SceneCanvas } from '@weasel-js/core';
import { namedFeatures } from '@weasel-js/core/named-features';

// after
import { SceneCanvas } from '@weasel-js/core';
import { namedFeatures } from '@weasel-js/editing';
import * as presets from '@weasel-js/editing/presets';
```

The `@weasel-js/core/named-features` entry is gone: `namedFeatures`, `FEATURE_NAMES`, `FEATURE_PRESETS`, `FEATURE_ACTION_IDS` and `FeatureName` are editing's, and name core's view presets as well as editing's. `useStandardActions`, `UseStandardActionsOptions` and `KIT_STANDARD_ACTION_IDS` move with them; core keeps `useActionSet` and `useStandardDeps`. `flipAction`, `useAlign`, `alignDeltaFor`, `alignTargetBounds`, `useDistribute`, their option and adapter types, `FlipAxis`, `FlipPivot`, and the `AlignParams`, `DistributeParams`, `FlipParams` and `ReorderParams` param types are editing's, which also exports the align, distribute and reorder actions by name.

<!-- entry: rank=20 breaking api -->
