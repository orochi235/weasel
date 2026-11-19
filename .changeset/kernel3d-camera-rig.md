---
'@weasel-js/kernel3d': minor
---

`createCameraRigContribution(camera3d)` puts an orbit camera on a `<SceneCanvas>` as one ambient entry, with its wheel dolly, pinch, and double-click home.

```tsx
const rig = useMemo(() => createCameraRigContribution(createCameraDep(world, { set: setCamera })), [world]);
<SceneCanvas tools={{ orbit: useOrbitTool() }} ambient={[rig]} … />
```

`{ id }` names the entry; it defaults to `'camera3d'`.

<!-- entry: api -->
