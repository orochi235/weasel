---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

The editing presets, preset names, `useStandardActions`, and align, distribute, flip and reorder move to the new `@weasel-js/editing`.

This is breaking. Core keeps `viewPreset` and `viewToolsPreset`, so a canvas given only those draws, pans and zooms. Everything else a canvas got from core's presets now comes from editing, under the same names: `drawPreset`, `pickPreset`, `transformPreset`, `selectPreset`, `outlinePreset`, `movePreset`, `resizePreset`, `rotatePreset`, `editPreset` and its parts (`escapePreset`, `contextMenuPreset`, `selectAllPreset`, `duplicatePreset`, `deletePreset`, `groupPreset`, `nudgePreset`, `stylePreset`, `clipboardPreset`), `arrangePreset` and its parts (`flipPreset`, `reorderPreset`, `alignPreset`, `distributePreset`), `pathfinderPreset`, `ingestPreset`, `selectToolsPreset` and `shapeToolsPreset`.

```tsx
// before
import { drawPreset, SceneCanvas } from '@weasel-js/core';
import { namedFeatures } from '@weasel-js/core/named-features';

// after
import { SceneCanvas } from '@weasel-js/core';
import { drawPreset, namedFeatures } from '@weasel-js/editing';
```

The `@weasel-js/core/named-features` entry is gone: `namedFeatures`, `FEATURE_NAMES`, `FEATURE_PRESETS`, `FEATURE_ACTION_IDS` and `FeatureName` are editing's, and name core's view presets as well as editing's. `useStandardActions`, `UseStandardActionsOptions` and `KIT_STANDARD_ACTION_IDS` move with them; core keeps `useActionSet` and `useStandardDeps`. `flipAction`, `useAlign`, `alignDeltaFor`, `alignTargetBounds`, `useDistribute`, their option and adapter types, `FlipAxis`, `FlipPivot`, and the `AlignParams`, `DistributeParams`, `FlipParams` and `ReorderParams` param types are editing's, which also exports the align, distribute and reorder actions by name.

<!-- entry: rank=20 breaking api -->
