---
'@weasel-js/labkit': major
---

`createAnnotationScene` is renamed `createMarkScene`, after the `MarkScene` it returns.

```ts
// before
const scene = createAnnotationScene();
// after
const scene = createMarkScene();
```

<!-- entry: breaking api -->
