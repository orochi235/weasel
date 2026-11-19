---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

The Boolean path ops and the `booleansAdapter` dep move from `@weasel-js/core` to `@weasel-js/editing`, and `presets.booleans` publishes the dep.

This is breaking. These are editing's now, under the same names: `useBooleans`, `useBooleansAdapter`, `applyBooleanOp`, `previewBooleanOp`, `resolveBooleanOperands`, `commitBooleanPieces`, `useBooleansAdapterDepSource`, and the types `BooleanOp`, `BooleansAdapter`, `BooleanOpPreview`, `BooleanOpResult`, `BooleanPreviewPiece`, `BooleanOpOptions`, `BooleanStrokes`, `BooleanSource`, `BooleanOperands`, `BooleanCommitPiece`, `UseBooleansOptions` and `UseBooleansReturn`. `usePathLeafDepSources` is gone; `useSliceDepSource` stays in core.

`<SceneCanvas>` no longer publishes a `booleansAdapter` over its path leaves. `presets.booleans` does, and `presets.pathfinder` (so `presets.draw`) and path-tools' `pathTools.pathTools` include it. A canvas that runs the shape builder or reads the dep without either names it:

```tsx
// before
import { useBooleansAdapter } from '@weasel-js/core';
<SceneCanvas features={[presets.pick]} tools={{ shapeBuilder }} />
// after
import { useBooleansAdapter } from '@weasel-js/editing';
import * as presets from '@weasel-js/editing/presets';
<SceneCanvas features={[presets.pick, presets.booleans]} tools={{ shapeBuilder }} />
```

<!-- entry: rank=10 breaking api -->
