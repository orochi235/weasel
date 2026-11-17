---
'@weasel-js/path-tools': major
---

Path-tools' all-families preset `pathTools` is `pathToolsPreset`, named like every other `FeaturePreset`.

Its preset id is still `'pathTools'`.

```tsx
// before
<SceneCanvas features={[drawPreset, pathTools]} tools={tools} />
// after
<SceneCanvas features={[drawPreset, pathToolsPreset]} tools={tools} />
```

<!-- entry: breaking api -->
