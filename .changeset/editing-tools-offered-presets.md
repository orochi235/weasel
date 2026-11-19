---
'@weasel-js/editing': major
---

`selectToolKitPreset` and `shapeToolKitPreset`, which offer tools unmounted, are `presets.selectToolsOffered` and `presets.shapeToolsOffered`.

```tsx
// before
<SceneCanvas features={[shapeToolKitPreset]} defaultTools={['rect']} … />
// after
<SceneCanvas features={[presets.shapeToolsOffered]} defaultTools={['rect']} … />
```

<!-- entry: breaking api -->
