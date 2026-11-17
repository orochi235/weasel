---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

The select tool, group entry and the selection's move, resize and rotate contributions move to `@weasel-js/editing`, with an `./engine` entry.

This is breaking. `<SceneCanvas>` no longer builds a select tool: editing's `selectToolKitPreset` offers one by id, built over the canvas's pickers and its `selectTool` options, and `selectPreset` (in `pickPreset` and `drawPreset`) mounts it and installs the group entry (double-click to enter, Escape to leave). Under `actions={null}` that group entry stays, as the rest of the preset does. Core's `BuiltinToolId` is now `'hand'`.

From editing: `useSelectTool`, `useSelectToolWith` and their plain factories `createSelectTool` and `createSelectToolWith`, `SelectAdapter`, `UseSelectToolOptions`, `createSelectionMoveContribution`, `createSelectionResizeContribution`, `createSelectionRotateContribution`, `createSelectionTransformContribution` and their `*Bindings`, `createAreaSelectContribution`, `isBodyOffChrome`, `isEmptyOffChrome`, the `SELECTION_*_ID`s and `AREA_SELECT_ID`, `createGroupEntryContribution`, `useGroupEntryContribution`, `GROUP_ENTRY_ID` and `GROUP_LEAVE_PRESS_BINDING`. A host of another dimension imports `useSelectToolWith`, `createSelectionMoveContribution`, `useGroupEntryContribution` and `ENGINE_STANDARD_ACTIONS` from `@weasel-js/editing/engine`, which loads none of editing's presets.

```ts
// before
import { createSelectionMoveContribution, useSelectToolWith } from '@weasel-js/core/engine';
// after
import { createSelectionMoveContribution, useSelectToolWith } from '@weasel-js/editing/engine';
```

<!-- entry: rank=10 breaking api -->
