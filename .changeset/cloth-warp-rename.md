---
'@weasel-js/geom': major
'@weasel-js/path-tools': major
---

The Envelope mesh tool is now Cloth warp, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `useEnvelopeTool`, `UseEnvelopeToolOptions` | `useClothWarpTool`, `UseClothWarpToolOptions` |
| `DEFAULT_ENVELOPE_SIZE` | `DEFAULT_CLOTH_SIZE` |
| tool id and `WarpKind` `'envelope'` | `'cloth'` |
| actions `envelope.drag`, `envelope.grab` | `cloth.drag`, `cloth.grab` |
| icon `path-tools:envelope` | `path-tools:clothWarp` |
| `EnvelopeWarp`, `EnvelopeMapping` (`@weasel-js/geom/warp`) | `ClothWarp`, `ClothMapping` |
| `envelopeOver`, `resizeEnvelope` | `clothOver`, `resizeCloth` |
| a held warp's `kind: 'envelope'` | `kind: 'cloth'` |

The tool keeps its Shift+F key. A document saved with an envelope warp held on a path needs that warp's `data.warp.warp.kind` rewritten to `'cloth'`.

```ts
// before
const envelope = useEnvelopeTool({ rows: 4 });
<SceneCanvas tools={{ envelope }} tune={{ 'envelope.drag': { params: { cols: 4 } } }} />
// after
const cloth = useClothWarpTool({ rows: 4 });
<SceneCanvas tools={{ cloth }} tune={{ 'cloth.drag': { params: { cols: 4 } } }} />
```

<!-- entry: rank=5 breaking api data -->
