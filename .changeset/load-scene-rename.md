---
'@weasel-js/core': major
'@weasel-js/labkit': major
---

`sceneFromJSON` is renamed `loadScene`, and labkit's `annotationsFromJSON` `loadAnnotations`

Both build a live store from saved data, so each is named for what it does. `SceneFromJSONOptions` is now `LoadSceneOptions`.

```ts
// before
const scene = sceneFromJSON(saved, { registry });
// after
const scene = loadScene(saved, { registry });
```

<!-- entry: breaking api -->
