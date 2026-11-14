---
'@weasel-js/geom': major
'@weasel-js/path-tools': major
---

Perspective and free distort is now Plane warp, and every name it carried changes with it; this is breaking, with no aliases. Its two modes are still `free` and `perspective`.

| Before | After |
|---|---|
| `useDistortTool`, `UseDistortToolOptions` | `usePlaneWarpTool`, `UsePlaneWarpToolOptions` |
| tool id, `PathToolId`, and `WarpKind` `'distort'` | `'plane'` |
| action `distort.drag`, its layer's hit kind `layer:warp-distort` | `plane.drag`, `layer:warp-plane` |
| warp settings fields `distorts` and `distort.mode` | `planes` and `plane.mode` |
| icon `path-tools:distort` | `path-tools:planeWarp` |
| `DistortWarp`, `DistortMode`, `distortOver` (`@weasel-js/geom/warp`) | `PlaneWarp`, `PlaneMode`, `planeOver` |
| a held warp's `kind: 'distort'` | `kind: 'plane'` |

The tool keeps its F key. A document saved with a distort held on a path needs that warp's `data.warp.warp.kind` rewritten to `'plane'`.

```ts
// before
const distort = useDistortTool({ mode: 'perspective' });
<SceneCanvas tools={{ distort }} tune={{ 'distort.drag': { params: { mode: 'perspective' } } }} />
// after
const plane = usePlaneWarpTool({ mode: 'perspective' });
<SceneCanvas tools={{ plane }} tune={{ 'plane.drag': { params: { mode: 'perspective' } } }} />
```

<!-- entry: rank=5 breaking api data -->
