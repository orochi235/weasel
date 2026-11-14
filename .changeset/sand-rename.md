---
'@weasel-js/path-tools': major
'@weasel-js/core': major
---

The Simplify brush is now Sand, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `useSimplifyBrushTool`, `UseSimplifyBrushToolOptions`, `SIMPLIFY_BRUSH_TOOL_OPTIONS` | `useSandTool`, `UseSandToolOptions`, `SAND_TOOL_OPTIONS` |
| `simplifyBrushPreset`, preset id `'simplifyBrush'` | `sandPreset`, `'sand'` |
| tool id, action id, and `PathEditToolId` `'simplifyBrush'`, binding `simplifyBrush.drag` | `'sand'`, `sand.drag` |
| `simplifyBrushAction`, `SIMPLIFY_BRUSH_PARAMS`, `SIMPLIFY_BRUSH_RADIUS_PX`, `SimplifyBrushParams` | `sandAction`, `SAND_PARAMS`, `SAND_RADIUS_PX`, `SandParams` |
| icon `core:simplifyBrush` | `core:sand` |

Core's Simplify command is unchanged. Tool options saved under the `simplifyBrush` id start from their defaults under `sand`.

```ts
// before
const simplifyBrush = useSimplifyBrushTool();
<SceneCanvas features={['paths', simplifyBrushPreset]} tools={{ simplifyBrush }} />
// after
const sand = useSandTool();
<SceneCanvas features={['paths', sandPreset]} tools={{ sand }} />
```

<!-- entry: rank=5 breaking api -->
