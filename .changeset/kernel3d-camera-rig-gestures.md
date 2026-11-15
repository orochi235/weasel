---
'@weasel-js/kernel3d': minor
---

`cameraRig` takes which gestures it binds, and `cameraRigActions` hands the same bound camera actions to a dispatcher of your own.

`drag` orbits on a drag and pans on Shift+drag (default `false`, as `useOrbitTool` binds those on a `<SceneCanvas>`); `wheel` is `'plain'`, `'mod'` (Cmd/Ctrl+wheel only) or `false`; `trackpadPinch`, `touchPinch`, and `home` each default to `true`. An action with every gesture off is left out.

```tsx
const actions = cameraRigActions({ drag: true, wheel: 'mod', touchPinch: false });
useEffect(() => { const offs = actions.map((a) => registry.register(a)); return () => offs.forEach((off) => off()); }, [actions]);
```

<!-- entry: api -->
