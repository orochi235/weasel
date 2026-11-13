---
'@weasel-js/minimap': major
---

The minimap's ctrl+wheel binding is `<id>.trackpad`, as `viewport.zoom`'s is, and `<id>.pinch` is now Safari's pinch.

A binding override that named the ctrl+wheel zoom renames it:

```tsx
// before
<SceneCanvas bindingOverrides={{ 'minimap.pinch': null }} … />
// after
<SceneCanvas bindingOverrides={{ 'minimap.trackpad': null }} … />
```

<!-- entry: breaking -->
