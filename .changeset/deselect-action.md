---
'@weasel-js/editing': major
---

`escapeAction` is `deselectAction`, with id `deselect` and binding `deselect.key`, after what it does; it is still bound to Escape.

```tsx
// before
<SceneCanvas actions={{ escape: null }} bindingOverrides={{ 'escape.key': unbound() }} />
// after
<SceneCanvas actions={{ deselect: null }} bindingOverrides={{ 'deselect.key': unbound() }} />
```

<!-- entry: breaking api -->
