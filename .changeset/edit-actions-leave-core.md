---
'@weasel-js/core': major
'@weasel-js/editing': minor
'@weasel-js/measure': minor
---

The edit, clipboard, Transform Again and Pathfinder actions move from `@weasel-js/core` to `@weasel-js/editing`.

This is breaking. These exports are editing's now, under the same names: `escapeAction`, `selectAllAction`, `duplicateAction` (with `duplicateSelection`), `groupAction`, `ungroupAction`, the `nudge*Action`s, `setFillAction`, `setFillOpacityAction`, `setStrokeAction`, `setStrokeOpacityAction`, `setStrokeWidthAction`, `setVertexColorAction`, `ingestAction`, `transformAgainAction`, `transformSelection` and `SelectionTransform`, the `clipboard*Action`s, the `pathfinder*Action`s and `PATHFINDER_STROKES`, `makeBooleanGroupAction`, `booleanGroupOps` and `makeBooleanGroup`, `PATHFINDER_KEYMAP`, `PATHFINDER_KEYMAP_ID` and `PATHFINDER_LEADER`, and `ENGINE_STANDARD_ACTIONS`, which leaves `@weasel-js/core/engine`.

```ts
// before
import { ENGINE_STANDARD_ACTIONS, useActionSet } from '@weasel-js/core/engine';
// after
import { useActionSet } from '@weasel-js/core/engine';
import { ENGINE_STANDARD_ACTIONS } from '@weasel-js/editing';
```

Core keeps the Pathfinder engine (`applyBooleanOp`, `useBooleans` and the booleans adapter), `deleteAction`, and `DUPLICATE_OFFSET`, the offset a paste shares with a duplicate. Measure's Move by and Rotate by read `transformSelection` from editing.

<!-- entry: rank=10 breaking api -->
