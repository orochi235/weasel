---
'@weasel-js/kernel3d': major
---

`createPickEvery` is `createPickNearest`: it returns the one node nearest along the ray, not every node there.

```tsx
// before
<SceneCanvas geometry={{ pickEvery: createPickEvery(world) }} … />
// after
<SceneCanvas geometry={{ pickEvery: createPickNearest(world) }} … />
```

<!-- entry: breaking api -->
