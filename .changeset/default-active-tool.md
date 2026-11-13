---
'@weasel-js/core': major
---

`<SceneCanvas initialActiveTool>` is renamed `defaultActiveTool`, as `defaultView` and `defaultPathEdit` are named.

```tsx
// before
<SceneCanvas scene={scene} defaultTools={['rect']} initialActiveTool="rect" />
// after
<SceneCanvas scene={scene} defaultTools={['rect']} defaultActiveTool="rect" />
```

<!-- entry: breaking api -->
