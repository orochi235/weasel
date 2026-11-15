---
'@weasel-js/kernel3d': minor
---

`cameraRig(camera3d)` puts an orbit camera on a `<SceneCanvas>` as one ambient entry, with its wheel dolly, pinch, and double-click home.

```tsx
const rig = useMemo(() => cameraRig(createCameraDep(world, { set: setCamera })), [world]);
<SceneCanvas tools={{ orbit: useOrbitTool() }} ambient={[rig]} … />
```

`{ id }` names the entry; it defaults to `'camera3d'`.

<!-- entry: api -->
