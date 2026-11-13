---
'@weasel-js/core': major
---

`useSceneTextEdit`'s deprecated `defaultFontSize` option is removed. It was already ignored: a node with no font size of its own is edited at `DEFAULT_TEXT_STYLE.fontSize`, the size the canvas draws it at.

```ts
// before
useSceneTextEdit({ container, defaultFontSize: 24 });
// after
useSceneTextEdit({ container });
```

<!-- entry: breaking -->
