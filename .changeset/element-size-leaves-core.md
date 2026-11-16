---
'@weasel-js/core': major
'@weasel-js/routing': minor
---

`useElementSize` and `ElementSizeOptions` move from `@weasel-js/core` to `@weasel-js/routing/react`.

This is breaking: import them from `@weasel-js/routing/react`, which also names the size it returns, `ElementSize`. `useCanvasSize` stays in core.

<!-- entry: breaking api -->
