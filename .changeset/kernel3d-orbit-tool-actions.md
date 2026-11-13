---
'@weasel-js/kernel3d': minor
---

The orbit tool carries its `camera.orbit` and `camera.pan` actions, and `useKernel3dTools()` builds every tool in `KERNEL3D_TOOLS`.

A canvas no longer registers the orbit and pan actions beside the tool; it registers the wheel dolly, the pinch and the double-click home it wants:

```tsx
const rig: SurfaceContribution = { id: 'rig', eligibility: { always: true }, actions: [dollyAction, pinchDollyAction, homeAction], deps };
<SceneCanvas tools={useKernel3dTools()} ambient={[rig]} />
```

<!-- entry: api -->
