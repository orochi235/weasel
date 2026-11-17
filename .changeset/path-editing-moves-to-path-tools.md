---
'@weasel-js/core': major
'@weasel-js/path-tools': minor
---

Path edit, the pen, the pencil, the knife, the path commands, and Create Outlines move from `@weasel-js/core` to `@weasel-js/path-tools`.

This is breaking. `drawPreset` no longer opens a path for editing, and `<SceneCanvas>` no longer builds in the `pen`, `pencil`, `slice` or `anchors` tools. A canvas gets them back from path-tools: `pathsPreset` (path edit, its anchor keys, the path commands, and outlines), which `pathToolsPreset` includes, and `usePathToolsTools`, which now builds the pen, the pencil, the knife and the anchors tool beside the rest.

```tsx
// before
import { drawPreset, SceneCanvas } from '@weasel-js/core';
<SceneCanvas features={[drawPreset]} defaultTools={['select', 'pen', 'pencil', 'slice']} />;

// after
import { drawPreset, SceneCanvas } from '@weasel-js/core';
import { pathToolsPreset, usePathToolsTools } from '@weasel-js/path-tools';
const tools = usePathToolsTools();
<SceneCanvas features={[drawPreset, pathToolsPreset]} defaultTools={['select']} tools={tools} />;
```

These exports leave core and are path-tools' now, under the same names: `pathsPreset`, `pathEditPreset`, `anchorKeysPreset`, `outlinesPreset`, `pathCommandsPreset`; `usePenTool`, `PEN_TOOL_OPTIONS`, `createPenPreviewLayer`, `PEN_CLOSE_HIT_PX`, `usePencilTool`, `PENCIL_TOOL_OPTIONS`, `useSliceTool`, `sliceAction`, `anchorsTool`, `ANCHORS_TOOL_ID`; `editAnchorsAction`, `selectAnchorAction`, `deleteAnchorsAction`, the `nudgeAnchors*Action`s, `hitAnchor`, `commitAnchorEdit`, `anchorEditWouldChange`, `depOf`, `requiresAnchorSelection`, `createHandleCommand`, `joinSelectedAnchors`, `editTargetOf`, `markUnder`, `deleteSelectedMark`, `pathEditPreview`, `finishPathEditFrame`, `editedPathSymmetries`, `locksInForce`, `HANDLE_LOCK_ROLES`; `livePathEdit`, `createJoinPathsAction`, `planJoin`, `SIMPLIFY_PATH_PARAMS`, `OFFSET_PATH_PARAMS`, `DEFAULT_SIMPLIFY_TOLERANCE`, `OffsetPathParams`; `applyCreateOutlines`, `applyOutlineStroke`, `useCreateOutlinesAdapter`, and their types.

Core's tool sets lose `ANCHOR_TOOLS`, `DRAW_TOOLS` and `PAGE_TOOLS`, and its presets `drawToolsPreset` and `pageToolsPreset` with their `tools:draw` and `tools:page` names: path-tools' `PATH_EDIT_TOOLS` now leads with the anchors tool, and `DRAW_TOOLS` and `SLICE_TOOLS` hold the pen and pencil and the knife. `TOOL_GROUP_ORDER` names core's groups only, so a palette showing path-tools' tools passes its own `groupOrder`. The `pen` and `pencil` shape kinds stay core's, with `tool: false`.

<!-- entry: rank=20 breaking api -->
