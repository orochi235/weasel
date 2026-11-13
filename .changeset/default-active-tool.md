---
'@weasel-js/core': major
---

`<SceneCanvas initialActiveTool>` is renamed `defaultActiveTool`, beside `defaultView` and `defaultPathEdit`, the canvas's other read-once starting values.

```tsx
// before
<SceneCanvas scene={scene} defaultTools={['rect']} initialActiveTool="rect" />
// after
<SceneCanvas scene={scene} defaultTools={['rect']} defaultActiveTool="rect" />
```

<!-- entry: breaking api -->
