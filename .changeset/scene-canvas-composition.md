---
'@weasel-js/core': minor
---

`<SceneCanvas composition>` loads a saved scene whose nested poses are not rects, such as a kernel3d `Pose3` scene with groups.

A serialized `scene` is baked under it. It is read once, with the JSON, as `sceneFromJSON(json, { composition })` takes it; a live `Scene` keeps the composition it was made with.

```tsx
<SceneCanvas scene={savedJson} composition={POSE3_COMPOSITION} />
```

<!-- entry: api -->
