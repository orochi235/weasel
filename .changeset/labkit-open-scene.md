---
'@weasel-js/labkit': major
---

`AnnotationsApi.sceneFor` is renamed `openScene`: the first call for a target creates its scene, registers its history and subscribes to it.

```ts
// before
const scene = annotations.sceneFor('left');
// after
const scene = annotations.openScene('left');
```

<!-- entry: breaking api -->
