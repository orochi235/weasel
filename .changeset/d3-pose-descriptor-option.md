---
'@weasel-js/d3': major
---

`d3Bind`'s pose interpolation option is `poseDescriptor`, the name `<SceneCanvas>` and `<MinimapCanvas>` give the same thing.

```ts
// Before
d3Bind(scene, data, { key, animator, geometry: pathPoseDescriptor });

// After
d3Bind(scene, data, { key, animator, poseDescriptor: pathPoseDescriptor });
```

<!-- entry: breaking api -->
