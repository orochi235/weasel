---
'@weasel-js/path-tools': major
'@weasel-js/geom': major
---

Soft selection is now Drape, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `createSoftSelectionPreset`, preset id `'softSelection'` | `createDrapePreset`, `'drape'` |
| `createSoftSelectionExtension`, extension id `'softSelection'`, `SoftSelectionOptions` | `createDrapeExtension`, `'drape'`, `DrapeOptions` |
| `softSelectionWeights`, `softSelectionBand`, `softFalloff`, `SoftFalloff` (`@weasel-js/geom`) | `drapeWeights`, `drapeBand`, `drapeFalloff`, `DrapeFalloff` |

```ts
// before
<SceneCanvas features={['paths', createSoftSelectionPreset(() => ({ radiusPx: 80 }))]} />
// after
<SceneCanvas features={['paths', createDrapePreset(() => ({ radiusPx: 80 }))]} />
```

<!-- entry: rank=5 breaking api -->
