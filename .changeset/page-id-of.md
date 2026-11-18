---
'@weasel-js/core': major
---

`pageOfNode` is `pageIdOf`, since it returns a page id where its siblings return a `PlacedPage`.

```ts
// before
const page = pageOfNode(scene, id);
// after
const page = pageIdOf(scene, id);
```

<!-- entry: breaking api -->
