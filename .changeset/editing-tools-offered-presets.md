---
'@weasel-js/editing': major
---

`selectToolKitPreset` and `shapeToolKitPreset`, which offer tools unmounted, are `selectToolsOfferedPreset` and `shapeToolsOfferedPreset`.

```tsx
// before
<SceneCanvas features={[shapeToolKitPreset]} defaultTools={['rect']} … />
// after
<SceneCanvas features={[shapeToolsOfferedPreset]} defaultTools={['rect']} … />
```

<!-- entry: breaking api -->
