---
'@weasel-js/p-touch': major
---

`lbxObjects` is `lbxObjectsCommand`, since it returns a draw command carrying the objects, not the objects.

```ts
// before
drawOne: (node) => [lbxObjects([barcode])]
// after
drawOne: (node) => [lbxObjectsCommand([barcode])]
```

<!-- entry: breaking api -->
