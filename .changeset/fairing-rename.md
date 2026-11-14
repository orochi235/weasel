---
'@weasel-js/path-tools': major
'@weasel-js/geom': major
'@weasel-js/core': major
---

Harmonize curvature is now Fairing, and every name it carried changes with it; this is breaking, with no aliases.

| Before | After |
|---|---|
| `harmonizePreset`, preset id `'harmonize'` | `fairingPreset`, `'fairing'` |
| action `harmonizeAnchors`, `harmonizeAnchorsAction` | `fairAnchors`, `fairAnchorsAction` |
| `harmonizeAnchors` (`@weasel-js/geom`) | `fairAnchors` |
| icon `core:harmonize` | `core:fairing` |

```ts
// before
<SceneCanvas features={['paths', harmonizePreset]} tune={{ harmonizeAnchors: { bindings: [{ kind: 'key', key: 'h' }] } }} />
// after
<SceneCanvas features={['paths', fairingPreset]} tune={{ fairAnchors: { bindings: [{ kind: 'key', key: 'h' }] } }} />
```

<!-- entry: rank=5 breaking api -->
