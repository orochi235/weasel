---
'@weasel-js/labkit': major
---

labkit's `createAnnotationStore` is `createMarkStore`, and its saved document type `SerializedAnnotations` is `SerializedMarkStore`.

The saved JSON is unchanged.

```ts
// before
const store = createAnnotationStore({ targets });
// after
const store = createMarkStore({ targets });
```

<!-- entry: breaking api -->
