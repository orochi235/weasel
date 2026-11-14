---
'@weasel-js/path-tools': major
'@weasel-js/geom': major
'@weasel-js/core': major
---

The Smudge brush is now Knead, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `useSmudgeBrushTool`, `UseSmudgeBrushToolOptions`, `SMUDGE_BRUSH_TOOL_OPTIONS` | `useKneadTool`, `UseKneadToolOptions`, `KNEAD_TOOL_OPTIONS` |
| `smudgePreset`, preset id `'smudge'` | `kneadPreset`, `'knead'` |
| tool id, action id, and `PathToolId` `'smudgeBrush'` | `'knead'` |
| `smudgeBrushAction`, `SMUDGE_BRUSH_PARAMS`, `SmudgeBrushParams` | `kneadAction`, `KNEAD_PARAMS`, `KneadParams` |
| `DEFAULT_SMUDGE_RADIUS_PX`, `DEFAULT_SMUDGE_STRENGTH` | `DEFAULT_KNEAD_RADIUS_PX`, `DEFAULT_KNEAD_STRENGTH` |
| `smudgePath`, `SmudgePathOptions` (`@weasel-js/geom`, re-exported by core) | `kneadPath`, `KneadPathOptions` |
| icon `path-tools:smudgeBrush` | `path-tools:knead` |

The tool keeps its U key. Tool options saved under the `smudgeBrush` id start from their defaults under `knead`.

```ts
// before
const smudgeBrush = useSmudgeBrushTool();
<SceneCanvas features={['draw', smudgePreset]} tools={{ smudgeBrush }} />
// after
const knead = useKneadTool();
<SceneCanvas features={['draw', kneadPreset]} tools={{ knead }} />
```

<!-- entry: rank=5 breaking api -->
