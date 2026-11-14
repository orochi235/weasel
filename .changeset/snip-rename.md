---
'@weasel-js/path-tools': major
'@weasel-js/geom': major
'@weasel-js/core': major
---

The Trim segment tool is now Snip, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `useTrimTool`, `UseTrimToolOptions` | `useSnipTool`, `UseSnipToolOptions` |
| `trimPreset`, preset id `'trim'` | `snipPreset`, `'snip'` |
| tool id and `PathToolId` `'trim'`, bindings `trim.hover`, `trim.leave`, actions `trim.preview`, `trim.unpreview` | `'snip'`, `snip.hover`, `snip.leave`, `snip.preview`, `snip.unpreview` |
| action `trimPath`, `trimPathAction`, `TRIM_PATH_PARAMS`, `planTrim` | `snipPath`, `snipPathAction`, `SNIP_PATH_PARAMS`, `planSnip` |
| `trimPathAt`, `TrimPathOptions`, `TrimResult` (`@weasel-js/geom`, re-exported by core) | `snipPathAt`, `SnipPathOptions`, `SnipResult` |
| icon `path-tools:trim` | `path-tools:snip` |

The tool keeps its Y key. A stroke's `trim`, core's boolean Trim, and `pathTrim` are unrelated and keep their names.

```ts
// before
const trim = useTrimTool();
<SceneCanvas features={['draw', trimPreset]} tools={{ trim }} />
// after
const snip = useSnipTool();
<SceneCanvas features={['draw', snipPreset]} tools={{ snip }} />
```

<!-- entry: rank=5 breaking api -->
