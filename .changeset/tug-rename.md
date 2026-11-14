---
'@weasel-js/path-tools': major
'@weasel-js/geom': major
'@weasel-js/core': major
---

The Lengthen tool is now Tug, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `useLengthenTool` | `useTugTool` |
| `lengthenPreset`, preset id `'lengthen'` | `tugPreset`, `'tug'` |
| tool id and `PathEditToolId` `'lengthen'`, binding `lengthen.drag` | `'tug'`, `tug.drag` |
| action `lengthenPath`, `lengthenPathAction`, `LENGTHEN_PATH_PARAMS`, `LengthenPathParams` | `tugPath`, `tugPathAction`, `TUG_PATH_PARAMS`, `TugPathParams` |
| `lengthenPathEnd`, `lengthenOpenEnd`, `LengthenMode` (`@weasel-js/geom`; core re-exports `lengthenOpenEnd`) | `tugPathEnd`, `tugOpenEnd`, `TugMode` |
| icon `path-tools:lengthen` | `path-tools:tug` |

The tool still has no key of its own, and the undo label of a drag that shortens the path is still Shorten path.

```ts
// before
<SceneCanvas features={['paths', lengthenPreset]} tools={{ lengthen: useLengthenTool() }} tune={{ lengthenPath: { params: { mode: 'curvature' } } }} />
// after
<SceneCanvas features={['paths', tugPreset]} tools={{ tug: useTugTool() }} tune={{ tugPath: { params: { mode: 'curvature' } } }} />
```

<!-- entry: rank=5 breaking api -->
