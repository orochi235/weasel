---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

The shape, lasso, image and eyedropper tools and the kit's tool sets move to `@weasel-js/editing`, which offers them by id.

This is breaking. `<SceneCanvas>` no longer builds rect, ellipse, line, polygon, star or lasso in: a preset offers them, and `defaultTools`, a preset's `tools` or a `tools` patch mounts one by id only when an enabled preset offers it. `drawPreset` offers every one; a canvas without it adds `shapeToolKitPreset` (or `shapeToolsPreset`, which also mounts them) for the shapes and `selectToolKitPreset` for the lasso.

```tsx
// before
<SceneCanvas scene={scene} features={[pickPreset]} defaultTools={['rect']} />

// after
import { pickPreset, shapeToolKitPreset } from '@weasel-js/editing';
<SceneCanvas scene={scene} features={[pickPreset, shapeToolKitPreset]} defaultTools={['rect']} />
```

From editing, under the same names: `useRectTool`, `useEllipseTool`, `useLineTool`, `usePolygonTool`, `useStarTool`, `useLassoTool`, `useImageTool`, `useEyedropperTool`, their `*_TOOL_OPTIONS` and option types, `shapeToolOptions`, `styleOptionLeaves`, `toolOptionPaint`, `DEFAULT_SHAPE_PAINT`, `insertBindingBehaviors`, `InsertToolOptions`, `createPointerFollower`, `SELECT_TOOLS`, `SHAPE_TOOLS`, `BUILTIN_TOOLS`, `BUILTIN_TOOL_GROUPS`, `BUILTIN_TOOL_IDS` and `TOOL_GROUP_ORDER`. Each hook has a plain factory beside it (`createRectTool`, …). Core keeps `VIEW_TOOLS`, the hand, and `BuiltinToolId`, now `'select' | 'hand'`; editing's `KitToolId` names every kit tool. `BuiltinToolOptions` is gone: `toolOptions` is `SceneCanvasToolOptions`, whose `lasso` and `insert` keys editing adds.

<!-- entry: rank=10 breaking api -->
