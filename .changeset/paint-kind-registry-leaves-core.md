---
'@weasel-js/core': major
'@weasel-js/paint-kinds': minor
---

The paint-kind registry moves from `@weasel-js/core` to `@weasel-js/paint-kinds`.

This is breaking: import `registerPaintKind`, `registerPaintKindLoader`, `getPaintKind`, `listPaintKinds`, `listGradientKinds`, `paintKindOf`, `paintKindRegistry`, `patternFamily`, `seedTile`, `withPaintKind`, `asPaint` and the `PaintKind`, `PaintKindEntry`, `PaintKindEditorProps`, `PaintKindFamily` and `PaintKindLoader` types from `@weasel-js/paint-kinds`; `usePaintKinds`, `usePaintKind` and `useGradientKinds` from `@weasel-js/paint-kinds/react`; and `_resetPaintKindsForTests` from `@weasel-js/paint-kinds/test-seams`. Importing `@weasel-js/core/mesh` still registers the mesh kind. `warmPaintKinds` and `isPaintKindKnown` stay in core.

```ts
import { registerPaintKind, asPaint } from '@weasel-js/paint-kinds';
import { usePaintKinds } from '@weasel-js/paint-kinds/react';
```

<!-- entry: rank=10 breaking api -->
