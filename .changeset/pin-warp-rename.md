---
'@weasel-js/geom': major
'@weasel-js/path-tools': major
---

Puppet warp is now Pin warp, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `usePuppetTool`, `UsePuppetToolOptions` | `usePinWarpTool`, `UsePinWarpToolOptions` |
| tool id, `PathToolId`, and `WarpKind` `'puppet'` | `'pin'` |
| actions `puppet.drag`, `puppet.addPin`, `puppet.removePin` | `pin.drag`, `pin.addPin`, `pin.removePin` |
| icon `path-tools:puppetWarp` | `path-tools:pinWarp` |
| `PuppetWarp`, `PuppetPin` (`@weasel-js/geom/warp`) | `PinWarp`, `WarpPin` |
| `puppetMap`, `puppetSolve`, `puppetMesh`, `PuppetMesh`, `PuppetMeshOptions` | `pinWarpMap`, `pinWarpSolve`, `pinWarpMesh`, `PinWarpMesh`, `PinWarpMeshOptions` |
| a held warp's `kind: 'puppet'` | `kind: 'pin'` |

The tool keeps its B key. A document saved with a puppet warp held on a path needs that warp's `data.warp.warp.kind` rewritten to `'pin'`.

```ts
// before
const puppet = usePuppetTool({ tolerance: 1 });
<SceneCanvas tools={{ puppet }} tune={{ 'puppet.addPin': { params: { tolerance: 1 } } }} />
// after
const pin = usePinWarpTool({ tolerance: 1 });
<SceneCanvas tools={{ pin }} tune={{ 'pin.addPin': { params: { tolerance: 1 } } }} />
```

<!-- entry: rank=5 breaking api data -->
