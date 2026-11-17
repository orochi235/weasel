---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

The move, resize, rotate, clone, insert, marquee, lasso and clear-selection actions move to `@weasel-js/editing`, with the deps they read.

This is breaking. A bare `<SceneCanvas>` no longer publishes the `insert`, `insertLive`, `areaSelect`, `lassoSelect` or `resizePolicy` deps, and a tool binding `insert` or `areaSelect` no longer brings the action with it: an editing preset does. `drawPreset` has them all; a canvas mounting a tool that inserts (a shape tool, `@weasel-js/path-tools`' pen or pencil, a `@weasel-js/diagram` stencil) without it adds `insertPreset`. `textToolsPreset` includes it.

```tsx
// before
<SceneCanvas scene={scene} tools={useDiagramTools({ connector })} />

// after
import { insertPreset } from '@weasel-js/editing';
<SceneCanvas scene={scene} features={[insertPreset]} tools={useDiagramTools({ connector })} />
```

From editing, under the same names: `moveAction`, `cloneAction`, `resizeAction`, `createResizeAction`, `ResizeActionOptions`, `rotateAction`, `areaSelectAction`, `clearSelectionAction`, `lassoSelectAction`, `UseLassoSelectOptions`, `selectFromLasso`, `SelectFromLassoOptions`, `insertAction`, `INSERT_DRAG_MODS`, `insertParams`, `POLYGON_INSERT_PARAMS`, `STAR_INSERT_PARAMS`, `placeAction`, `insertRepositionAction`, `INSERT_REPOSITION_BINDING`, `insertRotateAction`, `insertStyleOf`, `DEFAULT_STROKE_WIDTH`, `STYLE_OPTION_KEYS`, `InsertStyle`, `StyleOptionKey`, `useResizePolicyDepSource` and `UseResizePolicyDepSourceOptions`; `moveAction`, `insertAction` and `areaSelectAction` also from `@weasel-js/editing/engine`. The `@weasel-js/core/move`, `/resize` and `/clone` entries are gone: `snapToContainer`, `snapBackOrDelete`, `clampMove`, `ClampMoveOptions` and `clampMinSize` come from `@weasel-js/editing`, and the pose descriptors, handle geometry, `UseMoveOptions` and `CloneBehavior` from `@weasel-js/core`. `toolDrivenActions` and `TOOL_DRIVEN_ACTION_IDS` are gone; a preset's `toolActions` say the same. Core keeps the option types (`UseMoveOptions`, `UseResizeOptions`, `UseRotateOptions`), the dep types and `DepSchema` entries, `InsertNodeFactories`, and the action params.

<!-- entry: rank=10 breaking api -->
